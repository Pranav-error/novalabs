import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Phase(Base):
    __tablename__ = "phases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tagline: Mapped[str | None] = mapped_column(String(255), nullable=True)
    accent_color: Mapped[str] = mapped_column(String(7), default="#2F67C7")
    skills_list: Mapped[list] = mapped_column(JSON, default=list)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class Day(Base):
    __tablename__ = "days"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    phase_id: Mapped[str] = mapped_column(String(36), ForeignKey("phases.id"))
    day_number: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    estimated_time: Mapped[str | None] = mapped_column(String(50), nullable=True)
    lesson_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    assignment_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    assignment_type: Mapped[str] = mapped_column(
        Enum("code", "text", "project", name="assignment_type"), default="code"
    )
    starter_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    reference_solution: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str] = mapped_column(String(20), default="html")
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    is_draft: Mapped[bool] = mapped_column(Boolean, default=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class MCQQuestion(Base):
    __tablename__ = "mcq_questions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    day_id: Mapped[str] = mapped_column(String(36), ForeignKey("days.id"))
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[list] = mapped_column(JSON, nullable=False)
    correct_option_index: Mapped[int] = mapped_column(Integer, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)


class DayRubricItem(Base):
    __tablename__ = "day_rubric_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    day_id: Mapped[str] = mapped_column(String(36), ForeignKey("days.id"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    max_points: Mapped[int] = mapped_column(Integer, nullable=False)
    pass_fail_criteria: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)


class DayVideo(Base):
    __tablename__ = "day_videos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    day_id: Mapped[str] = mapped_column(String(36), ForeignKey("days.id"))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    video_type: Mapped[str] = mapped_column(
        Enum("youtube", "vimeo", "upload", name="video_type"), default="youtube"
    )
    # youtube/vimeo: embed URL; upload: Cloudinary secure URL or local /media path
    video_url: Mapped[str] = mapped_column(String(500), nullable=False)
    # Cloudinary public_id when stored there (needed to delete the asset)
    storage_public_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class DayMaterial(Base):
    """Notes and study materials attached to a day (PPT, PDF, docs, zips)."""
    __tablename__ = "day_materials"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    day_id: Mapped[str] = mapped_column(String(36), ForeignKey("days.id"))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    # Cloudinary secure URL or local /media path
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(10), nullable=False)  # "pptx", "pdf", ...
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    storage_public_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
