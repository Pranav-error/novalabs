import csv
import io
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_admin
from app.core.security import create_access_token
from app.models.admin import AdminAuditLog
from app.models.certificate import Certificate
from app.models.content import Day, DayMaterial, DayRubricItem, DayVideo, MCQQuestion, Phase
from app.models.gamification import LearnerBadge, XPEvent
from app.models.payment import Coupon, PaymentOrder, RefundRequest
from app.models.progress import LearnerDayProgress, LearnerNote, QuizAttempt, Submission
from app.models.referral import ReferralCode, ReferralReward
from app.models.social import Announcement, FeedPost, FeedReply, FeedReport
from app.models.user import User
from app.services.curriculum import learner_data_counts, next_day_number, renumber_days
from app.services.notifications import notify, push_target
from app.services.push import send_push_many
from app.services.platform_settings import (
    REFERRAL_CREDIT_PAISE,
    REFERRAL_DISCOUNT_PAISE,
    get_settings,
    set_setting,
)
from app.services.storage import delete_file, store_file
from app.services.videos import normalize_video_url

router = APIRouter()


# ── Pydantic Models ──────────────────────────────────────────────

class ModifyUserRequest(BaseModel):
    is_suspended: bool | None = None
    suspension_reason: str | None = None
    role: str | None = None
    paid_at: str | None = None  # ISO string or "grant"/"revoke"


class ScoreSubmissionRequest(BaseModel):
    score: int
    feedback: str | None = None
    # {rubric_item_id: points_awarded} when scored against a rubric.
    rubric_breakdown: dict[str, int] | None = None


class CreateCouponRequest(BaseModel):
    code: str
    discount_type: str  # "flat" or "percentage"
    discount_value: int
    max_discount: int | None = None
    total_usage_limit: int | None = None
    per_user_limit: int = 1
    description: str | None = None


class UpdateCouponRequest(BaseModel):
    is_active: bool | None = None
    total_usage_limit: int | None = None
    description: str | None = None


class CreateAnnouncementRequest(BaseModel):
    title: str
    body: str | None = None
    urgency: str = "normal"


# ── Platform Stats ───────────────────────────────────────────────

@router.get("/stats")
async def platform_stats(admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar() or 0
    paid_users = (await db.execute(
        select(func.count()).select_from(User).where(User.paid_at.isnot(None))
    )).scalar() or 0
    total_revenue = (await db.execute(
        select(func.sum(PaymentOrder.amount_paise)).where(PaymentOrder.status == "paid")
    )).scalar() or 0
    total_submissions = (await db.execute(select(func.count()).select_from(Submission))).scalar() or 0
    pending_submissions = (await db.execute(
        select(func.count()).select_from(Submission).where(Submission.status == "pending")
    )).scalar() or 0
    return {
        "total_users": total_users,
        "paid_users": paid_users,
        "free_users": total_users - paid_users,
        "total_revenue_paise": total_revenue,
        "total_submissions": total_submissions,
        "pending_submissions": pending_submissions,
    }


# ── User Management ─────────────────────────────────────────────

@router.get("/users")
async def list_users(
    page: int = 1,
    limit: int = 20,
    search: str | None = None,
    role: str | None = None,
    paid: bool | None = None,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(User).order_by(User.created_at.desc())
    count_query = select(func.count()).select_from(User)

    if search:
        pattern = f"%{search}%"
        query = query.where(User.email.ilike(pattern) | User.first_name.ilike(pattern) | User.last_name.ilike(pattern))
        count_query = count_query.where(User.email.ilike(pattern) | User.first_name.ilike(pattern) | User.last_name.ilike(pattern))
    if role:
        query = query.where(User.role == role)
        count_query = count_query.where(User.role == role)
    if paid is True:
        query = query.where(User.paid_at.isnot(None))
        count_query = count_query.where(User.paid_at.isnot(None))
    elif paid is False:
        query = query.where(User.paid_at.is_(None))
        count_query = count_query.where(User.paid_at.is_(None))

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * limit
    result = await db.execute(query.offset(offset).limit(limit))
    users = result.scalars().all()

    return {
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "role": u.role,
                "is_paid": u.paid_at is not None,
                "is_suspended": u.is_suspended,
                "created_at": u.created_at,
            }
            for u in users
        ],
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }


