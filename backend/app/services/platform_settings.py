"""Read/write for admin-editable platform numbers.

Every caller goes through here rather than reading `settings.*` directly, so
there is one source of truth for the referral economics. The values in
`app.core.config` remain the defaults used until an admin overrides them.
"""
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.settings import PlatformSetting

REFERRAL_DISCOUNT_PAISE = "referral_discount_paise"
REFERRAL_CREDIT_PAISE = "referral_credit_paise"

DEFAULTS: dict[str, int] = {
    REFERRAL_DISCOUNT_PAISE: settings.REFERRAL_DISCOUNT_PAISE,
    REFERRAL_CREDIT_PAISE: settings.REFERRAL_CREDIT_PAISE,
}

# Bounds enforced on write. A referral that discounts more than the course
# costs, or pays out more than it earns, is always a mistake.
BOUNDS: dict[str, tuple[int, int]] = {
    REFERRAL_DISCOUNT_PAISE: (0, settings.COURSE_PRICE_PAISE),
    REFERRAL_CREDIT_PAISE: (0, settings.COURSE_PRICE_PAISE),
}


async def get_settings(db: AsyncSession, keys: list[str] | None = None) -> dict[str, int]:
    """Return the given keys (all known keys by default), defaults filled in."""
    wanted = keys or list(DEFAULTS)
    rows = (await db.execute(select(PlatformSetting).where(PlatformSetting.key.in_(wanted)))).scalars()
    stored = {row.key: row.value for row in rows}
    return {key: stored.get(key, DEFAULTS[key]) for key in wanted}


async def get_setting(db: AsyncSession, key: str) -> int:
    return (await get_settings(db, [key]))[key]


async def set_setting(db: AsyncSession, key: str, value: int, admin_id: str | None = None) -> int:
    """Persist a value after range-checking it. Raises ValueError when invalid."""
    if key not in DEFAULTS:
        raise ValueError(f"Unknown setting {key!r}")

    low, high = BOUNDS[key]
    if not low <= value <= high:
        raise ValueError(f"{key} must be between {low} and {high}")

    row = (
        await db.execute(select(PlatformSetting).where(PlatformSetting.key == key))
    ).scalar_one_or_none()

    if row is None:
        row = PlatformSetting(key=key, value=value, updated_by=admin_id)
        db.add(row)
    else:
        row.value = value
        row.updated_by = admin_id
        row.updated_at = datetime.now(timezone.utc)

    await db.flush()
    return value
