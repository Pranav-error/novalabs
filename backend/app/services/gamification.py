"""XP, streak, badge, and day-completion logic shared across routers.

All helpers take the request's AsyncSession and flush but never commit —
the session middleware/router owns the transaction.
"""
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.certificate import Certificate
from app.models.gamification import LearnerBadge, LearnerStreak, XPEvent
from app.models.progress import LearnerDayProgress

IST = timezone(timedelta(hours=5, minutes=30))

XP_VALUES = {
    "quiz_complete": 50,
    "quiz_bonus": 30,
    "assignment_submit": 80,
    "community_post": 15,
    "doubt_reply": 20,
    "daily_login": 10,
    "streak_7": 150,
    "streak_14": 300,
    "streak_30": 500,
}


def _ist_day_bounds_utc(day: date | None = None) -> tuple[datetime, datetime]:
    d = day or datetime.now(IST).date()
    start_ist = datetime(d.year, d.month, d.day, tzinfo=IST)
    return start_ist.astimezone(timezone.utc), (start_ist + timedelta(days=1)).astimezone(timezone.utc)


async def award_xp(
    db: AsyncSession,
    learner_id: str,
    reason: str,
    reference_id: str | None = None,
    reference_type: str | None = None,
    once_per_reference: bool = False,
    once_per_day: bool = False,
) -> int:
    """Award XP for an action. Returns the amount awarded (0 if anti-gaming blocked it)."""
    amount = XP_VALUES.get(reason)
    if not amount:
        return 0

    if once_per_reference and reference_id is not None:
        existing = await db.execute(
            select(XPEvent.id).where(
                XPEvent.learner_id == learner_id,
                XPEvent.reason == reason,
                XPEvent.reference_id == reference_id,
            ).limit(1)
        )
        if existing.scalar_one_or_none():
            return 0

    if once_per_day:
        start, end = _ist_day_bounds_utc()
        existing = await db.execute(
            select(XPEvent.id).where(
                XPEvent.learner_id == learner_id,
                XPEvent.reason == reason,
                XPEvent.created_at >= start,
                XPEvent.created_at < end,
            ).limit(1)
        )
        if existing.scalar_one_or_none():
            return 0

    db.add(XPEvent(
        learner_id=learner_id, amount=amount, reason=reason,
        reference_id=reference_id, reference_type=reference_type,
    ))
    return amount


async def grant_badge(db: AsyncSession, learner_id: str, badge_slug: str) -> bool:
    """Grant a badge if not already earned. Returns True if newly granted."""
    existing = await db.execute(
        select(LearnerBadge.id).where(
            LearnerBadge.learner_id == learner_id,
            LearnerBadge.badge_slug == badge_slug,
        ).limit(1)
    )
    if existing.scalar_one_or_none():
        return False
    db.add(LearnerBadge(learner_id=learner_id, badge_slug=badge_slug))

    from app.services.notifications import notify
    pretty = badge_slug.replace("_", " ").title()
    await notify(
        db, learner_id, "badge_earned",
        title=f"Badge earned: {pretty}",
        reference_id=badge_slug, reference_type="badge",
    )
    return True


async def record_activity(db: AsyncSession, learner_id: str) -> LearnerStreak:
    """Register a day of activity: maintain the streak, shields, and streak badges/XP."""
    today = datetime.now(IST).date()
    result = await db.execute(select(LearnerStreak).where(LearnerStreak.learner_id == learner_id))
    streak = result.scalar_one_or_none()

    if streak is None:
        streak = LearnerStreak(
            learner_id=learner_id, current_streak=1, longest_streak=1,
            last_activity_date=today, shield_available=False,
        )
        db.add(streak)
        return streak

    last = streak.last_activity_date
    if last == today:
        return streak

    if last == today - timedelta(days=1):
        streak.current_streak = (streak.current_streak or 0) + 1
    elif last == today - timedelta(days=2) and streak.shield_available:
        # Shield consumes itself to bridge the single missed day
        streak.shield_available = False
        streak.shield_used_date = today - timedelta(days=1)
        streak.current_streak = (streak.current_streak or 0) + 1
    else:
        streak.current_streak = 1

    streak.last_activity_date = today
    if streak.current_streak > (streak.longest_streak or 0):
        streak.longest_streak = streak.current_streak

    # Streak milestones: XP + badge + shield at 7 days
    cs = streak.current_streak
    if cs == 7:
        await award_xp(db, learner_id, "streak_7", once_per_day=True)
        await grant_badge(db, learner_id, "week_warrior")
        streak.shield_available = True
    elif cs == 14:
        await award_xp(db, learner_id, "streak_14", once_per_day=True)
        await grant_badge(db, learner_id, "fortnight_fighter")
    elif cs == 30:
        await award_xp(db, learner_id, "streak_30", once_per_day=True)
        await grant_badge(db, learner_id, "thirty_day_legend")

    return streak


async def check_day_completion(db: AsyncSession, learner_id: str, day_number: int) -> bool:
    """Mark a day completed when the lesson was viewed AND a quiz was submitted.

    On the completed transition, awards milestone badges and issues certificates.
    Returns True if the day is (now) completed.
    """
    result = await db.execute(
        select(LearnerDayProgress).where(
            LearnerDayProgress.learner_id == learner_id,
            LearnerDayProgress.day_number == day_number,
        )
    )
    progress = result.scalar_one_or_none()
    if progress is None:
        return False
    if progress.status == "completed":
        return True
    if not (progress.scroll_completed and (progress.quiz_attempts or 0) >= 1):
        return False

    progress.status = "completed"
    progress.completed_at = datetime.now(timezone.utc)

    await _award_completion_milestones(db, learner_id, day_number)
    return True


async def _award_completion_milestones(db: AsyncSession, learner_id: str, day_number: int) -> None:
    if day_number == 1:
        await grant_badge(db, learner_id, "day1_complete")
        await _issue_certificate(db, learner_id, tier=1)

    completed_days = (
        await db.execute(
            select(LearnerDayProgress.day_number).where(
                LearnerDayProgress.learner_id == learner_id,
                LearnerDayProgress.status == "completed",
            )
        )
    ).scalars().all()
    done = set(completed_days)

    # Phase badges: 6 phases of 5 days each
    phase = (day_number - 1) // 5 + 1
    phase_days = set(range((phase - 1) * 5 + 1, phase * 5 + 1))
    if phase_days <= done:
        await grant_badge(db, learner_id, f"phase{phase}_complete")

    if len(done) >= 30:
        await grant_badge(db, learner_id, "all_30_days")
        await _issue_certificate(db, learner_id, tier=2)

    # speed_runner: 5 days completed within a single IST calendar day
    start, end = _ist_day_bounds_utc()
    today_count = (
        await db.execute(
            select(func.count()).select_from(LearnerDayProgress).where(
                LearnerDayProgress.learner_id == learner_id,
                LearnerDayProgress.status == "completed",
                LearnerDayProgress.completed_at >= start,
                LearnerDayProgress.completed_at < end,
            )
        )
    ).scalar_one()
    if today_count >= 5:
        await grant_badge(db, learner_id, "speed_runner")


async def _issue_certificate(db: AsyncSession, learner_id: str, tier: int) -> None:
    existing = await db.execute(
        select(Certificate.id).where(
            Certificate.learner_id == learner_id, Certificate.tier == tier
        ).limit(1)
    )
    if existing.scalar_one_or_none():
        return
    db.add(Certificate(learner_id=learner_id, tier=tier, status="active"))
