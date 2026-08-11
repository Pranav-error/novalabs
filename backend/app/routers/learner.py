from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.gamification import LearnerBadge, LearnerStreak, XPEvent
from app.models.progress import LearnerDayProgress
from app.models.referral import ReferralCode, ReferralReward
from app.services.referral import get_or_create_referral_code
from app.models.social import Notification
from app.models.user import User
from app.models.push import PushSubscription
from app.core.config import settings
from app.services.push import push_enabled, send_push

router = APIRouter()


class UpdateProfileRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    bio: str | None = None
    portfolio_slug: str | None = None
    github_url: str | None = None
    linkedin_url: str | None = None


@router.get("")
async def get_profile(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    xp_result = await db.execute(
        select(func.sum(XPEvent.amount)).where(XPEvent.learner_id == user.id)
    )
    total_xp = xp_result.scalar() or 0

    progress_result = await db.execute(
        select(func.count()).where(
            LearnerDayProgress.learner_id == user.id,
            LearnerDayProgress.status == "completed",
        )
    )
    days_completed = progress_result.scalar() or 0

    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "email_verified": user.email_verified,
        "is_paid": user.paid_at is not None,
        "bio": user.bio,
        "portfolio_slug": user.portfolio_slug,
        "github_url": user.github_url,
        "linkedin_url": user.linkedin_url,
        "total_xp": total_xp,
        "days_completed": days_completed,
        "created_at": user.created_at,
    }


