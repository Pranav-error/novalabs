import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Certificate(Base):
    __tablename__ = "certificates"
    __table_args__ = (UniqueConstraint("learner_id", "tier"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    learner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    tier: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(Enum("active", "revoked", name="cert_status"), default="active")
    revoke_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    pdf_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    share_image_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
