import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.certificate import Certificate
from app.models.gamification import LearnerBadge, XPEvent
from app.models.progress import LearnerDayProgress, Submission
from app.models.user import User
from app.services.github import extract_username, fetch_repos

router = APIRouter()

SLUG_PATTERN = re.compile(r"^[a-z0-9-]{3,50}$")


class UpdatePortfolioRequest(BaseModel):
    portfolio_slug: str | None = None
    bio: str | None = None


@router.get("/portfolio/{slug}")
async def get_portfolio(slug: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.portfolio_slug == slug))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Portfolio not found")

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

    badges_result = await db.execute(
        select(LearnerBadge)
        .where(LearnerBadge.learner_id == user.id)
        .order_by(LearnerBadge.earned_at.desc())
    )
    badges = [
        {"badge_slug": b.badge_slug, "earned_at": b.earned_at}
        for b in badges_result.scalars().all()
    ]

    projects_result = await db.execute(
        select(Submission)
        .where(
            Submission.learner_id == user.id,
            or_(Submission.submission_type == "project", Submission.github_url.is_not(None)),
        )
        .order_by(Submission.day_number)
    )
    projects = [
        {
            "day_number": s.day_number,
            "github_url": s.github_url,
            "live_url": s.live_url,
            "description": s.description,
            "stack_tags": s.stack_tags or [],
            "score": s.score,
            "submitted_at": s.submitted_at,
        }
        for s in projects_result.scalars().all()
    ]

    certs_result = await db.execute(
        select(Certificate)
        .where(Certificate.learner_id == user.id, Certificate.status == "active")
        .order_by(Certificate.tier)
    )
    certificates = [
        {"tier": c.tier, "issued_at": c.issued_at} for c in certs_result.scalars().all()
    ]

    github_username = extract_username(user.github_url)
    github_repos = await fetch_repos(github_username) if github_username else []

    return {
        "name": f"{user.first_name} {user.last_name}",
        "bio": user.bio,
        "github_url": user.github_url,
        "linkedin_url": user.linkedin_url,
        "member_since": user.created_at,
        "total_xp": total_xp,
        "days_completed": days_completed,
        "badges": badges,
        "projects": projects,
        "certificates": certificates,
        "github_repos": github_repos,
    }


@router.patch("/portfolio")
async def update_portfolio(
    req: UpdatePortfolioRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = req.model_dump(exclude_unset=True)

    if "portfolio_slug" in data and data["portfolio_slug"] is not None:
        slug = data["portfolio_slug"].strip()
        if not SLUG_PATTERN.match(slug):
            raise HTTPException(
                status_code=422,
                detail="Slug must be 3-50 characters: lowercase letters, numbers, and hyphens only",
            )
        existing_result = await db.execute(
            select(User).where(User.portfolio_slug == slug, User.id != user.id)
        )
        if existing_result.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="This slug is already taken")
        user.portfolio_slug = slug

    if "bio" in data:
        user.bio = data["bio"]

    await db.commit()

    return {
        "message": "Portfolio updated",
        "portfolio_slug": user.portfolio_slug,
        "bio": user.bio,
    }