@router.patch("")
async def update_profile(
    req: UpdateProfileRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    for field, value in req.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    return {"message": "Profile updated"}


@router.get("/progress")
async def get_progress(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(LearnerDayProgress).where(LearnerDayProgress.learner_id == user.id)
    )
    progress = result.scalars().all()
    return [
        {
            "day_number": p.day_number,
            "status": p.status,
            "best_quiz_score": p.best_quiz_score,
            "started_at": p.started_at,
            "completed_at": p.completed_at,
        }
        for p in progress
    ]


@router.get("/xp")
async def get_xp(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    total_result = await db.execute(
        select(func.sum(XPEvent.amount)).where(XPEvent.learner_id == user.id)
    )
    events_result = await db.execute(
        select(XPEvent).where(XPEvent.learner_id == user.id).order_by(XPEvent.created_at.desc()).limit(20)
    )
    return {
        "total_xp": total_result.scalar() or 0,
        "recent_events": [
            {"amount": e.amount, "reason": e.reason, "created_at": e.created_at}
            for e in events_result.scalars().all()
        ],
    }


@router.get("/badges")
async def get_badges(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(LearnerBadge).where(LearnerBadge.learner_id == user.id).order_by(LearnerBadge.earned_at.desc())
    )
    return [{"badge_slug": b.badge_slug, "earned_at": b.earned_at} for b in result.scalars().all()]


@router.get("/notifications")
async def get_notifications(
    limit: int = 20,
    before: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    limit = min(max(limit, 1), 100)
    query = (
        select(Notification)
        .where(Notification.recipient_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit + 1)
    )
    if before:
        anchor = await db.execute(select(Notification).where(Notification.id == before))
        anchor_row = anchor.scalar_one_or_none()
        if anchor_row:
            query = query.where(Notification.created_at < anchor_row.created_at)
    rows = (await db.execute(query)).scalars().all()
    next_cursor = rows[limit - 1].id if len(rows) > limit else None
    rows = rows[:limit]
    unread = (
        await db.execute(
            select(func.count()).select_from(Notification).where(
                Notification.recipient_id == user.id, Notification.is_read == False  # noqa: E712
            )
        )
    ).scalar_one()
    return {
        "notifications": [
            {
                "id": n.id,
                "type": n.type,
                "title": n.title,
                "body": n.body,
                "is_read": n.is_read,
                "created_at": n.created_at,
            }
            for n in rows
        ],
        "next_cursor": next_cursor,
        "unread_count": unread,
    }


class MarkReadRequest(BaseModel):
    ids: list[str] | None = None  # None = mark all as read


@router.patch("/notifications/read")
async def mark_notifications_read(
    req: MarkReadRequest | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        update(Notification)
        .where(Notification.recipient_id == user.id, Notification.is_read == False)  # noqa: E712
        .values(is_read=True)
    )
    if req and req.ids:
        stmt = stmt.where(Notification.id.in_(req.ids))
    result = await db.execute(stmt)
    return {"message": "Notifications marked as read", "updated": result.rowcount}


@router.get("/referral")
async def get_referral(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    code_result = await db.execute(
        select(ReferralCode).where(ReferralCode.owner_id == user.id, ReferralCode.is_active == True)
    )
    code = code_result.scalars().first()

    if code is None:
        # Accounts created before referral codes were issued at signup
        await get_or_create_referral_code(db, user.id, user.first_name)
        code_result = await db.execute(
            select(ReferralCode).where(
                ReferralCode.owner_id == user.id, ReferralCode.is_active == True
            )
        )
        code = code_result.scalars().first()

    referrals = []
    if code:
        rewards = (
            await db.execute(
                select(ReferralReward, User.first_name, User.last_name)
                .join(User, ReferralReward.referee_id == User.id)
                .where(ReferralReward.referrer_id == user.id)
                .order_by(ReferralReward.triggered_at.desc())
            )
        ).all()
        referrals = [
            {
                "referee_name": f"{fn} {ln[:1]}." if ln else fn,
                "status": r.status,
                "credit_paise": r.referrer_credit if r.status == "rewarded" else 0,
                "triggered_at": r.triggered_at,
            }
            for r, fn, ln in rewards
        ]
        # Signed-up-but-unpaid referees show as pending
        pending = (
            await db.execute(
                select(User.first_name, User.last_name).where(
                    User.referred_by_code == code.code, User.paid_at == None  # noqa: E711
                )
            )
        ).all()
        referrals += [
            {"referee_name": f"{fn} {ln[:1]}." if ln else fn, "status": "pending",
             "credit_paise": 0, "triggered_at": None}
            for fn, ln in pending
        ]

    return {
        "code": code.code if code else None,
        "referrals": referrals,
        "cashback_balance": user.platform_credit_balance or 0,
    }


@router.get("/settings")
async def get_settings(user: User = Depends(get_current_user)):
    return user.settings or {}


@router.patch("/settings")
async def update_settings(
    req: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    merged = dict(user.settings or {})
    merged.update(req or {})
    user.settings = merged
    return {"message": "Settings updated", "settings": merged}


# ── Web Push subscriptions ───────────────────────────────────────

class PushSubscribeRequest(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


@router.get("/push/key")
async def push_public_key():
    """VAPID public key the browser needs to subscribe. Empty when push is off."""
    return {"public_key": settings.VAPID_PUBLIC_KEY, "enabled": push_enabled()}


@router.post("/push/subscribe")
async def push_subscribe(
    req: PushSubscribeRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register this browser. Idempotent — re-subscribing refreshes the keys,
    which browsers rotate, and re-points the row if the account changed."""
    if not push_enabled():
        raise HTTPException(status_code=503, detail="Push is not configured")

    existing = (
        await db.execute(
            select(PushSubscription).where(PushSubscription.endpoint == req.endpoint)
        )
    ).scalar_one_or_none()

    if existing:
        existing.user_id = user.id
        existing.p256dh = req.p256dh
        existing.auth = req.auth
    else:
        db.add(
            PushSubscription(
                user_id=user.id,
                endpoint=req.endpoint,
                p256dh=req.p256dh,
                auth=req.auth,
                user_agent=(request.headers.get("user-agent") or "")[:255],
            )
        )
    return {"message": "Subscribed"}


@router.delete("/push/subscribe")
async def push_unsubscribe(
    endpoint: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sub = (
        await db.execute(
            select(PushSubscription).where(
                PushSubscription.endpoint == endpoint,
                PushSubscription.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if sub:
        await db.delete(sub)
    return {"message": "Unsubscribed"}


@router.post("/push/test")
async def push_test(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Send a push to the caller's own browsers, so a learner (or admin) can
    confirm notifications actually arrive before relying on them."""
    sent = await send_push(
        db, user.id, "Notifications are on", "You'll get updates here.", "/dashboard"
    )
    return {"delivered": sent}
