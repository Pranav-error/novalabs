from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PlatformSetting(Base):
    """Admin-editable numbers that used to be hardcoded.

    Values are plain integers (a percentage, or an amount in paise) so a promo
    can be run without a redeploy. A key that has never been written falls back
    to its default in `app.services.platform_settings.DEFAULTS`.
    """

    __tablename__ = "platform_settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[int] = mapped_column(Integer)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    # Admin user id, kept unconstrained so deleting an admin never blocks a write.
    updated_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
