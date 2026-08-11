from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.gamification import LearnerStreak, XPEvent
from app.models.user import User

router = APIRouter()

IST = timezone(timedelta(hours=5, minutes=30))


def _week_start_utc() -> datetime:
    """Start of the current week (Monday 00:00 IST) in UTC."""
    now_ist = datetime.now(IST)
    week_start_ist = (now_ist - timedelta(days=now_ist.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return week_start_ist.astimezone(timezone.utc)


async def _build_leaderboard(db: AsyncSession, current_user: User, since: datetime | None):
    query = (
        select(XPEvent.learner_id, func.sum(XPEvent.amount).label("total"))
        .group_by(XPEvent.learner_id)
        .order_by(func.sum(XPEvent.amount).desc())
    )
    if since is not None:
        query = query.where(XPEvent.created_at >= since)

    rows = (await db.execute(query)).all()

    my_rank = None
    my_xp = 0
    leaders = []

    for i, row in enumerate(rows):
        rank = i + 1
        if row.learner_id == current_user.id:
            my_rank = rank
            my_xp = row.total

        if rank <= 10:
            user_result = await db.execute(select(User).where(User.id == row.learner_id))
            u = user_result.scalar_one_or_none()
            if u:
                leaders.append({
                    "rank": rank,
                    "name": f"{u.first_name} {u.last_name[0]}." if u.last_name else u.first_name,
                    "initials": f"{u.first_name[:1]}{u.last_name[:1]}".upper(),
                    "xp": row.total,
                    "is_me": u.id == current_user.id,
                })

    return {"leaderboard": leaders, "my_rank": my_rank, "my_xp": my_xp}


@router.get("/leaderboard/weekly")
async def weekly_leaderboard(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _build_leaderboard(db, user, since=_week_start_utc())


@router.get("/leaderboard/alltime")
async def alltime_leaderboard(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _build_leaderboard(db, user, since=None)


@router.get("/leaderboard/cohort")
async def cohort_leaderboard(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Cohorts not in use yet — fall back to all-time
    return await _build_leaderboard(db, user, since=None)


@router.get("/streaks/me")
async def get_streak(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LearnerStreak).where(LearnerStreak.learner_id == user.id))
    streak = result.scalar_one_or_none()
    if not streak:
        return {"current_streak": 0, "longest_streak": 0, "shield_available": False}
    return {
        "current_streak": streak.current_streak,
        "longest_streak": streak.longest_streak,
        "shield_available": streak.shield_available,
        "last_activity_date": streak.last_activity_date,
    }
