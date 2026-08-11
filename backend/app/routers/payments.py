import hashlib
import hmac
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.ratelimit import enforce_rate_limit
from app.services.referral import get_or_create_referral_code
from app.services.email import send_payment_receipt_email
from app.services.platform_settings import (
    REFERRAL_CREDIT_PAISE,
    REFERRAL_DISCOUNT_PAISE,
    get_setting,
)
from app.core.security import verify_razorpay_signature
from app.models.payment import Coupon, PaymentOrder, RefundRequest, WebhookEvent
from app.models.referral import ReferralCode
from app.models.user import User

router = APIRouter()


class CreateOrderRequest(BaseModel):
    referral_code: str | None = None
    coupon_code: str | None = None


class VerifyPaymentRequest(BaseModel):
    payment_id: str
    order_id: str
    signature: str


class RefundRequestBody(BaseModel):
    reason_category: str
    reason_text: str | None = None


@router.post("/payments/create-order")
async def create_order(
    req: CreateOrderRequest = CreateOrderRequest(),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Each order hits the Razorpay API and writes a row; cap it so a loop
    # can't spray orders or burn through the payment provider's quota.
    enforce_rate_limit("create_order", user.id, 15, 3600)

    if user.paid_at:
        raise HTTPException(status_code=400, detail="Already paid")

    base_amount = settings.COURSE_PRICE_PAISE

    referral_discount = 0
    if req.referral_code:
        ref_result = await db.execute(
            select(ReferralCode).where(
                ReferralCode.code == req.referral_code.lower(), ReferralCode.is_active == True
            )
        )
        ref = ref_result.scalar_one_or_none()
        if ref and ref.owner_id != user.id:
            referral_discount = min(await get_setting(db, REFERRAL_DISCOUNT_PAISE), base_amount)

    coupon_discount = 0
    coupon = None
    if req.coupon_code:
        coupon_result = await db.execute(
            select(Coupon).where(Coupon.code == req.coupon_code.upper(), Coupon.is_active == True)
        )
        coupon = coupon_result.scalar_one_or_none()
        if coupon:
            now = datetime.now(timezone.utc)
            def _aware(dt):
                return dt.replace(tzinfo=timezone.utc) if dt and dt.tzinfo is None else dt
            not_yet_valid = coupon.valid_from and now < _aware(coupon.valid_from)
            expired = coupon.valid_until and now > _aware(coupon.valid_until)
            exhausted = coupon.total_usage_limit and coupon.times_used >= coupon.total_usage_limit
            my_uses = (
                await db.execute(
                    select(func.count()).select_from(PaymentOrder).where(
                        PaymentOrder.learner_id == user.id,
                        PaymentOrder.coupon_code == coupon.code,
                        PaymentOrder.status == "paid",
                    )
                )
            ).scalar_one()
            over_user_limit = my_uses >= (coupon.per_user_limit or 1)

            if not (not_yet_valid or expired or exhausted or over_user_limit):
                if coupon.discount_type == "flat":
                    coupon_discount = coupon.discount_value
                elif coupon.discount_type == "percentage":
                    coupon_discount = base_amount * coupon.discount_value // 100
                    if coupon.max_discount:
                        coupon_discount = min(coupon_discount, coupon.max_discount)

    # Stacking rule (spec §7.5): coupons don't stack with referral discounts
    # unless the coupon allows it — otherwise the larger of the two applies.
    if coupon is not None and getattr(coupon, "stackable_with_referral", False):
        discount = referral_discount + coupon_discount
        referral_share = referral_discount
    else:
        discount = max(referral_discount, coupon_discount)
        # Only the winning side of the max() actually discounted anything.
        referral_share = referral_discount if referral_discount >= coupon_discount else 0

    final_amount = max(base_amount - discount, 100)  # Minimum ₹1

    # Create Razorpay order via API or use test mode
    razorpay_order_id = f"order_{hashlib.md5(f'{user.id}{datetime.now().isoformat()}'.encode()).hexdigest()[:20]}"

    if settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
        try:
            import razorpay
            client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            rz_order = client.order.create({
                "amount": final_amount,
                "currency": "INR",
                "receipt": f"rcpt_{user.id[:8]}",
            })
            razorpay_order_id = rz_order["id"]
        except Exception:
            pass  # Fall back to test order ID

    order = PaymentOrder(
        learner_id=user.id,
        razorpay_order_id=razorpay_order_id,
        amount_paise=final_amount,
        referral_code=req.referral_code,
        coupon_code=req.coupon_code,
        discount_applied=discount,
        referral_discount_applied=referral_share,
    )
    db.add(order)
    await db.commit()

    return {
        "order_id": razorpay_order_id,
        "key_id": settings.RAZORPAY_KEY_ID,
        "amount": final_amount,
        "discount": discount,
        "original_amount": base_amount,
        "currency": "INR",
        "name": "NOVA LABS",
        "description": "30-Day Full Stack Developer Challenge",
        "prefill": {
            "name": f"{user.first_name} {user.last_name}",
            "email": user.email,
        },
    }


@router.post("/payments/verify")
async def verify_payment(
    req: VerifyPaymentRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    if not verify_razorpay_signature(
        req.order_id, req.payment_id, req.signature, settings.RAZORPAY_KEY_SECRET
    ):
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    result = await db.execute(
        select(PaymentOrder).where(PaymentOrder.razorpay_order_id == req.order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = "paid"
    order.razorpay_payment_id = req.payment_id
    order.paid_at = datetime.now(timezone.utc)

    user.paid_at = datetime.now(timezone.utc)
    user.payment_id = req.payment_id
    user.razorpay_order_id = req.order_id

    # Every paid learner gets their own referral code (spec §7.1)
    await get_or_create_referral_code(db, user.id, user.first_name)

    # Process referral reward
    if order.referral_code:
        ref_result = await db.execute(
            select(ReferralCode).where(ReferralCode.code == order.referral_code)
        )
        ref = ref_result.scalar_one_or_none()
        if ref:
            credit = await get_setting(db, REFERRAL_CREDIT_PAISE)

            referrer_result = await db.execute(select(User).where(User.id == ref.owner_id))
            referrer = referrer_result.scalar_one_or_none()
            if referrer:
                referrer.platform_credit_balance += credit

            # Record what this referral actually cost, not the column default —
            # the discount is a percentage of the price, so it is not a fixed ₹100.
            from app.models.referral import ReferralReward
            reward = ReferralReward(
                referral_code=order.referral_code,
                referee_id=user.id,
                referrer_id=ref.owner_id,
                referee_discount=order.referral_discount_applied or 0,
                referrer_credit=credit,
                status="rewarded",
                triggered_at=datetime.now(timezone.utc),
            )
            db.add(reward)

    # Increment coupon usage
    if order.coupon_code:
        coupon_result = await db.execute(
            select(Coupon).where(Coupon.code == order.coupon_code)
        )
        coupon = coupon_result.scalar_one_or_none()
        if coupon:
            coupon.times_used += 1

    await db.commit()

    # After the commit: the unlock is what matters, and send_email never raises,
    # but a receipt should never be able to affect whether access was granted.
    await send_payment_receipt_email(
        user.email, user.first_name, order.amount_paise, order.razorpay_order_id
    )

    return {"message": "Payment verified. All 30 days unlocked!", "is_paid": True}


@router.get("/payments/history")
async def payment_history(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PaymentOrder).where(PaymentOrder.learner_id == user.id).order_by(PaymentOrder.created_at.desc())
    )
    orders = result.scalars().all()
    return [
        {
            "id": o.id,
            "amount": o.amount_paise,
            "status": o.status,
            "discount": o.discount_applied,
            "created_at": o.created_at,
            "paid_at": o.paid_at,
        }
        for o in orders
    ]


@router.post("/payments/refund-request")
async def request_refund(
    req: RefundRequestBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    enforce_rate_limit("refund_request", user.id, 5, 3600)

    if not user.paid_at:
        raise HTTPException(status_code=400, detail="No payment found")

    # Check 7-day refund window (SQLite returns naive datetimes)
    paid_at = user.paid_at if user.paid_at.tzinfo else user.paid_at.replace(tzinfo=timezone.utc)
    days_since_payment = (datetime.now(timezone.utc) - paid_at).days
    if days_since_payment > 7:
        raise HTTPException(status_code=400, detail="Refund window has expired (7 days)")

    # Find payment order
    order_result = await db.execute(
        select(PaymentOrder).where(
            PaymentOrder.learner_id == user.id,
            PaymentOrder.status == "paid",
        ).order_by(PaymentOrder.paid_at.desc())
    )
    order = order_result.scalars().first()
    if not order:
        raise HTTPException(status_code=400, detail="No payment order found")

    # Check for existing pending refund
    existing = await db.execute(
        select(RefundRequest).where(
            RefundRequest.learner_id == user.id,
            RefundRequest.status == "pending",
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You already have a pending refund request")

    refund = RefundRequest(
        learner_id=user.id,
        payment_order_id=order.id,
        reason_category=req.reason_category,
        reason_text=req.reason_text,
    )
    db.add(refund)
    await db.commit()

    return {"message": "Refund request submitted. We'll review within 48 hours."}


@router.post("/webhooks/razorpay")
async def razorpay_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.body()
    event_id = request.headers.get("x-razorpay-event-id", "")

    # Verify webhook signature
    if settings.RAZORPAY_WEBHOOK_SECRET:
        received_signature = request.headers.get("x-razorpay-signature", "")
        expected = hmac.new(
            settings.RAZORPAY_WEBHOOK_SECRET.encode(),
            body,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, received_signature):
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    payload = await request.json()

    # Check idempotency
    existing = await db.execute(
        select(WebhookEvent).where(WebhookEvent.idempotency_key == event_id)
    )
    if existing.scalar_one_or_none():
        return {"status": "already_processed"}

    webhook_event = WebhookEvent(
        event_type=payload.get("event", ""),
        idempotency_key=event_id or f"wh_{datetime.now().timestamp()}",
        payload=payload,
    )
    db.add(webhook_event)

    event_type = payload.get("event", "")
    payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})

    if event_type == "payment.captured":
        order_id = payment_entity.get("order_id")
        if order_id:
            result = await db.execute(
                select(PaymentOrder).where(PaymentOrder.razorpay_order_id == order_id)
            )
            order = result.scalar_one_or_none()
            if order and order.status != "paid":
                order.status = "paid"
                order.razorpay_payment_id = payment_entity.get("id")
                order.paid_at = datetime.now(timezone.utc)

                user_result = await db.execute(select(User).where(User.id == order.learner_id))
                u = user_result.scalar_one_or_none()
                if u and not u.paid_at:
                    u.paid_at = datetime.now(timezone.utc)
                    await get_or_create_referral_code(db, u.id, u.first_name)

    elif event_type == "payment.failed":
        order_id = payment_entity.get("order_id")
        if order_id:
            result = await db.execute(
                select(PaymentOrder).where(PaymentOrder.razorpay_order_id == order_id)
            )
            order = result.scalar_one_or_none()
            if order:
                order.status = "failed"

    webhook_event.status = "processed"
    webhook_event.processed_at = datetime.now(timezone.utc)
    await db.commit()

    return {"status": "processed"}
