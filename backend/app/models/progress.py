import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class LearnerDayProgress(Base):
    __tablename__ = "learner_day_progress"
    __table_args__ = (UniqueConstraint("learner_id", "day_number"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    learner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    day_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        Enum("locked", "unlocked", "in_progress", "completed", name="day_status"),
        default="locked",
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scroll_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    best_quiz_score: Mapped[int] = mapped_column(Integer, default=0)
    quiz_attempts: Mapped[int] = mapped_column(Integer, default=0)


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    learner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    day_number: Mapped[int] = mapped_column(Integer, nullable=False)
    answers: Mapped[dict] = mapped_column(JSON)
    score: Mapped[int] = mapped_column(Integer)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    learner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    day_number: Mapped[int] = mapped_column(Integer, nullable=False)
    submission_type: Mapped[str] = mapped_column(
        Enum("code", "text", "project", name="submission_type"), nullable=False
    )
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    github_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    live_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    stack_tags: Mapped[list] = mapped_column(JSON, default=list)
    screenshot_urls: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(
        Enum("pending", "in_review", "scored", "rejected", name="submission_status"),
        default="pending",
    )
    mentor_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rubric_breakdown: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class LearnerNote(Base):
    __tablename__ = "learner_notes"
    __table_args__ = (UniqueConstraint("learner_id", "day_number"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    learner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    day_number: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
