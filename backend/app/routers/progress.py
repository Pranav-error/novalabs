from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.content import Day, MCQQuestion
from app.models.progress import LearnerDayProgress, QuizAttempt, Submission
from app.models.user import User
from app.services.gamification import (
    IST,
    award_xp,
    check_day_completion,
    grant_badge,
    record_activity,
)

router = APIRouter()


class QuizSubmission(BaseModel):
    answers: dict  # {question_id: selected_option_index}


class AssignmentSubmission(BaseModel):
    submission_type: str
    content: str | None = None
    github_url: str | None = None
    live_url: str | None = None
    description: str | None = None
    stack_tags: list[str] = []


@router.post("/days/{day_number}/quiz")
async def submit_quiz(
    day_number: int,
    submission: QuizSubmission,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify day exists and user has access
    day_result = await db.execute(select(Day).where(Day.day_number == day_number))
    day = day_result.scalar_one_or_none()
    if not day:
        raise HTTPException(status_code=404, detail="Day not found")

    if day_number > 1 and user.paid_at is None:
        raise HTTPException(status_code=403, detail="Payment required")

    # Check attempt limit (max 5 per day)
    prog_result = await db.execute(
        select(LearnerDayProgress).where(
            LearnerDayProgress.learner_id == user.id,
            LearnerDayProgress.day_number == day_number,
        )
    )
    progress = prog_result.scalar_one_or_none()
    if progress and progress.quiz_attempts >= 5:
        raise HTTPException(status_code=400, detail="Maximum quiz attempts reached")

    # Score the quiz
    mcqs_result = await db.execute(select(MCQQuestion).where(MCQQuestion.day_id == day.id))
    mcqs = {q.id: q for q in mcqs_result.scalars().all()}

    correct = 0
    results = []
    for qid, answer in submission.answers.items():
        q = mcqs.get(qid)
        if q:
            is_correct = answer == q.correct_option_index
            if is_correct:
                correct += 1
            results.append({
                "question_id": qid,
                "selected": answer,
                "correct": q.correct_option_index,
                "is_correct": is_correct,
                "explanation": q.explanation,
            })

    score = correct

    # Save attempt
    attempt = QuizAttempt(
        learner_id=user.id, day_number=day_number, answers=submission.answers, score=score
    )
    db.add(attempt)

    # Update progress
    if not progress:
        progress = LearnerDayProgress(
            learner_id=user.id, day_number=day_number, status="in_progress",
            started_at=datetime.now(timezone.utc),
            quiz_attempts=0, best_quiz_score=0,
        )
        db.add(progress)

    progress.quiz_attempts = (progress.quiz_attempts or 0) + 1
    if score > (progress.best_quiz_score or 0):
        progress.best_quiz_score = score

    xp = await award_xp(
        db, user.id, "quiz_complete",
        reference_id=f"day-{day_number}", reference_type="quiz",
        once_per_reference=True,
    )
    if score >= 8:
        xp += await award_xp(
            db, user.id, "quiz_bonus",
            reference_id=f"day-{day_number}", reference_type="quiz",
            once_per_reference=True,
        )
    if score >= len(mcqs) and len(mcqs) > 0:
        await grant_badge(db, user.id, "perfect_quiz")
    await record_activity(db, user.id)
    await check_day_completion(db, user.id, day_number)

    return {"score": score, "total": len(mcqs), "results": results, "xp_awarded": xp}


@router.get("/days/{day_number}/quiz/history")
async def quiz_history(
    day_number: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(QuizAttempt)
        .where(QuizAttempt.learner_id == user.id, QuizAttempt.day_number == day_number)
        .order_by(QuizAttempt.submitted_at.desc())
    )
    attempts = result.scalars().all()
    return [{"score": a.score, "submitted_at": a.submitted_at} for a in attempts]


@router.post("/days/{day_number}/assignment")
async def submit_assignment(
    day_number: int,
    req: AssignmentSubmission,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if day_number > 1 and user.paid_at is None:
        raise HTTPException(status_code=403, detail="Payment required")

    submission = Submission(
        learner_id=user.id,
        day_number=day_number,
        submission_type=req.submission_type,
        content=req.content,
        github_url=req.github_url,
        live_url=req.live_url,
        description=req.description,
        stack_tags=req.stack_tags,
    )
    db.add(submission)

    # Update progress
    prog_result = await db.execute(
        select(LearnerDayProgress).where(
            LearnerDayProgress.learner_id == user.id,
            LearnerDayProgress.day_number == day_number,
        )
    )
    progress = prog_result.scalar_one_or_none()
    if not progress:
        progress = LearnerDayProgress(
            learner_id=user.id, day_number=day_number, status="in_progress",
            started_at=datetime.now(timezone.utc),
        )
        db.add(progress)
    if progress.status != "completed":
        progress.status = "in_progress"

    xp = await award_xp(
        db, user.id, "assignment_submit",
        reference_id=f"day-{day_number}", reference_type="assignment",
        once_per_reference=True,
    )
    hour_ist = datetime.now(IST).hour
    if hour_ist < 7:
        await grant_badge(db, user.id, "early_bird")
    elif hour_ist >= 23:
        await grant_badge(db, user.id, "night_owl")
    await record_activity(db, user.id)

    return {"message": "Assignment submitted", "submission_id": submission.id, "xp_awarded": xp}


@router.get("/days/{day_number}/assignment")
async def get_assignment(
    day_number: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Submission)
        .where(Submission.learner_id == user.id, Submission.day_number == day_number)
        .order_by(Submission.submitted_at.desc())
    )
    sub = result.scalars().first()
    if not sub:
        return None
    return {
        "id": sub.id,
        "status": sub.status,
        "content": sub.content,
        "github_url": sub.github_url,
        "live_url": sub.live_url,
        "score": sub.score,
        "feedback": sub.feedback,
        "submitted_at": sub.submitted_at,
    }


@router.get("/days/{day_number}/assignment/solution")
async def get_solution(
    day_number: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    # Only show if day is completed
    prog_result = await db.execute(
        select(LearnerDayProgress).where(
            LearnerDayProgress.learner_id == user.id,
            LearnerDayProgress.day_number == day_number,
            LearnerDayProgress.status == "completed",
        )
    )
    if not prog_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Complete the day first")

    day_result = await db.execute(select(Day).where(Day.day_number == day_number))
    day = day_result.scalar_one_or_none()
    return {"reference_solution": day.reference_solution if day else None}


@router.post("/days/{day_number}/mark-viewed")
async def mark_viewed(
    day_number: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    # Same gate as the quiz and assignment endpoints. Without it an unpaid
    # learner could record progress against a day whose content the API
    # refuses to send them — writing a row for a lesson they cannot read.
    if day_number > 1 and user.paid_at is None and user.role not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Payment required")

    prog_result = await db.execute(
        select(LearnerDayProgress).where(
            LearnerDayProgress.learner_id == user.id,
            LearnerDayProgress.day_number == day_number,
        )
    )
    progress = prog_result.scalar_one_or_none()
    if not progress:
        progress = LearnerDayProgress(
            learner_id=user.id, day_number=day_number, status="in_progress",
            started_at=datetime.now(timezone.utc),
        )
        db.add(progress)
    progress.scroll_completed = True
    await record_activity(db, user.id)
    completed = await check_day_completion(db, user.id, day_number)
    return {"message": "Marked as viewed", "day_completed": completed}


class AssignmentUpdate(BaseModel):
    content: str | None = None
    github_url: str | None = None
    live_url: str | None = None
    description: str | None = None
    stack_tags: list[str] | None = None


@router.patch("/days/{day_number}/assignment")
async def update_assignment(
    day_number: int,
    req: AssignmentUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the latest submission for this day while it is still pending review."""
    result = await db.execute(
        select(Submission)
        .where(Submission.learner_id == user.id, Submission.day_number == day_number)
        .order_by(Submission.submitted_at.desc())
    )
    sub = result.scalars().first()
    if not sub:
        raise HTTPException(status_code=404, detail="No submission found for this day")
    if sub.status not in ("pending", "in_review"):
        raise HTTPException(status_code=403, detail="Submission already reviewed — cannot edit")

    for field in ("content", "github_url", "live_url", "description", "stack_tags"):
        value = getattr(req, field)
        if value is not None:
            setattr(sub, field, value)
    sub.updated_at = datetime.now(timezone.utc)
    return {"message": "Submission updated", "submission_id": sub.id}
