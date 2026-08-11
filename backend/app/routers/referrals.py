from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.payment import Coupon
from app.models.referral import ReferralCode
from app.models.user import User
from app.services.platform_settings import (
    REFERRAL_CREDIT_PAISE,
    REFERRAL_DISCOUNT_PAISE,
    get_setting,
    get_settings,
)

router = APIRouter()


@router.get("/referrals/terms")
async def referral_terms(db: AsyncSession = Depends(get_db)):
    """The live reward numbers, so learner-facing copy never hardcodes them.

    Public on purpose — the landing page quotes these before anyone signs in.
    """
    values = await get_settings(db, [REFERRAL_DISCOUNT_PAISE, REFERRAL_CREDIT_PAISE])
    return {
        "discount_paise": values[REFERRAL_DISCOUNT_PAISE],
        "credit_paise": values[REFERRAL_CREDIT_PAISE],
        # Included so checkout can price itself from one source instead of
        # hardcoding "₹1,299 + 18% GST" in the markup.
        "course_price_paise": settings.COURSE_PRICE_PAISE,
        "gst_percent": settings.GST_PERCENT,
    }


@router.get("/referrals/validate/{code}")
async def validate_referral(code: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ReferralCode).where(ReferralCode.code == code.lower(), ReferralCode.is_active == True)
    )
    ref = result.scalar_one_or_none()
    return {"valid": ref is not None}


class ApplyDiscountRequest(BaseModel):
    referral_code: str | None = None
    coupon_code: str | None = None


@router.post("/checkout/apply-discount")
async def apply_discount(
    req: ApplyDiscountRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    base_amount = settings.COURSE_PRICE_PAISE

    referral_discount = 0
    if req.referral_code:
        result = await db.execute(
            select(ReferralCode).where(
                ReferralCode.code == req.referral_code.lower(),
                ReferralCode.is_active == True,
            )
        )
        ref = result.scalar_one_or_none()
        if not ref:
            raise HTTPException(status_code=400, detail="Invalid referral code")
        if ref.owner_id == user.id:
            raise HTTPException(status_code=400, detail="Cannot use your own referral code")
        # Flat amount, capped so a discount can never exceed the price.
        referral_discount = min(await get_setting(db, REFERRAL_DISCOUNT_PAISE), base_amount)

    coupon_discount = 0
    coupon = None
    if req.coupon_code:
        result = await db.execute(
            select(Coupon).where(Coupon.code == req.coupon_code.upper(), Coupon.is_active == True)
        )
        coupon = result.scalar_one_or_none()
        if not coupon:
            raise HTTPException(status_code=400, detail="Invalid coupon code")

        now = datetime.now(timezone.utc)
        def _aware(dt):
            return dt.replace(tzinfo=timezone.utc) if dt and dt.tzinfo is None else dt
        if coupon.valid_from and now < _aware(coupon.valid_from):
            raise HTTPException(status_code=400, detail="Coupon not active yet")
        if coupon.valid_until and now > _aware(coupon.valid_until):
            raise HTTPException(status_code=400, detail="Coupon expired")
        if coupon.total_usage_limit and coupon.times_used >= coupon.total_usage_limit:
            raise HTTPException(status_code=400, detail="Coupon usage limit reached")

        if coupon.discount_type == "flat":
            coupon_discount = coupon.discount_value
        else:
            coupon_discount = base_amount * coupon.discount_value // 100
            if coupon.max_discount:
                coupon_discount = min(coupon_discount, coupon.max_discount)

    # Same stacking rule as create-order: larger of the two unless stackable
    if coupon is not None and coupon.stackable_with_referral:
        discount = referral_discount + coupon_discount
    else:
        discount = max(referral_discount, coupon_discount)

    return {
        "discount_paise": discount,
        "final_amount_paise": max(base_amount - discount, 100),
        "original_amount_paise": base_amount,
    }