@router.get("/users/{user_id}")
async def get_user(user_id: str, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    progress_result = await db.execute(
        select(LearnerDayProgress).where(LearnerDayProgress.learner_id == user_id)
    )
    progress = progress_result.scalars().all()

    sub_count = (await db.execute(
        select(func.count()).select_from(Submission).where(Submission.learner_id == user_id)
    )).scalar() or 0

    return {
        "id": u.id,
        "email": u.email,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "role": u.role,
        "bio": u.bio,
        "is_paid": u.paid_at is not None,
        "paid_at": u.paid_at,
        "is_suspended": u.is_suspended,
        "suspension_reason": u.suspension_reason,
        "email_verified": u.email_verified,
        "github_url": u.github_url,
        "linkedin_url": u.linkedin_url,
        "created_at": u.created_at,
        "days_progress": [
            {"day_number": p.day_number, "status": p.status, "best_quiz_score": p.best_quiz_score}
            for p in progress
        ],
        "total_submissions": sub_count,
    }


@router.patch("/users/{user_id}")
async def modify_user(
    user_id: str,
    req: ModifyUserRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    if req.is_suspended is not None:
        u.is_suspended = req.is_suspended
        u.suspension_reason = req.suspension_reason
    if req.role and req.role in ("learner", "mentor", "admin"):
        u.role = req.role
    if req.paid_at == "grant":
        u.paid_at = datetime.now(timezone.utc)
    elif req.paid_at == "revoke":
        u.paid_at = None

    await db.commit()

    log = AdminAuditLog(
        admin_id=admin.id,
        action_type="modify_user",
        target_id=user_id,
        target_type="user",
        payload_after=req.model_dump(exclude_unset=True),
    )
    db.add(log)
    await db.commit()

    return {"message": "User updated"}


@router.post("/users/{user_id}/impersonate")
async def impersonate(user_id: str, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    token = create_access_token({"sub": u.id, "type": "access"})

    log = AdminAuditLog(
        admin_id=admin.id,
        action_type="impersonate",
        target_id=user_id,
        target_type="user",
    )
    db.add(log)
    await db.commit()

    return {"access_token": token}


# ── Day Management ───────────────────────────────────────────────

@router.get("/days")
async def list_days(admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """Every topic, flat and also grouped by module so the UI can show the tree."""
    days = (await db.execute(select(Day).order_by(Day.day_number))).scalars().all()
    phases = (await db.execute(select(Phase).order_by(Phase.display_order))).scalars().all()

    def serialize(d: Day) -> dict:
        return {
            "id": d.id,
            "phase_id": d.phase_id,
            "day_number": d.day_number,
            "title": d.title,
            "is_published": d.is_published,
            "language": d.language,
        }

    by_phase: dict[str, list[dict]] = {}
    for d in days:
        by_phase.setdefault(d.phase_id, []).append(serialize(d))

    return {
        # Flat list kept for existing callers.
        "days": [serialize(d) for d in days],
        "modules": [
            {
                "id": p.id,
                "name": p.name,
                "display_order": p.display_order,
                "is_published": p.is_published,
                "accent_color": p.accent_color,
                "days": by_phase.get(p.id, []),
            }
            for p in phases
        ],
        # Topics whose module was deleted out from under them, if any.
        "orphan_days": [
            serialize(d) for d in days if d.phase_id not in {p.id for p in phases}
        ],
    }


# ── Modules (phases) ─────────────────────────────────────────────
# Called "modules" in the admin UI; the table stays `phases`.

class PhaseCreateRequest(BaseModel):
    name: str
    description: str | None = None
    tagline: str | None = None
    accent_color: str = "#2F67C7"
    skills_list: list[str] = []


class PhaseUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    tagline: str | None = None
    accent_color: str | None = None
    skills_list: list[str] | None = None


class ReorderItem(BaseModel):
    id: str
    display_order: int


class ReorderRequest(BaseModel):
    items: list[ReorderItem]


@router.get("/phases")
async def list_phases_admin(
    admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)
):
    """All modules including unpublished ones, with topic counts."""
    phases = (await db.execute(select(Phase).order_by(Phase.display_order))).scalars().all()
    counts = dict(
        (
            await db.execute(select(Day.phase_id, func.count()).group_by(Day.phase_id))
        ).all()
    )
    return {
        "phases": [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "tagline": p.tagline,
                "accent_color": p.accent_color,
                "skills_list": p.skills_list,
                "display_order": p.display_order,
                "is_published": p.is_published,
                "day_count": counts.get(p.id, 0),
            }
            for p in phases
        ]
    }


@router.post("/phases")
async def create_phase(
    req: PhaseCreateRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    highest = (await db.execute(select(func.max(Phase.display_order)))).scalar()
    phase = Phase(
        name=req.name,
        description=req.description,
        tagline=req.tagline,
        accent_color=req.accent_color,
        skills_list=req.skills_list,
        display_order=(highest or 0) + 1,
        is_published=False,
    )
    db.add(phase)
    await db.flush()
    db.add(AdminAuditLog(
        admin_id=admin.id, action_type="content.phase.create",
        target_id=phase.id, target_type="phase",
        payload_after={"name": phase.name, "display_order": phase.display_order},
    ))
    return {"id": phase.id, "display_order": phase.display_order, "message": "Module created"}


@router.patch("/phases/{phase_id}")
async def update_phase(
    phase_id: str,
    req: PhaseUpdateRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    phase = (await db.execute(select(Phase).where(Phase.id == phase_id))).scalar_one_or_none()
    if not phase:
        raise HTTPException(status_code=404, detail="Module not found")

    changed = {}
    for field in ("name", "description", "tagline", "accent_color", "skills_list"):
        value = getattr(req, field)
        if value is not None:
            changed[field] = value
            setattr(phase, field, value)

    if changed:
        db.add(AdminAuditLog(
            admin_id=admin.id, action_type="content.phase.edit",
            target_id=phase.id, target_type="phase", payload_after=changed,
        ))
    return {"message": "Module updated", "fields_changed": list(changed)}


@router.delete("/phases/{phase_id}")
async def delete_phase(
    phase_id: str, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)
):
    phase = (await db.execute(select(Phase).where(Phase.id == phase_id))).scalar_one_or_none()
    if not phase:
        raise HTTPException(status_code=404, detail="Module not found")

    day_count = (
        await db.execute(select(func.count()).select_from(Day).where(Day.phase_id == phase_id))
    ).scalar() or 0
    if day_count:
        raise HTTPException(
            status_code=400,
            detail=f"Module still has {day_count} topic(s). Move or delete them first.",
        )

    await db.delete(phase)
    db.add(AdminAuditLog(
        admin_id=admin.id, action_type="content.phase.delete",
        target_id=phase_id, target_type="phase", payload_after={"name": phase.name},
    ))
    return {"message": "Module deleted"}


@router.patch("/phases/{phase_id}/publish")
async def toggle_phase_publish(
    phase_id: str, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)
):
    phase = (await db.execute(select(Phase).where(Phase.id == phase_id))).scalar_one_or_none()
    if not phase:
        raise HTTPException(status_code=404, detail="Module not found")
    phase.is_published = not phase.is_published
    db.add(AdminAuditLog(
        admin_id=admin.id, action_type="content.phase.publish_toggle",
        target_id=phase.id, target_type="phase",
        payload_after={"is_published": phase.is_published},
    ))
    return {"id": phase.id, "is_published": phase.is_published}


@router.post("/phases/reorder")
async def reorder_phases(
    req: ReorderRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Safe to do directly — no learner data keys off a phase."""
    phases = (await db.execute(select(Phase))).scalars().all()
    by_id = {p.id: p for p in phases}
    unknown = [i.id for i in req.items if i.id not in by_id]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown module(s): {unknown}")

    for item in req.items:
        by_id[item.id].display_order = item.display_order

    db.add(AdminAuditLog(
        admin_id=admin.id, action_type="content.phase.reorder",
        target_id=None, target_type="phase",
        payload_after={"order": [i.id for i in sorted(req.items, key=lambda x: x.display_order)]},
    ))
    return {"message": "Modules reordered", "count": len(req.items)}


# ── Submissions ──────────────────────────────────────────────────

@router.get("/submissions/pending")
async def pending_submissions(
    page: int = 1,
    limit: int = 20,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    count = (await db.execute(
        select(func.count()).select_from(Submission).where(Submission.status == "pending")
    )).scalar() or 0

    offset = (page - 1) * limit
    result = await db.execute(
        select(Submission)
        .where(Submission.status == "pending")
        .order_by(Submission.submitted_at.asc())
        .offset(offset)
        .limit(limit)
    )
    subs = result.scalars().all()

    items = []
    for s in subs:
        user_result = await db.execute(select(User).where(User.id == s.learner_id))
        u = user_result.scalar_one_or_none()
        items.append({
            "id": s.id,
            "day_number": s.day_number,
            "learner_name": f"{u.first_name} {u.last_name}" if u else "Unknown",
            "learner_email": u.email if u else "",
            "submission_type": s.submission_type,
            "submitted_at": s.submitted_at,
            "status": s.status,
        })

    return {"submissions": items, "total": count}


@router.get("/submissions/{sub_id}")
async def view_submission(sub_id: str, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Submission).where(Submission.id == sub_id))
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Submission not found")

    user_result = await db.execute(select(User).where(User.id == s.learner_id))
    u = user_result.scalar_one_or_none()

    # The topic's rubric, so scoring can be per-criterion instead of one number.
    rubric_items = (
        await db.execute(
            select(DayRubricItem)
            .join(Day, Day.id == DayRubricItem.day_id)
            .where(Day.day_number == s.day_number)
            .order_by(DayRubricItem.display_order)
        )
    ).scalars().all()

    return {
        "id": s.id,
        "day_number": s.day_number,
        "learner_id": s.learner_id,
        "learner_name": f"{u.first_name} {u.last_name}" if u else "Unknown",
        "submission_type": s.submission_type,
        "content": s.content,
        "github_url": s.github_url,
        "live_url": s.live_url,
        "status": s.status,
        "score": s.score,
        "feedback": s.feedback,
        "rubric_breakdown": s.rubric_breakdown,
        "rubric_items": [
            {
                "id": r.id, "name": r.name, "description": r.description,
                "max_points": r.max_points, "pass_fail_criteria": r.pass_fail_criteria,
            }
            for r in rubric_items
        ],
        "submitted_at": s.submitted_at,
        "reviewed_at": s.reviewed_at,
    }


@router.patch("/submissions/{sub_id}/score")
async def score_submission(
    sub_id: str,
    req: ScoreSubmissionRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Submission).where(Submission.id == sub_id))
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Submission not found")

    if req.rubric_breakdown is not None:
        items = (
            await db.execute(
                select(DayRubricItem)
                .join(Day, Day.id == DayRubricItem.day_id)
                .where(Day.day_number == s.day_number)
            )
        ).scalars().all()
        caps = {i.id: i.max_points for i in items}
        unknown = set(req.rubric_breakdown) - set(caps)
        if unknown:
            raise HTTPException(status_code=400, detail=f"Unknown rubric item(s): {sorted(unknown)}")
        over = {
            k: v for k, v in req.rubric_breakdown.items() if v < 0 or v > caps[k]
        }
        if over:
            raise HTTPException(
                status_code=400,
                detail=f"Points outside 0..max_points for rubric item(s): {sorted(over)}",
            )
        s.rubric_breakdown = req.rubric_breakdown

    s.score = req.score
    s.feedback = req.feedback
    s.status = "scored"
    s.mentor_id = admin.id
    s.reviewed_at = datetime.now(timezone.utc)

    await notify(
        db, s.learner_id, "submission_scored",
        title=f"Day {s.day_number} assignment scored: {req.score}",
        body=req.feedback,
        reference_id=s.id, reference_type="submission",
    )
    await db.commit()

    return {"message": "Submission scored"}


# ── Coupons ──────────────────────────────────────────────────────

@router.get("/coupons")
async def list_coupons(admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Coupon).order_by(Coupon.created_at.desc()))
    coupons = result.scalars().all()
    return {
        "coupons": [
            {
                "id": c.id,
                "code": c.code,
                "discount_type": c.discount_type,
                "discount_value": c.discount_value,
                "max_discount": c.max_discount,
                "times_used": c.times_used,
                "total_usage_limit": c.total_usage_limit,
                "is_active": c.is_active,
                "description": c.description,
                "created_at": c.created_at,
            }
            for c in coupons
        ]
    }


@router.post("/coupons")
async def create_coupon(
    req: CreateCouponRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    coupon = Coupon(
        code=req.code.upper(),
        discount_type=req.discount_type,
        discount_value=req.discount_value,
        max_discount=req.max_discount,
        total_usage_limit=req.total_usage_limit,
        per_user_limit=req.per_user_limit,
        description=req.description,
        created_by=admin.id,
    )
    db.add(coupon)
    await db.commit()
    return {"message": "Coupon created", "id": coupon.id}


@router.patch("/coupons/{coupon_id}")
async def update_coupon(
    coupon_id: str,
    req: UpdateCouponRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Coupon).where(Coupon.id == coupon_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Coupon not found")

    for field, value in req.model_dump(exclude_unset=True).items():
        setattr(c, field, value)
    await db.commit()
    return {"message": "Coupon updated"}


@router.delete("/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Coupon).where(Coupon.id == coupon_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Coupon not found")
    c.is_active = False
    await db.commit()
    return {"message": "Coupon deactivated"}


# ── Certificates ─────────────────────────────────────────────────

@router.get("/certificates/pending")
async def pending_certificates(admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Certificate).where(Certificate.status == "active").order_by(Certificate.issued_at.desc())
    )
    certs = result.scalars().all()
    items = []
    for c in certs:
        user_result = await db.execute(select(User).where(User.id == c.learner_id))
        u = user_result.scalar_one_or_none()
        items.append({
            "id": c.id,
            "tier": c.tier,
            "learner_name": f"{u.first_name} {u.last_name}" if u else "Unknown",
            "issued_at": c.issued_at,
            "status": c.status,
        })
    return {"certificates": items}


@router.post("/certificates/{cert_id}/approve")
async def approve_certificate(cert_id: str, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Certificate).where(Certificate.id == cert_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Certificate not found")
    c.status = "active"
    await db.commit()
    return {"message": "Certificate approved"}


@router.post("/certificates/{cert_id}/revoke")
async def revoke_certificate(cert_id: str, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Certificate).where(Certificate.id == cert_id))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Certificate not found")
    c.status = "revoked"
    await db.commit()
    return {"message": "Certificate revoked"}


# ── Announcements ────────────────────────────────────────────────

@router.post("/announcements")
async def create_announcement(
    req: CreateAnnouncementRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    ann = Announcement(
        author_id=admin.id,
        title=req.title,
        body=req.body,
        urgency=req.urgency,
        status="sent",
        sent_at=datetime.now(timezone.utc),
    )
    db.add(ann)
    await db.commit()
    return {"message": "Announcement created", "id": ann.id}


class SendNotificationRequest(BaseModel):
    title: str
    body: str | None = None
    # "all" | "paid" | "unpaid" | "user"
    audience: str = "all"
    user_id: str | None = None
    # Also record it as an announcement on the dashboard.
    also_announce: bool = False


@router.post("/notifications")
async def send_notification(
    req: SendNotificationRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Push an in-app notification to a group of learners.

    These land in the bell via GET /me/notifications. Announcements alone
    don't do that — they only render on the dashboard — so this is the way
    to actually reach someone.
    """
    if not req.title.strip():
        raise HTTPException(status_code=400, detail="Title is required")

    stmt = select(User.id).where(User.is_suspended == False)  # noqa: E712
    if req.audience == "paid":
        stmt = stmt.where(User.paid_at.isnot(None))
    elif req.audience == "unpaid":
        stmt = stmt.where(User.paid_at.is_(None))
    elif req.audience == "user":
        if not req.user_id:
            raise HTTPException(status_code=400, detail="user_id is required for audience 'user'")
        stmt = stmt.where(User.id == req.user_id)
    elif req.audience != "all":
        raise HTTPException(
            status_code=400, detail="audience must be one of: all, paid, unpaid, user"
        )

    recipients = (await db.execute(stmt)).scalars().all()
    if not recipients:
        raise HTTPException(status_code=400, detail="No recipients match that audience")

    # Rows first, then push everyone at once. Pushing inside the loop made a
    # broadcast cost the sum of every recipient's round trip.
    for rid in recipients:
        await notify(
            db, rid, "admin_message", title=req.title, body=req.body,
            reference_type="admin_notification", push=False,
        )
    await send_push_many(
        db, list(recipients), req.title, req.body, push_target("admin_message")
    )

    announcement_id = None
    if req.also_announce:
        ann = Announcement(
            author_id=admin.id, title=req.title, body=req.body or "",
            urgency="normal", status="sent", sent_at=datetime.now(timezone.utc),
        )
        db.add(ann)
        await db.flush()
        announcement_id = ann.id

    db.add(AdminAuditLog(
        admin_id=admin.id, action_type="notification.send",
        target_id=req.user_id, target_type="notification",
        payload_after={
            "title": req.title, "audience": req.audience,
            "recipients": len(recipients), "announced": req.also_announce,
        },
    ))
    return {
        "message": f"Sent to {len(recipients)} learner(s)",
        "recipients": len(recipients),
        "announcement_id": announcement_id,
    }


@router.get("/announcements")
async def list_announcements(admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Announcement).order_by(Announcement.created_at.desc()))
    anns = result.scalars().all()
    return {
        "announcements": [
            {
                "id": a.id,
                "title": a.title,
                "body": a.body,
                "urgency": a.urgency,
                "status": a.status,
                "created_at": a.created_at,
            }
            for a in anns
        ]
    }


@router.delete("/announcements/{ann_id}")
async def delete_announcement(ann_id: str, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Announcement).where(Announcement.id == ann_id))
    ann = result.scalar_one_or_none()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    ann.status = "cancelled"
    await db.commit()
    return {"message": "Announcement deleted"}


# ── Audit Logs ───────────────────────────────────────────────────

@router.get("/audit-logs")
async def audit_logs(
    page: int = 1,
    limit: int = 50,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * limit
    result = await db.execute(
        select(AdminAuditLog).order_by(AdminAuditLog.created_at.desc()).offset(offset).limit(limit)
    )
    logs = result.scalars().all()
    return {
        "logs": [
            {
                "id": l.id,
                "admin_id": l.admin_id,
                "action_type": l.action_type,
                "target_type": l.target_type,
                "target_id": l.target_id,
                "created_at": l.created_at,
            }
            for l in logs
        ]
    }


# ── Payments Report ──────────────────────────────────────────────

@router.get("/payments")
async def payment_report(
    page: int = 1,
    limit: int = 20,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * limit
    count = (await db.execute(select(func.count()).select_from(PaymentOrder))).scalar() or 0
    result = await db.execute(
        select(PaymentOrder).order_by(PaymentOrder.created_at.desc()).offset(offset).limit(limit)
    )
    payments = result.scalars().all()

    items = []
    for p in payments:
        user_result = await db.execute(select(User).where(User.id == p.learner_id))
        u = user_result.scalar_one_or_none()
        items.append({
            "id": p.id,
            "learner_name": f"{u.first_name} {u.last_name}" if u else "Unknown",
            "amount_paise": p.amount_paise,
            "status": p.status,
            "razorpay_order_id": p.razorpay_order_id,
            "coupon_code": p.coupon_code,
            "referral_code": p.referral_code,
            "created_at": p.created_at,
            "paid_at": p.paid_at,
        })

    return {"payments": items, "total": count}


# ── Content editor ───────────────────────────────────────────────

class DayUpdateRequest(BaseModel):
    title: str | None = None
    estimated_time: str | None = None
    lesson_content: str | None = None
    assignment_prompt: str | None = None
    assignment_type: str | None = None
    starter_code: str | None = None
    reference_solution: str | None = None
    language: str | None = None
    # Moving a topic to another module. Only regroups it — the day number and
    # every learner record keyed to it are untouched.
    phase_id: str | None = None


@router.get("/days/{day_id}")
async def get_day_admin(
    day_id: str, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Day).where(Day.id == day_id))
    day = result.scalar_one_or_none()
    if not day:
        raise HTTPException(status_code=404, detail="Day not found")
    mcqs = (
        await db.execute(
            select(MCQQuestion).where(MCQQuestion.day_id == day.id).order_by(MCQQuestion.display_order)
        )
    ).scalars().all()
    videos = (
        await db.execute(
            select(DayVideo).where(DayVideo.day_id == day.id).order_by(DayVideo.display_order)
        )
    ).scalars().all()
    materials = (
        await db.execute(
            select(DayMaterial).where(DayMaterial.day_id == day.id).order_by(DayMaterial.display_order)
        )
    ).scalars().all()
    rubric_items = (
        await db.execute(
            select(DayRubricItem)
            .where(DayRubricItem.day_id == day.id)
            .order_by(DayRubricItem.display_order)
        )
    ).scalars().all()
    return {
        "id": day.id,
        "phase_id": day.phase_id,
        "day_number": day.day_number,
        "title": day.title,
        "estimated_time": day.estimated_time,
        "lesson_content": day.lesson_content,
        "assignment_prompt": day.assignment_prompt,
        "assignment_type": day.assignment_type,
        "starter_code": day.starter_code,
        "reference_solution": day.reference_solution,
        "language": day.language,
        "is_published": day.is_published,
        "version": day.version,
        "videos": [
            {
                "id": v.id, "title": v.title, "video_type": v.video_type,
                "video_url": v.video_url, "duration_minutes": v.duration_minutes,
                "display_order": v.display_order,
            }
            for v in videos
        ],
        "materials": [
            {
                "id": m.id, "title": m.title, "file_url": m.file_url,
                "file_type": m.file_type, "file_size_bytes": m.file_size_bytes,
                "display_order": m.display_order,
            }
            for m in materials
        ],
        "mcqs": [
            {
                "id": m.id,
                "question_text": m.question_text,
                "options": m.options,
                "correct_option_index": m.correct_option_index,
                "explanation": m.explanation,
                "display_order": m.display_order,
            }
            for m in mcqs
        ],
        "rubric_items": [
            {
                "id": r.id, "name": r.name, "description": r.description,
                "max_points": r.max_points, "pass_fail_criteria": r.pass_fail_criteria,
                "display_order": r.display_order,
            }
            for r in rubric_items
        ],
    }


@router.put("/days/{day_id}")
async def update_day(
    day_id: str,
    req: DayUpdateRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Day).where(Day.id == day_id))
    day = result.scalar_one_or_none()
    if not day:
        raise HTTPException(status_code=404, detail="Day not found")

    if req.phase_id is not None and req.phase_id != day.phase_id:
        target = (
            await db.execute(select(Phase).where(Phase.id == req.phase_id))
        ).scalar_one_or_none()
        if not target:
            raise HTTPException(status_code=404, detail="Target module not found")

    changed = {}
    for field in (
        "title", "estimated_time", "lesson_content", "assignment_prompt",
        "assignment_type", "starter_code", "reference_solution", "language",
        "phase_id",
    ):
        value = getattr(req, field)
        if value is not None:
            changed[field] = {"before": getattr(day, field), "after": value}
            setattr(day, field, value)

    if changed:
        day.version = (day.version or 1) + 1
        day.updated_at = datetime.now(timezone.utc)
        db.add(AdminAuditLog(
            admin_id=admin.id, action_type="content.day.edit",
            target_id=day.id, target_type="day",
            payload_after={k: v["after"] for k, v in changed.items()},
        ))
    return {"message": "Day updated", "version": day.version, "fields_changed": list(changed)}


@router.patch("/days/{day_id}/publish")
async def toggle_day_publish(
    day_id: str, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Day).where(Day.id == day_id))
    day = result.scalar_one_or_none()
    if not day:
        raise HTTPException(status_code=404, detail="Day not found")
    day.is_published = not day.is_published
    day.is_draft = not day.is_published
    db.add(AdminAuditLog(
        admin_id=admin.id, action_type="content.day.publish_toggle",
        target_id=day.id, target_type="day",
        payload_after={"is_published": day.is_published},
    ))
    return {"day_number": day.day_number, "is_published": day.is_published}


