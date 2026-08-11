"""Referral code generation, shared by payments (on unlock) and admin tooling."""
import re
import secrets
import string

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.referral import ReferralCode

_ALPHABET = string.ascii_lowercase + string.digits


async def get_or_create_referral_code(db: AsyncSession, user_id: str, first_name: str) -> str:
    """Return the user's referral code, creating one on first call.

    Format per spec: {first_name_lowercase}-{6_random_alphanumeric}, stored lowercase.
    """
    existing = await db.execute(
        select(ReferralCode).where(ReferralCode.owner_id == user_id, ReferralCode.is_active == True)
    )
    code = existing.scalars().first()
    if code:
        return code.code

    prefix = re.sub(r"[^a-z0-9]", "", first_name.lower()) or "learner"
    for _ in range(10):
        candidate = f"{prefix}-{''.join(secrets.choice(_ALPHABET) for _ in range(6))}"
        clash = await db.execute(select(ReferralCode.code).where(ReferralCode.code == candidate))
        if not clash.scalar_one_or_none():
            db.add(ReferralCode(code=candidate, owner_id=user_id))
            await db.flush()
            return candidate
    raise RuntimeError("Could not generate a unique referral code")
