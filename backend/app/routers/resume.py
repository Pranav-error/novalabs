import re

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.content import Day, Phase
from app.models.gamification import XPEvent
from app.models.interview import ResumeDoc
from app.models.progress import LearnerDayProgress, Submission
from app.models.user import User

router = APIRouter()

async def skills_for_completed_days(db, completed_days) -> list[str]:
    """Skills a learner has earned, derived from the modules their completed
    topics belong to.

    This used to be a hardcoded table of day ranges 1-30, which meant any module
    added after launch could never appear on a resume. Now it follows the actual
    curriculum: a module counts once the learner finishes any topic inside it,
    and its `skills_list` is used when set, falling back to the module name.
    """
    completed_set = set(completed_days)
    if not completed_set:
        return []

    rows = (
        await db.execute(
            select(Day.day_number, Phase.name, Phase.skills_list, Phase.display_order)
            .join(Phase, Phase.id == Day.phase_id)
            .order_by(Phase.display_order)
        )
    ).all()

    skills: list[str] = []
    seen: set[str] = set()
    for day_number, phase_name, skills_list, _ in rows:
        if day_number not in completed_set:
            continue
        for skill in (skills_list or [phase_name]):
            if skill and skill not in seen:
                seen.add(skill)
                skills.append(skill)
    return skills

ACTION_VERBS = [
    "built",
    "led",
    "created",
    "designed",
    "developed",
    "launched",
    "improved",
    "implemented",
]

EMPTY_EDITABLE = {
    "headline": "",
    "summary": "",
    "experience": [],
    "education": [],
    "custom_skills": [],
}


class ExperienceEntry(BaseModel):
    title: str = ""
    company: str = ""
    duration: str = ""
    description: str = ""


class EducationEntry(BaseModel):
    degree: str = ""
    institution: str = ""
    year: str = ""


class UpdateResumeRequest(BaseModel):
    headline: str | None = None
    summary: str | None = None
    experience: list[ExperienceEntry] | None = None
    education: list[EducationEntry] | None = None
    custom_skills: list[str] | None = None


async def _build_resume(user: User, db: AsyncSession) -> dict:
    # Total XP
    xp_result = await db.execute(
        select(func.sum(XPEvent.amount)).where(XPEvent.learner_id == user.id)
    )
    total_xp = xp_result.scalar() or 0

    # Completed days
    days_result = await db.execute(
        select(LearnerDayProgress.day_number).where(
            LearnerDayProgress.learner_id == user.id,
            LearnerDayProgress.status == "completed",
        )
    )
    completed_days = [row[0] for row in days_result.all()]
    days_completed = len(completed_days)

    # Average quiz score (only scored attempts)
    quiz_result = await db.execute(
        select(func.avg(LearnerDayProgress.best_quiz_score)).where(
            LearnerDayProgress.learner_id == user.id,
            LearnerDayProgress.best_quiz_score > 0,
        )
    )
    avg_quiz_score = quiz_result.scalar()
    avg_quiz_score = round(float(avg_quiz_score), 1) if avg_quiz_score is not None else 0

    # Projects: submissions with a github_url or of type "project"
    submissions_result = await db.execute(
        select(Submission)
        .where(
            Submission.learner_id == user.id,
            or_(Submission.github_url.is_not(None), Submission.submission_type == "project"),
        )
        .order_by(Submission.day_number)
    )
    projects = [
        {
            "day_number": s.day_number,
            "description": s.description,
            "github_url": s.github_url,
            "live_url": s.live_url,
            "stack_tags": s.stack_tags or [],
            "score": s.score,
        }
        for s in submissions_result.scalars().all()
    ]

    # Skills derived from completed challenge phases
    skills_learned = await skills_for_completed_days(db, completed_days)

    auto = {
        "profile": {
            "name": f"{user.first_name} {user.last_name}".strip(),
            "email": user.email,
            "bio": user.bio,
            "github_url": user.github_url,
            "linkedin_url": user.linkedin_url,
        },
        "stats": {
            "total_xp": total_xp,
            "days_completed": days_completed,
            "avg_quiz_score": avg_quiz_score,
        },
        "projects": projects,
        "skills_learned": skills_learned,
    }

    doc_result = await db.execute(select(ResumeDoc).where(ResumeDoc.learner_id == user.id))
    doc = doc_result.scalar_one_or_none()
    editable = {**EMPTY_EDITABLE, **(doc.data or {})} if doc else dict(EMPTY_EDITABLE)

    return {"auto": auto, "editable": editable}


@router.get("")
async def get_resume(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _build_resume(user, db)


@router.patch("")
async def update_resume(
    req: UpdateResumeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ResumeDoc).where(ResumeDoc.learner_id == user.id))
    doc = result.scalar_one_or_none()
    if doc is None:
        doc = ResumeDoc(learner_id=user.id, data={})
        db.add(doc)

    updates = req.model_dump(exclude_unset=True)
    doc.data = {**(doc.data or {}), **updates}
    await db.commit()
    return {"message": "Resume updated"}


@router.post("/analyze")
async def analyze_resume(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    resume = await _build_resume(user, db)
    auto = resume["auto"]
    editable = resume["editable"]

    score = 0
    suggestions: list[str] = []
    strengths: list[str] = []

    summary = (editable.get("summary") or "").strip()
    if 50 <= len(summary) <= 500:
        score += 15
        strengths.append("Professional summary is well-sized")
    else:
        suggestions.append("Add a professional summary (50+ chars)")

    if (editable.get("headline") or "").strip():
        score += 10
        strengths.append("Headline is set")
    else:
        suggestions.append("Add a headline (e.g. 'Full-Stack Developer')")

    experience = editable.get("experience") or []
    if len(experience) >= 1:
        score += 15
        strengths.append("Work experience listed")
    else:
        suggestions.append("Add at least one experience entry")

    education = editable.get("education") or []
    if len(education) >= 1:
        score += 10
        strengths.append("Education listed")
    else:
        suggestions.append("Add an education entry")

    github_projects = [p for p in auto["projects"] if p.get("github_url")]
    if len(github_projects) >= 2:
        score += 20
        strengths.append(f"{len(github_projects)} projects with GitHub links")
    else:
        suggestions.append("Submit at least 2 projects with GitHub links")

    profile = auto["profile"]
    if profile.get("github_url") and profile.get("linkedin_url"):
        score += 10
        strengths.append("GitHub and LinkedIn profiles linked")
    else:
        suggestions.append("Add both GitHub and LinkedIn URLs to your profile")

    if auto["stats"]["days_completed"] >= 15:
        score += 10
        strengths.append(f"{auto['stats']['days_completed']} challenge days completed")
    else:
        suggestions.append("Complete more challenge days to strengthen your resume")

    custom_skills = editable.get("custom_skills") or []
    if len(custom_skills) >= 3:
        score += 10
        strengths.append("Good custom skill coverage")
    else:
        suggestions.append("Add at least 3 custom skills")

    summary_words = set(re.findall(r"[a-z]+", summary.lower()))
    if summary and not summary_words.intersection(ACTION_VERBS):
        suggestions.append(
            "Use action verbs in your summary (e.g. built, led, designed, launched)"
        )

    return {"score": score, "suggestions": suggestions, "strengths": strengths}


@router.get("/export/json")
async def export_json(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _build_resume(user, db)
