import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class XPEvent(Base):
    __tablename__ = "xp_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    learner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(
        Enum(
            "quiz_complete", "quiz_bonus", "assignment_submit", "project_merit",
            "community_post", "doubt_reply", "official_answer", "referral_convert",
            "daily_login", "streak_7", "streak_14", "streak_30",
            "mock_interview_completed",
            name="xp_reason",
        ),
        nullable=False,
    )
    reference_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    reference_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class LearnerBadge(Base):
    __tablename__ = "learner_badges"
    __table_args__ = (UniqueConstraint("learner_id", "badge_slug"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    learner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    badge_slug: Mapped[str] = mapped_column(String(100), nullable=False)
    earned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class LearnerStreak(Base):
    __tablename__ = "learner_streaks"

    learner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), primary_key=True)
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0)
    last_activity_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    shield_available: Mapped[bool] = mapped_column(Boolean, default=False)
    shield_used_date: Mapped[date | None] = mapped_column(Date, nullable=True)
