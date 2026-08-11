from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.media_signing import sign_cloudinary_video_url, sign_media_url
from app.models.content import Day, DayMaterial, DayVideo, MCQQuestion, Phase
from app.models.progress import LearnerDayProgress, LearnerNote
from app.models.social import Announcement
from app.models.user import User

router = APIRouter()


@router.get("/phases")
async def list_phases(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Phase).where(Phase.is_published == True).order_by(Phase.display_order))
    phases = result.scalars().all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "tagline": p.tagline,
            "accent_color": p.accent_color,
            "skills_list": p.skills_list,
        }
        for p in phases
    ]


@router.get("/phases/{phase_id}")
async def get_phase(
    phase_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Phase).where(Phase.id == phase_id))
    phase = result.scalar_one_or_none()
    # Unpublished modules are hidden from list_phases, so hide them here too —
    # otherwise a direct ID lookup exposes a module that isn't live yet.
    if not phase or (not phase.is_published and user.role != "admin"):
        raise HTTPException(status_code=404, detail="Phase not found")

    days_result = await db.execute(
        select(Day).where(Day.phase_id == phase_id, Day.is_published == True).order_by(Day.day_number)
    )
    days = days_result.scalars().all()

    progress_result = await db.execute(
        select(LearnerDayProgress).where(LearnerDayProgress.learner_id == user.id)
    )
    progress_map = {p.day_number: p.status for p in progress_result.scalars().all()}

    return {
        "phase": {"id": phase.id, "name": phase.name, "description": phase.description},
        "days": [
            {
                "day_number": d.day_number,
                "title": d.title,
                "estimated_time": d.estimated_time,
                "status": progress_map.get(d.day_number, "locked"),
            }
            for d in days
        ],
    }


@router.get("/days/{day_number}")
async def get_day(
    day_number: int,
    preview: bool = False,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Admins can preview an unpublished topic exactly as a learner would see it.
    # Ignored for everyone else, so this can't be used to read draft content.
    is_preview = preview and user.role == "admin"

    stmt = select(Day).where(Day.day_number == day_number)
    if not is_preview:
        stmt = stmt.where(Day.is_published == True)  # noqa: E712
    day = (await db.execute(stmt)).scalar_one_or_none()
    if not day:
        raise HTTPException(status_code=404, detail="Day not found")

    # Check access: Day 1 is always free, others need payment
    if day_number > 1 and user.paid_at is None and not is_preview:
        return {
            "day_number": day.day_number,
            "title": day.title,
            "is_locked": True,
            "lesson_content": None,
        }

    # Get MCQs
    mcq_result = await db.execute(
        select(MCQQuestion).where(MCQQuestion.day_id == day.id).order_by(MCQQuestion.display_order)
    )
    mcqs = mcq_result.scalars().all()

    # Get class videos
    video_result = await db.execute(
        select(DayVideo).where(DayVideo.day_id == day.id).order_by(DayVideo.display_order)
    )
    videos = video_result.scalars().all()

    # Get notes & study materials
    material_result = await db.execute(
        select(DayMaterial).where(DayMaterial.day_id == day.id).order_by(DayMaterial.display_order)
    )
    materials = material_result.scalars().all()

    # Get progress
    prog_result = await db.execute(
        select(LearnerDayProgress).where(
            LearnerDayProgress.learner_id == user.id,
            LearnerDayProgress.day_number == day_number,
        )
    )
    progress = prog_result.scalar_one_or_none()

    # Admins previewing content get the same affordances as a paid learner.
    can_download = user.paid_at is not None or user.role == "admin"

    def resolve_video_url(v: DayVideo) -> str:
        # Our own uploads live on Cloudinary's `authenticated` delivery type —
        # no permanent public URL exists, so a fresh signed one is minted per
        # request. YouTube/Vimeo embeds and legacy local files fall back to
        # the existing signer, which passes external URLs through untouched.
        if v.video_type == "upload" and v.storage_public_id:
            signed = sign_cloudinary_video_url(v.storage_public_id)
            if signed:
                return signed
        return sign_media_url(v.video_url, user.id)

    return {
        "day_number": day.day_number,
        "title": day.title,
        "estimated_time": day.estimated_time,
        "is_locked": False,
        "lesson_content": day.lesson_content,
        "assignment_prompt": day.assignment_prompt,
        "assignment_type": day.assignment_type,
        "starter_code": day.starter_code,
        "language": day.language,
        # Shown over the player so any screen recording carries the account it
        # came from — the deterrent for capture we cannot technically prevent.
        "watermark": user.email,
        "videos": [
            {
                "id": v.id,
                "title": v.title,
                "video_type": v.video_type,
                "video_url": resolve_video_url(v),
                "duration_minutes": v.duration_minutes,
                "description": v.description,
                "display_order": v.display_order,
            }
            for v in videos
        ],
        # Notes are downloadable for learners who have paid; everyone else can
        # still read them in place via the plain signed URL. `download_url` is
        # omitted rather than nulled-and-checked so an unpaid client has nothing
        # to point at.
        "can_download_materials": can_download,
        "materials": [
            {
                "id": m.id,
                "title": m.title,
                "file_url": sign_media_url(m.file_url, user.id),
                **(
                    {"download_url": sign_media_url(m.file_url, user.id, download=True)}
                    if can_download
                    else {}
                ),
                "file_type": m.file_type,
                "file_size_bytes": m.file_size_bytes,
                "display_order": m.display_order,
            }
            for m in materials
        ],
        "mcqs": [
            {
                "id": q.id,
                "question_text": q.question_text,
                "options": q.options,
                "display_order": q.display_order,
            }
            for q in mcqs
        ],
        "progress": {
            "status": progress.status if progress else "unlocked",
            "best_quiz_score": progress.best_quiz_score if progress else 0,
            "quiz_attempts": progress.quiz_attempts if progress else 0,
            # Exposed so the day view can show what completion still needs —
            # a day only completes when this and quiz_attempts >= 1 are both true.
            "scroll_completed": bool(progress.scroll_completed) if progress else False,
        },
    }


@router.get("/days/{day_number}/notes")
async def get_notes(
    day_number: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(LearnerNote).where(
            LearnerNote.learner_id == user.id, LearnerNote.day_number == day_number
        )
    )
    note = result.scalar_one_or_none()
    return {"content": note.content if note else "", "updated_at": note.updated_at if note else None}


class SaveNotesRequest(BaseModel):
    content: str = Field("", max_length=50000)


@router.put("/days/{day_number}/notes")
async def save_notes(
    day_number: int,
    req: SaveNotesRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LearnerNote).where(
            LearnerNote.learner_id == user.id, LearnerNote.day_number == day_number
        )
    )
    note = result.scalar_one_or_none()
    if note is None:
        note = LearnerNote(learner_id=user.id, day_number=day_number)
        db.add(note)
    note.content = req.content
    note.updated_at = datetime.now(timezone.utc)
    return {"message": "Notes saved", "updated_at": note.updated_at}


@router.get("/announcements")
async def list_announcements(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Learner-facing announcements (most recent first)."""
    result = await db.execute(
        select(Announcement).order_by(Announcement.created_at.desc()).limit(10)
    )
    return {
        "announcements": [
            {
                "id": a.id,
                "title": a.title,
                "body": a.body,
                "urgency": a.urgency,
                "created_at": a.created_at,
            }
            for a in result.scalars().all()
        ]
    }