# ── Topics (days): create, delete, reorder ───────────────────────
# Called "topics" in the admin UI; the table stays `days`.

class DayCreateRequest(BaseModel):
    phase_id: str
    title: str
    estimated_time: str | None = None
    language: str = "html"
    assignment_type: str = "code"
    # Slot the topic in after this day number instead of appending at the end.
    insert_after: int | None = None


class DayReorderItem(BaseModel):
    id: str
    day_number: int


class DayReorderRequest(BaseModel):
    items: list[DayReorderItem]


@router.post("/days")
async def create_day(
    req: DayCreateRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    phase = (await db.execute(select(Phase).where(Phase.id == req.phase_id))).scalar_one_or_none()
    if not phase:
        raise HTTPException(status_code=404, detail="Module not found")

    if req.insert_after is None:
        day_number = await next_day_number(db)
    else:
        # Shift everything after the anchor up one, then take the freed slot.
        later = (
            await db.execute(
                select(Day.day_number)
                .where(Day.day_number > req.insert_after)
                .order_by(Day.day_number.desc())
            )
        ).scalars().all()
        if later:
            try:
                await renumber_days(db, {n: n + 1 for n in later})
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
        day_number = req.insert_after + 1

    day = Day(
        phase_id=req.phase_id,
        day_number=day_number,
        title=req.title,
        estimated_time=req.estimated_time,
        language=req.language,
        assignment_type=req.assignment_type,
        is_published=False,
        is_draft=True,
    )
    db.add(day)
    await db.flush()
    db.add(AdminAuditLog(
        admin_id=admin.id, action_type="content.day.create",
        target_id=day.id, target_type="day",
        payload_after={"day_number": day_number, "title": req.title, "phase_id": req.phase_id},
    ))
    return {"id": day.id, "day_number": day_number, "message": "Topic created"}


@router.delete("/days/{day_id}")
async def delete_day(
    day_id: str,
    force: bool = False,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a topic and everything attached to it.

    Refuses while learners have progress, quiz attempts, submissions or notes on
    it unless `force=true`, since that data is keyed by day_number and would be
    silently orphaned.
    """
    day = (await db.execute(select(Day).where(Day.id == day_id))).scalar_one_or_none()
    if not day:
        raise HTTPException(status_code=404, detail="Topic not found")

    counts = await learner_data_counts(db, day.day_number)
    total = sum(counts.values())
    if total and not force:
        raise HTTPException(
            status_code=400,
            detail={
                "message": f"{total} learner record(s) reference this topic.",
                "counts": counts,
                "hint": "Re-send with ?force=true to delete anyway.",
            },
        )

    # No DB-level cascade exists, so child content is removed explicitly and
    # any uploaded asset is released from storage first.
    videos = (
        await db.execute(select(DayVideo).where(DayVideo.day_id == day_id))
    ).scalars().all()
    for v in videos:
        if v.video_type == "upload":
            await delete_file(v.video_url, v.storage_public_id, "video")
        await db.delete(v)

    materials = (
        await db.execute(select(DayMaterial).where(DayMaterial.day_id == day_id))
    ).scalars().all()
    for m in materials:
        await delete_file(m.file_url, m.storage_public_id, "raw")
        await db.delete(m)

    for model in (MCQQuestion, DayRubricItem):
        for row in (
            await db.execute(select(model).where(model.day_id == day_id))
        ).scalars().all():
            await db.delete(row)

    day_number, day_title = day.day_number, day.title
    await db.delete(day)
    db.add(AdminAuditLog(
        admin_id=admin.id, action_type="content.day.delete",
        target_id=day_id, target_type="day",
        payload_after={
            "day_number": day_number, "title": day_title,
            "forced": force, "learner_records": counts,
        },
    ))
    return {
        "message": "Topic deleted",
        "day_number": day_number,
        "videos_deleted": len(videos),
        "materials_deleted": len(materials),
        "learner_records_orphaned": counts if force else {},
    }


@router.post("/days/reorder")
async def reorder_days(
    req: DayReorderRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Renumber topics, carrying every learner record along with them."""
    days = (await db.execute(select(Day))).scalars().all()
    by_id = {d.id: d for d in days}
    unknown = [i.id for i in req.items if i.id not in by_id]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown topic(s): {unknown}")

    mapping = {by_id[i.id].day_number: i.day_number for i in req.items}
    try:
        moved = await renumber_days(db, mapping)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    db.add(AdminAuditLog(
        admin_id=admin.id, action_type="content.day.reorder",
        target_id=None, target_type="day",
        payload_after={"mapping": {str(k): v for k, v in mapping.items()}, "rows_moved": moved},
    ))
    return {"message": "Topics reordered", "rows_moved": moved}


# ── Announcements: edit ──────────────────────────────────────────

class UpdateAnnouncementRequest(BaseModel):
    title: str | None = None
    body: str | None = None
    urgency: str | None = None


@router.patch("/announcements/{ann_id}")
async def update_announcement(
    ann_id: str,
    req: UpdateAnnouncementRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Announcement).where(Announcement.id == ann_id))
    ann = result.scalar_one_or_none()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    for field in ("title", "body", "urgency"):
        value = getattr(req, field)
        if value is not None:
            setattr(ann, field, value)
    return {"message": "Announcement updated"}


# ── Moderation queue ─────────────────────────────────────────────

@router.get("/reports")
async def list_reports(
    status_filter: str = "pending",
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(FeedReport).order_by(FeedReport.created_at.desc())
    if status_filter in ("pending", "resolved", "dismissed"):
        query = query.where(FeedReport.status == status_filter)
    reports = (await db.execute(query)).scalars().all()
    return {
        "reports": [
            {
                "id": r.id,
                "reporter_id": r.reporter_id,
                "target_id": r.target_id,
                "target_type": r.target_type,
                "reason": r.reason,
                "status": r.status,
                "created_at": r.created_at,
            }
            for r in reports
        ]
    }


class ResolveReportRequest(BaseModel):
    action: str  # "resolved" or "dismissed"
    resolution_note: str | None = None


@router.patch("/reports/{report_id}")
async def resolve_report(
    report_id: str,
    req: ResolveReportRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    if req.action not in ("resolved", "dismissed"):
        raise HTTPException(status_code=400, detail="action must be 'resolved' or 'dismissed'")
    result = await db.execute(select(FeedReport).where(FeedReport.id == report_id))
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.status = req.action
    report.resolution_note = req.resolution_note
    report.resolved_at = datetime.now(timezone.utc)
    db.add(AdminAuditLog(
        admin_id=admin.id, action_type="moderation.report.resolve",
        target_id=report.id, target_type="report",
        payload_after={"status": req.action},
    ))
    return {"message": f"Report {req.action}"}


# ── CSV exports ──────────────────────────────────────────────────

def _csv_response(header: list[str], rows: list[list], filename: str) -> Response:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    writer.writerows(rows)
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/export/users")
async def export_users(admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    users = (await db.execute(select(User).order_by(User.created_at))).scalars().all()
    rows = [
        [u.id, u.email, u.first_name, u.last_name, u.role,
         "paid" if u.paid_at else "free", u.created_at.isoformat() if u.created_at else ""]
        for u in users
    ]
    return _csv_response(
        ["id", "email", "first_name", "last_name", "role", "status", "created_at"],
        rows, "users.csv",
    )


@router.get("/export/certificates")
async def export_certificates(admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    certs = (
        await db.execute(
            select(Certificate, User.email, User.first_name, User.last_name)
            .join(User, Certificate.learner_id == User.id)
            .order_by(Certificate.issued_at)
        )
    ).all()
    rows = [
        [c.id, f"{fn} {ln}", email, c.tier, c.status,
         c.issued_at.isoformat() if c.issued_at else ""]
        for c, email, fn, ln in certs
    ]
    return _csv_response(
        ["certificate_id", "learner_name", "email", "tier", "status", "issued_at"],
        rows, "certificates.csv",
    )


# ══════════════════════════════════════════════════════════════════
#  Admin Console v2 — analytics, MCQ CRUD, user detail, refunds,
#  moderation with content
# ══════════════════════════════════════════════════════════════════

@router.get("/stats/timeseries")
async def stats_timeseries(
    days: int = 30,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Daily signups, revenue and conversions for the last N days, plus funnel."""
    days = min(max(days, 7), 90)
    since = datetime.now(timezone.utc) - timedelta(days=days)

    users = (await db.execute(
        select(User.created_at, User.paid_at).where(User.created_at >= since)
    )).all()
    orders = (await db.execute(
        select(PaymentOrder.paid_at, PaymentOrder.amount_paise).where(
            PaymentOrder.status == "paid", PaymentOrder.paid_at >= since
        )
    )).all()

    def day_key(dt):
        return dt.strftime("%Y-%m-%d") if dt else None

    buckets: dict[str, dict] = {}
    for i in range(days):
        d = (datetime.now(timezone.utc) - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
        buckets[d] = {"date": d, "signups": 0, "conversions": 0, "revenue_paise": 0}

    for created_at, paid_at in users:
        k = day_key(created_at)
        if k in buckets:
            buckets[k]["signups"] += 1
        pk = day_key(paid_at)
        if pk in buckets:
            buckets[pk]["conversions"] += 1
    for paid_at, amount in orders:
        k = day_key(paid_at)
        if k in buckets:
            buckets[k]["revenue_paise"] += amount or 0

    # Funnel + activity
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar() or 0
    paid_users = (await db.execute(
        select(func.count()).select_from(User).where(User.paid_at.isnot(None))
    )).scalar() or 0
    started_day1 = (await db.execute(
        select(func.count(func.distinct(LearnerDayProgress.learner_id)))
    )).scalar() or 0
    completed_day1 = (await db.execute(
        select(func.count()).select_from(LearnerDayProgress).where(
            LearnerDayProgress.day_number == 1, LearnerDayProgress.status == "completed"
        )
    )).scalar() or 0
    # "Completed everything" means every published topic, not a fixed 30.
    total_topics = (await db.execute(
        select(func.count()).select_from(Day).where(Day.is_published == True)  # noqa: E712
    )).scalar() or 0
    completed_all = (await db.execute(
        select(func.count(LearnerDayProgress.learner_id)).where(
            LearnerDayProgress.status == "completed"
        ).group_by(LearnerDayProgress.learner_id).having(func.count() >= total_topics)
    )).scalars().all() if total_topics else []

    day_ago = datetime.now(timezone.utc) - timedelta(days=1)
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    active_today = (await db.execute(
        select(func.count(func.distinct(XPEvent.learner_id))).where(XPEvent.created_at >= day_ago)
    )).scalar() or 0
    active_week = (await db.execute(
        select(func.count(func.distinct(XPEvent.learner_id))).where(XPEvent.created_at >= week_ago)
    )).scalar() or 0

    return {
        "series": list(buckets.values()),
        "funnel": {
            "signed_up": total_users,
            "started_day1": started_day1,
            "completed_day1": completed_day1,
            "paid": paid_users,
            "completed_all_30": len(completed_all),  # legacy key, now means "all topics"
            "completed_all": len(completed_all),
            "total_topics": total_topics,
        },
        "activity": {"active_today": active_today, "active_week": active_week},
        "conversion_rate": round(paid_users / total_users * 100, 1) if total_users else 0,
    }


# ── MCQ CRUD ─────────────────────────────────────────────────────

class MCQCreateRequest(BaseModel):
    question_text: str
    options: list[str]
    correct_option_index: int
    explanation: str | None = None
    display_order: int = 0


class MCQUpdateRequest(BaseModel):
    question_text: str | None = None
    options: list[str] | None = None
    correct_option_index: int | None = None
    explanation: str | None = None
    display_order: int | None = None


@router.post("/days/{day_id}/mcqs")
async def create_mcq(
    day_id: str, req: MCQCreateRequest,
    admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    day = (await db.execute(select(Day).where(Day.id == day_id))).scalar_one_or_none()
    if not day:
        raise HTTPException(status_code=404, detail="Day not found")
    if not (0 <= req.correct_option_index < len(req.options)):
        raise HTTPException(status_code=400, detail="correct_option_index out of range")
    mcq = MCQQuestion(
        day_id=day_id, question_text=req.question_text, options=req.options,
        correct_option_index=req.correct_option_index, explanation=req.explanation,
        display_order=req.display_order,
    )
    db.add(mcq)
    await db.flush()
    db.add(AdminAuditLog(admin_id=admin.id, action_type="content.mcq.create",
                         target_id=mcq.id, target_type="mcq"))
    return {"id": mcq.id, "message": "MCQ created"}


@router.patch("/mcqs/{mcq_id}")
async def update_mcq(
    mcq_id: str, req: MCQUpdateRequest,
    admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    mcq = (await db.execute(select(MCQQuestion).where(MCQQuestion.id == mcq_id))).scalar_one_or_none()
    if not mcq:
        raise HTTPException(status_code=404, detail="MCQ not found")
    for field in ("question_text", "options", "correct_option_index", "explanation", "display_order"):
        value = getattr(req, field)
        if value is not None:
            setattr(mcq, field, value)
    if not (0 <= mcq.correct_option_index < len(mcq.options)):
        raise HTTPException(status_code=400, detail="correct_option_index out of range")
    db.add(AdminAuditLog(admin_id=admin.id, action_type="content.mcq.edit",
                         target_id=mcq.id, target_type="mcq"))
    return {"message": "MCQ updated"}


@router.delete("/mcqs/{mcq_id}")
async def delete_mcq(
    mcq_id: str, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    mcq = (await db.execute(select(MCQQuestion).where(MCQQuestion.id == mcq_id))).scalar_one_or_none()
    if not mcq:
        raise HTTPException(status_code=404, detail="MCQ not found")
    await db.delete(mcq)
    db.add(AdminAuditLog(admin_id=admin.id, action_type="content.mcq.delete",
                         target_id=mcq_id, target_type="mcq"))
    return {"message": "MCQ deleted"}


class MCQBulkRequest(BaseModel):
    items: list[MCQCreateRequest]
    # "append" adds to what's there; "replace" clears the topic's MCQs first.
    mode: str = "append"


@router.post("/days/{day_id}/mcqs/bulk")
async def bulk_import_mcqs(
    day_id: str, req: MCQBulkRequest,
    admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    """Import many MCQs at once. All-or-nothing: one bad row imports nothing."""
    day = (await db.execute(select(Day).where(Day.id == day_id))).scalar_one_or_none()
    if not day:
        raise HTTPException(status_code=404, detail="Topic not found")
    if req.mode not in ("append", "replace"):
        raise HTTPException(status_code=400, detail="mode must be 'append' or 'replace'")
    if not req.items:
        raise HTTPException(status_code=400, detail="No questions supplied")

    # Validate the whole batch before touching the database.
    errors = []
    for idx, item in enumerate(req.items):
        if len(item.options) < 2:
            errors.append({"row": idx, "error": "needs at least 2 options"})
        elif not (0 <= item.correct_option_index < len(item.options)):
            errors.append({
                "row": idx,
                "error": f"correct_option_index {item.correct_option_index} out of range "
                         f"for {len(item.options)} options",
            })
        if not item.question_text.strip():
            errors.append({"row": idx, "error": "question_text is empty"})
    if errors:
        raise HTTPException(
            status_code=400,
            detail={"message": f"{len(errors)} invalid row(s); nothing imported", "errors": errors},
        )

    replaced = 0
    if req.mode == "replace":
        existing = (
            await db.execute(select(MCQQuestion).where(MCQQuestion.day_id == day_id))
        ).scalars().all()
        for row in existing:
            await db.delete(row)
        replaced = len(existing)
        start_order = 0
    else:
        highest = (
            await db.execute(
                select(func.max(MCQQuestion.display_order)).where(MCQQuestion.day_id == day_id)
            )
        ).scalar()
        start_order = (highest or -1) + 1

    for offset, item in enumerate(req.items):
        db.add(MCQQuestion(
            day_id=day_id,
            question_text=item.question_text,
            options=item.options,
            correct_option_index=item.correct_option_index,
            explanation=item.explanation,
            display_order=start_order + offset,
        ))

    db.add(AdminAuditLog(
        admin_id=admin.id, action_type="content.mcq.bulk_import",
        target_id=day_id, target_type="day",
        payload_after={"imported": len(req.items), "mode": req.mode, "replaced": replaced},
    ))
    return {
        "message": f"Imported {len(req.items)} question(s)",
        "imported": len(req.items),
        "replaced": replaced,
    }


# ── Rubric items ─────────────────────────────────────────────────

class RubricCreateRequest(BaseModel):
    name: str
    description: str | None = None
    max_points: int
    pass_fail_criteria: str | None = None
    display_order: int = 0


class RubricUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    max_points: int | None = None
    pass_fail_criteria: str | None = None
    display_order: int | None = None


@router.post("/days/{day_id}/rubric-items")
async def create_rubric_item(
    day_id: str, req: RubricCreateRequest,
    admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    day = (await db.execute(select(Day).where(Day.id == day_id))).scalar_one_or_none()
    if not day:
        raise HTTPException(status_code=404, detail="Topic not found")
    if req.max_points <= 0:
        raise HTTPException(status_code=400, detail="max_points must be positive")

    item = DayRubricItem(
        day_id=day_id, name=req.name, description=req.description,
        max_points=req.max_points, pass_fail_criteria=req.pass_fail_criteria,
        display_order=req.display_order,
    )
    db.add(item)
    await db.flush()
    db.add(AdminAuditLog(admin_id=admin.id, action_type="content.rubric.create",
                         target_id=item.id, target_type="rubric_item"))
    return {"id": item.id, "message": "Rubric item created"}


@router.patch("/rubric-items/{item_id}")
async def update_rubric_item(
    item_id: str, req: RubricUpdateRequest,
    admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    item = (
        await db.execute(select(DayRubricItem).where(DayRubricItem.id == item_id))
    ).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Rubric item not found")
    for field in ("name", "description", "max_points", "pass_fail_criteria", "display_order"):
        value = getattr(req, field)
        if value is not None:
            setattr(item, field, value)
    if item.max_points <= 0:
        raise HTTPException(status_code=400, detail="max_points must be positive")
    db.add(AdminAuditLog(admin_id=admin.id, action_type="content.rubric.edit",
                         target_id=item.id, target_type="rubric_item"))
    return {"message": "Rubric item updated"}


@router.delete("/rubric-items/{item_id}")
async def delete_rubric_item(
    item_id: str, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    item = (
        await db.execute(select(DayRubricItem).where(DayRubricItem.id == item_id))
    ).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Rubric item not found")
    await db.delete(item)
    db.add(AdminAuditLog(admin_id=admin.id, action_type="content.rubric.delete",
                         target_id=item_id, target_type="rubric_item"))
    return {"message": "Rubric item deleted"}


@router.post("/days/{day_id}/rubric-items/reorder")
async def reorder_rubric_items(
    day_id: str, req: ReorderRequest,
    admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    items = (
        await db.execute(select(DayRubricItem).where(DayRubricItem.day_id == day_id))
    ).scalars().all()
    by_id = {i.id: i for i in items}
    unknown = [i.id for i in req.items if i.id not in by_id]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown rubric item(s): {unknown}")
    for entry in req.items:
        by_id[entry.id].display_order = entry.display_order
    return {"message": "Rubric reordered", "count": len(req.items)}


async def _reorder_children(db: AsyncSession, model, day_id: str, req: ReorderRequest, label: str):
    """Shared display_order writer for a topic's child content lists."""
    rows = (await db.execute(select(model).where(model.day_id == day_id))).scalars().all()
    by_id = {r.id: r for r in rows}
    unknown = [i.id for i in req.items if i.id not in by_id]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown {label}(s): {unknown}")
    for entry in req.items:
        by_id[entry.id].display_order = entry.display_order
    return {"message": f"{label.capitalize()}s reordered", "count": len(req.items)}


@router.post("/days/{day_id}/mcqs/reorder")
async def reorder_mcqs(
    day_id: str, req: ReorderRequest,
    admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    return await _reorder_children(db, MCQQuestion, day_id, req, "mcq")


@router.post("/days/{day_id}/videos/reorder")
async def reorder_videos(
    day_id: str, req: ReorderRequest,
    admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    return await _reorder_children(db, DayVideo, day_id, req, "video")


@router.post("/days/{day_id}/materials/reorder")
async def reorder_materials(
    day_id: str, req: ReorderRequest,
    admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    return await _reorder_children(db, DayMaterial, day_id, req, "material")


# ── Deep user detail ─────────────────────────────────────────────

@router.get("/users/{user_id}/detail")
async def user_deep_detail(
    user_id: str, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    u = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    progress = (await db.execute(
        select(LearnerDayProgress).where(LearnerDayProgress.learner_id == user_id)
        .order_by(LearnerDayProgress.day_number)
    )).scalars().all()
    submissions = (await db.execute(
        select(Submission).where(Submission.learner_id == user_id)
        .order_by(Submission.submitted_at.desc()).limit(30)
    )).scalars().all()
    payments = (await db.execute(
        select(PaymentOrder).where(PaymentOrder.learner_id == user_id)
        .order_by(PaymentOrder.created_at.desc())
    )).scalars().all()
    xp_events = (await db.execute(
        select(XPEvent).where(XPEvent.learner_id == user_id)
        .order_by(XPEvent.created_at.desc()).limit(50)
    )).scalars().all()
    total_xp = (await db.execute(
        select(func.sum(XPEvent.amount)).where(XPEvent.learner_id == user_id)
    )).scalar() or 0
    badges = (await db.execute(
        select(LearnerBadge).where(LearnerBadge.learner_id == user_id)
    )).scalars().all()
    certs = (await db.execute(
        select(Certificate).where(Certificate.learner_id == user_id)
    )).scalars().all()
    ref_code = (await db.execute(
        select(ReferralCode).where(ReferralCode.owner_id == user_id)
    )).scalars().first()
    referrals = (await db.execute(
        select(ReferralReward).where(ReferralReward.referrer_id == user_id)
    )).scalars().all()

    return {
        "user": {
            "id": u.id, "email": u.email, "first_name": u.first_name, "last_name": u.last_name,
            "role": u.role, "is_paid": u.paid_at is not None, "paid_at": u.paid_at,
            "is_suspended": u.is_suspended, "suspension_reason": u.suspension_reason,
            "bio": u.bio, "portfolio_slug": u.portfolio_slug,
            "platform_credit_balance": u.platform_credit_balance or 0,
            "referred_by_code": u.referred_by_code, "created_at": u.created_at,
        },
        "stats": {
            "total_xp": total_xp,
            "days_completed": sum(1 for p in progress if p.status == "completed"),
            "badges": len(badges),
        },
        "progress": [
            {"day_number": p.day_number, "status": p.status,
             "best_quiz_score": p.best_quiz_score, "quiz_attempts": p.quiz_attempts}
            for p in progress
        ],
        "submissions": [
            {"id": s.id, "day_number": s.day_number, "status": s.status,
             "score": s.score, "submitted_at": s.submitted_at}
            for s in submissions
        ],
        "payments": [
            {"id": p.id, "amount_paise": p.amount_paise, "status": p.status,
             "razorpay_order_id": p.razorpay_order_id, "created_at": p.created_at}
            for p in payments
        ],
        "xp_log": [
            {"amount": e.amount, "reason": e.reason, "created_at": e.created_at}
            for e in xp_events
        ],
        "badges": [{"badge_slug": b.badge_slug, "earned_at": b.earned_at} for b in badges],
        "certificates": [{"id": c.id, "tier": c.tier, "status": c.status} for c in certs],
        "referral": {
            "code": ref_code.code if ref_code else None,
            "converted": sum(1 for r in referrals if r.status == "rewarded"),
        },
    }


# ── Refund queue ─────────────────────────────────────────────────

@router.get("/refunds")
async def list_refunds(
    status_filter: str = "pending",
    admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    query = select(RefundRequest, User.email, User.first_name, User.last_name).join(
        User, RefundRequest.learner_id == User.id
    ).order_by(RefundRequest.requested_at.desc())
    if status_filter in ("pending", "approved", "rejected"):
        query = query.where(RefundRequest.status == status_filter)
    rows = (await db.execute(query)).all()
    return {
        "refunds": [
            {
                "id": r.id, "learner_id": r.learner_id,
                "learner_name": f"{fn} {ln}", "learner_email": email,
                "reason_category": r.reason_category, "reason_text": r.reason_text,
                "status": r.status, "requested_at": r.requested_at,
            }
            for r, email, fn, ln in rows
        ]
    }


class RefundDecisionRequest(BaseModel):
    action: str  # "approved" | "rejected"
    admin_note: str | None = None


@router.patch("/refunds/{refund_id}")
async def decide_refund(
    refund_id: str, req: RefundDecisionRequest,
    admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    if req.action not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="action must be 'approved' or 'rejected'")
    refund = (await db.execute(
        select(RefundRequest).where(RefundRequest.id == refund_id)
    )).scalar_one_or_none()
    if not refund:
        raise HTTPException(status_code=404, detail="Refund request not found")
    if refund.status != "pending":
        raise HTTPException(status_code=400, detail="Refund already decided")

    refund.status = req.action
    refund.admin_id = admin.id
    refund.admin_note = req.admin_note
    refund.resolved_at = datetime.now(timezone.utc)

    if req.action == "approved":
        # Revoke access, mark the order refunded, reverse referral reward if any
        u = (await db.execute(select(User).where(User.id == refund.learner_id))).scalar_one_or_none()
        order = (await db.execute(
            select(PaymentOrder).where(PaymentOrder.id == refund.payment_order_id)
        )).scalar_one_or_none()
        if u:
            u.paid_at = None
        if order:
            order.status = "refunded"
            order.refunded_at = datetime.now(timezone.utc)
        reward = (await db.execute(
            select(ReferralReward).where(
                ReferralReward.referee_id == refund.learner_id,
                ReferralReward.status == "rewarded",
            )
        )).scalar_one_or_none()
        if reward:
            reward.status = "reversed"
            reward.reversed_at = datetime.now(timezone.utc)
            referrer = (await db.execute(
                select(User).where(User.id == reward.referrer_id)
            )).scalar_one_or_none()
            if referrer:
                referrer.platform_credit_balance = max(
                    0, (referrer.platform_credit_balance or 0) - (reward.referrer_credit or 0)
                )

    await notify(
        db, refund.learner_id, "refund_decision",
        title=f"Refund request {req.action}",
        body=req.admin_note,
        reference_id=refund.id, reference_type="refund",
    )
    db.add(AdminAuditLog(
        admin_id=admin.id, action_type=f"payment.refund.{req.action}",
        target_id=refund.id, target_type="refund",
        payload_after={"note": req.admin_note},
    ))
    return {"message": f"Refund {req.action}"}


# ── Moderation: content preview + admin delete ───────────────────

@router.get("/reports/{report_id}/content")
async def report_content_preview(
    report_id: str, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    report = (await db.execute(select(FeedReport).where(FeedReport.id == report_id))).scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.target_type == "post":
        row = (await db.execute(
            select(FeedPost, User.first_name, User.last_name)
            .join(User, FeedPost.author_id == User.id)
            .where(FeedPost.id == report.target_id)
        )).first()
        if not row:
            return {"content": None, "deleted": True}
        post, fn, ln = row
        return {
            "content": post.content, "author": f"{fn} {ln}",
            "category": post.category, "deleted": post.is_deleted,
            "created_at": post.created_at,
        }
    row = (await db.execute(
        select(FeedReply, User.first_name, User.last_name)
        .join(User, FeedReply.author_id == User.id)
        .where(FeedReply.id == report.target_id)
    )).first()
    if not row:
        return {"content": None, "deleted": True}
    reply, fn, ln = row
    return {"content": reply.content, "author": f"{fn} {ln}",
            "deleted": reply.is_deleted, "created_at": reply.created_at}


@router.delete("/feed/{post_id}")
async def admin_delete_post(
    post_id: str, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    post = (await db.execute(select(FeedPost).where(FeedPost.id == post_id))).scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    post.is_deleted = True
    post.updated_at = datetime.now(timezone.utc)
    db.add(AdminAuditLog(admin_id=admin.id, action_type="moderation.post.delete",
                         target_id=post_id, target_type="feed_post"))
    return {"message": "Post removed"}


# ── Day videos (class recordings / syllabus videos) ──────────────

class VideoAddRequest(BaseModel):
    title: str
    url: str  # YouTube / Vimeo link — normalized to an embed URL
    duration_minutes: int | None = None
    description: str | None = None
    display_order: int = 0


class VideoUpdateRequest(BaseModel):
    title: str | None = None
    duration_minutes: int | None = None
    description: str | None = None
    display_order: int | None = None


class MaterialUpdateRequest(BaseModel):
    title: str | None = None
    display_order: int | None = None



@router.post("/days/{day_id}/videos")
async def add_day_video(
    day_id: str, req: VideoAddRequest,
    admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    day = (await db.execute(select(Day).where(Day.id == day_id))).scalar_one_or_none()
    if not day:
        raise HTTPException(status_code=404, detail="Day not found")
    normalized = normalize_video_url(req.url)
    if not normalized:
        raise HTTPException(
            status_code=400,
            detail="Unrecognized video URL — paste a YouTube or Vimeo link, or use the upload option",
        )
    vtype, embed_url = normalized
    video = DayVideo(
        day_id=day_id, title=req.title, video_type=vtype, video_url=embed_url,
        duration_minutes=req.duration_minutes, description=req.description,
        display_order=req.display_order,
    )
    db.add(video)
    await db.flush()
    db.add(AdminAuditLog(admin_id=admin.id, action_type="content.video.add",
                         target_id=video.id, target_type="day_video"))
    return {"id": video.id, "video_type": vtype, "video_url": embed_url}


ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".m4v"}


def _max_video_bytes() -> int:
    return settings.MAX_VIDEO_UPLOAD_MB * 1024 * 1024


def _uploaded_size(file: UploadFile) -> int:
    """Size of a (spooled) uploaded file, leaving it positioned at the start."""
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    return size


def _reject_oversized_early(request: Request, limit_bytes: int, label: str) -> None:
    """Refuse an over-limit upload from Content-Length, before reading the body.

    The size check used to run only after the whole file had been spooled to
    disk, so a multi-gigabyte upload was fully written before being rejected.
    Content-Length is client-supplied and so cannot be trusted on its own — the
    post-read check below still stands — but it turns the common case (an
    honest client sending a too-large file) into an immediate error instead of
    a long upload that fails at the end.
    """
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > limit_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"{label} exceeds the {limit_bytes // (1024 * 1024)} MB limit.",
        )



@router.post("/days/{day_id}/videos/upload")
async def upload_day_video(
    day_id: str,
    request: Request,
    title: str = Form(...),
    duration_minutes: int | None = Form(None),
    display_order: int = Form(0),
    file: UploadFile = File(...),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    limit = _max_video_bytes()
    _reject_oversized_early(request, limit, "Video")

    day = (await db.execute(select(Day).where(Day.id == day_id))).scalar_one_or_none()
    if not day:
        raise HTTPException(status_code=404, detail="Day not found")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format {ext or '(none)'} — allowed: {', '.join(sorted(ALLOWED_VIDEO_EXTENSIONS))}",
        )

    size = _uploaded_size(file)
    if size == 0:
        raise HTTPException(status_code=400, detail="That file is empty.")
    if size > limit:
        raise HTTPException(
            status_code=413,
            detail=f"Video is {size // (1024 * 1024)} MB — the limit is "
                   f"{limit // (1024 * 1024)} MB.",
        )

    # A storage failure (provider limit, expired credentials, network) would
    # otherwise surface as an opaque 500 halfway through a batch of uploads.
    try:
        stored = await store_file(
            file.file, file.filename or f"video{ext}", "novalabs/videos", "video"
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Upload to storage failed: {type(e).__name__}. "
                   "Check the storage provider's per-file limit and credentials.",
        )

    video = DayVideo(
        day_id=day_id, title=title, video_type="upload",
        video_url=stored["url"], storage_public_id=stored["public_id"],
        duration_minutes=duration_minutes, display_order=display_order,
    )
    db.add(video)
    await db.flush()
    db.add(AdminAuditLog(admin_id=admin.id, action_type="content.video.upload",
                         target_id=video.id, target_type="day_video",
                         payload_after={"filename": file.filename, "bytes": size}))
    return {"id": video.id, "video_type": "upload", "video_url": video.video_url, "bytes": size}


@router.patch("/videos/{video_id}")
async def update_day_video(
    video_id: str, req: VideoUpdateRequest,
    admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    video = (await db.execute(select(DayVideo).where(DayVideo.id == video_id))).scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    for field in ("title", "duration_minutes", "description", "display_order"):
        value = getattr(req, field)
        if value is not None:
            setattr(video, field, value)
    return {"message": "Video updated"}


@router.delete("/videos/{video_id}")
async def delete_day_video(
    video_id: str, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    video = (await db.execute(select(DayVideo).where(DayVideo.id == video_id))).scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if video.video_type == "upload":
        await delete_file(video.video_url, video.storage_public_id, "video")
    await db.delete(video)
    db.add(AdminAuditLog(admin_id=admin.id, action_type="content.video.delete",
                         target_id=video_id, target_type="day_video"))
    return {"message": "Video deleted"}


# ── Day materials (notes, PPTs, PDFs) ────────────────────────────

ALLOWED_MATERIAL_EXTENSIONS = {
    ".ppt", ".pptx", ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".txt", ".md", ".zip",
}

def _max_material_bytes() -> int:
    return settings.MAX_MATERIAL_UPLOAD_MB * 1024 * 1024


@router.post("/days/{day_id}/materials/upload")
async def upload_day_material(
    day_id: str,
    request: Request,
    title: str = Form(...),
    display_order: int = Form(0),
    file: UploadFile = File(...),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    limit = _max_material_bytes()
    _reject_oversized_early(request, limit, "File")

    day = (await db.execute(select(Day).where(Day.id == day_id))).scalar_one_or_none()
    if not day:
        raise HTTPException(status_code=404, detail="Day not found")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_MATERIAL_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format {ext or '(none)'} — allowed: {', '.join(sorted(ALLOWED_MATERIAL_EXTENSIONS))}",
        )

    size = _uploaded_size(file)
    if size == 0:
        raise HTTPException(status_code=400, detail="That file is empty.")
    if size > limit:
        raise HTTPException(
            status_code=413,
            detail=f"File is {size // (1024 * 1024)} MB — the limit is "
                   f"{limit // (1024 * 1024)} MB.",
        )

    try:
        stored = await store_file(
            file.file, file.filename or f"notes{ext}", "novalabs/materials", "raw"
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Upload to storage failed: {type(e).__name__}. "
                   "Check the storage provider's per-file limit and credentials.",
        )

    material = DayMaterial(
        day_id=day_id, title=title, file_url=stored["url"],
        file_type=ext.lstrip("."), file_size_bytes=size,
        storage_public_id=stored["public_id"], display_order=display_order,
    )
    db.add(material)
    await db.flush()
    db.add(AdminAuditLog(admin_id=admin.id, action_type="content.material.upload",
                         target_id=material.id, target_type="day_material",
                         payload_after={"filename": file.filename, "bytes": size,
                                        "storage": stored["storage"]}))
    return {
        "id": material.id, "title": material.title, "file_url": material.file_url,
        "file_type": material.file_type, "file_size_bytes": size,
    }


@router.patch("/materials/{material_id}")
async def update_day_material(
    material_id: str, req: MaterialUpdateRequest,
    admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    material = (await db.execute(
        select(DayMaterial).where(DayMaterial.id == material_id)
    )).scalar_one_or_none()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    if req.title is not None:
        material.title = req.title
    if req.display_order is not None:
        material.display_order = req.display_order
    return {"message": "Material updated"}


@router.delete("/materials/{material_id}")
async def delete_day_material(
    material_id: str, admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    material = (await db.execute(
        select(DayMaterial).where(DayMaterial.id == material_id)
    )).scalar_one_or_none()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    await delete_file(material.file_url, material.storage_public_id, "raw")
    await db.delete(material)
    db.add(AdminAuditLog(admin_id=admin.id, action_type="content.material.delete",
                         target_id=material_id, target_type="day_material"))
    return {"message": "Material deleted"}


# ── Referrals ────────────────────────────────────────────────────

class UpdateReferralSettingsRequest(BaseModel):
    discount_paise: int | None = None
    credit_paise: int | None = None


@router.get("/referrals")
async def list_referrals(
    admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)
):
    """Every referral code with what it has actually produced."""
    values = await get_settings(db, [REFERRAL_DISCOUNT_PAISE, REFERRAL_CREDIT_PAISE])

    codes = (
        await db.execute(
            select(ReferralCode, User)
            .join(User, User.id == ReferralCode.owner_id)
            .order_by(ReferralCode.created_at.desc())
        )
    ).all()

    # Rewards per code — conversions, what we paid out, what the friend saved.
    reward_rows = (
        await db.execute(
            select(
                ReferralReward.referral_code,
                ReferralReward.status,
                func.count().label("n"),
                func.sum(ReferralReward.referrer_credit).label("credit"),
                func.sum(ReferralReward.referee_discount).label("discount"),
            ).group_by(ReferralReward.referral_code, ReferralReward.status)
        )
    ).all()

    # Orders per code — how many people even reached checkout with it.
    order_rows = (
        await db.execute(
            select(
                PaymentOrder.referral_code,
                func.count().label("n"),
            )
            .where(PaymentOrder.referral_code.isnot(None))
            .group_by(PaymentOrder.referral_code)
        )
    ).all()
    attempts_by_code = {row.referral_code: row.n for row in order_rows}

    per_code: dict[str, dict] = {}
    for code, status, n, credit, discount in reward_rows:
        bucket = per_code.setdefault(
            code, {"rewarded": 0, "reversed": 0, "pending": 0, "credit": 0, "discount": 0}
        )
        bucket[status] = bucket.get(status, 0) + n
        # Reversed rewards were clawed back, so they must not count as payout.
        if status == "rewarded":
            bucket["credit"] += credit or 0
            bucket["discount"] += discount or 0

    items = []
    for ref, owner in codes:
        stats = per_code.get(ref.code, {})
        items.append(
            {
                "code": ref.code,
                "owner_id": owner.id,
                "owner_name": f"{owner.first_name} {owner.last_name or ''}".strip(),
                "owner_email": owner.email,
                "is_active": ref.is_active,
                "created_at": ref.created_at,
                "attempts": attempts_by_code.get(ref.code, 0),
                "conversions": stats.get("rewarded", 0),
                "reversed": stats.get("reversed", 0),
                "credit_earned_paise": stats.get("credit", 0),
                "discount_given_paise": stats.get("discount", 0),
            }
        )

    items.sort(key=lambda i: (i["conversions"], i["attempts"]), reverse=True)

    return {
        "settings": {
            "discount_paise": values[REFERRAL_DISCOUNT_PAISE],
            "credit_paise": values[REFERRAL_CREDIT_PAISE],
            "course_price_paise": settings.COURSE_PRICE_PAISE,
        },
        "totals": {
            "codes": len(items),
            "active_codes": sum(1 for i in items if i["is_active"]),
            "attempts": sum(i["attempts"] for i in items),
            "conversions": sum(i["conversions"] for i in items),
            "reversed": sum(i["reversed"] for i in items),
            "credit_issued_paise": sum(i["credit_earned_paise"] for i in items),
            "discount_given_paise": sum(i["discount_given_paise"] for i in items),
        },
        "referrals": items,
    }


@router.patch("/referrals/settings")
async def update_referral_settings(
    req: UpdateReferralSettingsRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Change the reward economics. Applies to future orders only — rewards
    already recorded keep the amounts they were granted at."""
    changes = {}
    try:
        if req.discount_paise is not None:
            changes["discount_paise"] = await set_setting(
                db, REFERRAL_DISCOUNT_PAISE, req.discount_paise, admin.id
            )
        if req.credit_paise is not None:
            changes["credit_paise"] = await set_setting(
                db, REFERRAL_CREDIT_PAISE, req.credit_paise, admin.id
            )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not changes:
        raise HTTPException(status_code=400, detail="Nothing to update")

    db.add(
        AdminAuditLog(
            admin_id=admin.id,
            action_type="referral.settings.update",
            target_type="platform_setting",
            payload_after=changes,
        )
    )
    await db.commit()
    return {"message": "Referral settings updated", **changes}


@router.patch("/referrals/{code}")
async def toggle_referral_code(
    code: str,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate (or re-activate) a single code — for abuse handling."""
    ref = (
        await db.execute(select(ReferralCode).where(ReferralCode.code == code.lower()))
    ).scalar_one_or_none()
    if ref is None:
        raise HTTPException(status_code=404, detail="Referral code not found")

    ref.is_active = not ref.is_active
    db.add(
        AdminAuditLog(
            admin_id=admin.id,
            action_type="referral.code.toggle",
            target_id=ref.code,
            target_type="referral_code",
            payload_after={"is_active": ref.is_active},
        )
    )
    await db.commit()
    return {"code": ref.code, "is_active": ref.is_active}
