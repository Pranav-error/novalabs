import random
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.data.interview_questions import QUESTION_BANK
from app.models.gamification import XPEvent
from app.models.interview import InterviewSession
from app.models.user import User

router = APIRouter()

QUESTIONS_PER_SESSION = 5
XP_PER_INTERVIEW = 20

TOPIC_NAMES = {
    "html_css": "Technical (HTML/CSS/JS)",
    "react": "Technical (React)",
    "python_fastapi": "Technical (Python/FastAPI)",
    "mongodb": "Technical (MongoDB & Databases)",
    "system_design": "System Design (Intro)",
    "hr_behavioural": "HR / Behavioural",
}

# Flat lookup: question id -> question dict (with topic attached)
_QUESTIONS_BY_ID: dict[str, dict] = {}
for _topic, _questions in QUESTION_BANK.items():
    for _q in _questions:
        _QUESTIONS_BY_ID[_q["id"]] = {**_q, "topic": _topic}


class StartRequest(BaseModel):
    topic: str


class SubmitRequest(BaseModel):
    answers: dict[str, str]  # question_id -> answer text


def _score_answer(answer: str, keywords: list[str]) -> tuple[int, list[str]]:
    """Heuristic scoring out of 10 based on keyword coverage and depth."""
    text = (answer or "").strip()
    if not text:
        return 0, []

    lowered = text.lower()
    matched = [kw for kw in keywords if kw.lower() in lowered]

    if not keywords:
        base = 5 if len(text) >= 50 else 2
        return base, []

    score = round(10 * len(matched) / len(keywords))

    # Very short answers can't demonstrate understanding
    if len(text) < 20:
        score = min(score, 2)

    # Bonus for a detailed answer that hits multiple keywords
    if len(text) > 150 and len(matched) >= 2:
        score = min(10, score + 1)

    return score, matched


def _feedback_for(score: int) -> str:
    if score >= 8:
        return "Excellent answer — you covered the key concepts clearly."
    if score >= 5:
        return "Good answer, but you missed some important points. Review the model answer."
    if score >= 3:
        return "Partial answer. Study the model answer and try to cover more key concepts."
    return "This answer needs work. Read the model answer carefully and practice explaining it aloud."


async def _get_owned_session(session_id: str, user: User, db: AsyncSession) -> InterviewSession:
    result = await db.execute(
        select(InterviewSession).where(
            InterviewSession.id == session_id,
            InterviewSession.learner_id == user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")
    return session


@router.get("/topics")
async def list_topics():
    return {
        "topics": [
            {"id": topic_id, "name": name, "question_count": len(QUESTION_BANK.get(topic_id, []))}
            for topic_id, name in TOPIC_NAMES.items()
        ]
    }


@router.post("/start")
async def start_session(
    req: StartRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if req.topic not in QUESTION_BANK:
        raise HTTPException(status_code=400, detail="Unknown topic")

    pool = QUESTION_BANK[req.topic]
    selected = random.sample(pool, min(QUESTIONS_PER_SESSION, len(pool)))

    session = InterviewSession(
        learner_id=user.id,
        topic=req.topic,
        question_ids=[q["id"] for q in selected],
    )
    db.add(session)
    await db.flush()

    return {
        "session_id": session.id,
        "topic": req.topic,
        "topic_name": TOPIC_NAMES.get(req.topic, req.topic),
        "questions": [
            {"id": q["id"], "question": q["question"]} for q in selected
        ],
    }


@router.post("/{session_id}/submit")
async def submit_answers(
    session_id: str,
    req: SubmitRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_owned_session(session_id, user, db)
    if session.status == "completed":
        raise HTTPException(status_code=400, detail="Session already completed")

    scores: dict[str, int] = {}
    answers: dict[str, str] = {}

    for qid in session.question_ids:
        q = _QUESTIONS_BY_ID.get(qid)
        if not q:
            continue
        answer = req.answers.get(qid, "")
        answers[qid] = answer
        score, _ = _score_answer(answer, q.get("keywords", []))
        scores[qid] = score

    total = round(sum(scores.values()) / max(len(scores), 1) * 10)  # out of 100

    session.answers = answers
    session.scores = scores
    session.total_score = total
    session.status = "completed"
    session.completed_at = datetime.now(timezone.utc)

    db.add(XPEvent(
        learner_id=user.id,
        amount=XP_PER_INTERVIEW,
        reason="mock_interview_completed",
        reference_id=session.id,
        reference_type="interview_session",
    ))

    return {"session_id": session.id, "total_score": total, "xp_awarded": XP_PER_INTERVIEW}


@router.get("/history")
async def interview_history(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(InterviewSession)
        .where(InterviewSession.learner_id == user.id)
        .order_by(InterviewSession.started_at.desc())
    )
    sessions = result.scalars().all()
    return {
        "sessions": [
            {
                "session_id": s.id,
                "topic": s.topic,
                "topic_name": TOPIC_NAMES.get(s.topic, s.topic),
                "status": s.status,
                "total_score": s.total_score,
                "started_at": s.started_at,
                "completed_at": s.completed_at,
            }
            for s in sessions
        ]
    }


@router.get("/{session_id}/results")
async def get_results(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_owned_session(session_id, user, db)
    if session.status != "completed":
        raise HTTPException(status_code=400, detail="Session not yet completed")

    results = []
    for qid in session.question_ids:
        q = _QUESTIONS_BY_ID.get(qid)
        if not q:
            continue
        answer = (session.answers or {}).get(qid, "")
        score = (session.scores or {}).get(qid, 0)
        _, matched = _score_answer(answer, q.get("keywords", []))
        results.append({
            "question_id": qid,
            "question": q["question"],
            "your_answer": answer,
            "score": score,
            "feedback": _feedback_for(score),
            "keywords_hit": matched,
            "keywords_missed": [kw for kw in q.get("keywords", []) if kw not in matched],
            "model_answer": q["model_answer"],
        })

    return {
        "session_id": session.id,
        "topic": session.topic,
        "topic_name": TOPIC_NAMES.get(session.topic, session.topic),
        "total_score": session.total_score,
        "completed_at": session.completed_at,
        "results": results,
    }
