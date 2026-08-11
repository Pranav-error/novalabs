"""One-time backfill: issue a referral code to every user that lacks one.

Referral codes used to be minted only on payment unlock, so accounts created
before that changed have none. Safe to re-run — existing codes are left alone.
"""
import asyncio

from sqlalchemy import select

from app.core.database import async_session
from app.models.referral import ReferralCode
from app.models.user import User
from app.services.referral import get_or_create_referral_code


async def main() -> None:
    async with async_session() as db:
        users = (await db.execute(select(User))).scalars().all()
        owners = set(
            (
                await db.execute(
                    select(ReferralCode.owner_id).where(ReferralCode.is_active == True)  # noqa: E712
                )
            ).scalars()
        )

        created = 0
        for user in users:
            if user.id in owners:
                continue
            code = await get_or_create_referral_code(db, user.id, user.first_name)
            created += 1
            print(f"  + {user.email:45} -> {code}")

        await db.commit()
        print(f"\n{len(users)} users · {created} codes created · {len(users) - created} already had one.")


if __name__ == "__main__":
    asyncio.run(main())
