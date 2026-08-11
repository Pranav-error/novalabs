import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ReferralCode(Base):
    __tablename__ = "referral_codes"

    code: Mapped[str] = mapped_column(String(50), primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class ReferralReward(Base):
    __tablename__ = "referral_rewards"
    __table_args__ = (UniqueConstraint("referee_id"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    referral_code: Mapped[str] = mapped_column(String(50), ForeignKey("referral_codes.code"))
    referee_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    referrer_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    referee_discount: Mapped[int] = mapped_column(Integer, default=10000)
    referrer_credit: Mapped[int] = mapped_column(Integer, default=10000)
    status: Mapped[str] = mapped_column(
        Enum("pending", "rewarded", "reversed", name="referral_status"), default="pending"
    )
    triggered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reversed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
