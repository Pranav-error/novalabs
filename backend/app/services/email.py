"""Transactional email via Resend. Without an API key, emails are printed
to the server console so dev flows (OTP, password reset) stay testable."""
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger("novalabs.email")

RESEND_URL = "https://api.resend.com/emails"

_WRAPPER = """\
<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px">
  <h2 style="color:#1B2A4A;margin-bottom:4px">NOVA LABS</h2>
  <p style="color:#6b7280;font-size:13px;margin-top:0">30-Day Full-Stack Challenge</p>
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:24px;color:#111827;font-size:15px;line-height:1.6">
    {body}
  </div>
  <p style="color:#9ca3af;font-size:12px;margin-top:16px">
    If you didn't request this, you can safely ignore this email.
  </p>
</div>"""


async def send_email(to: str, subject: str, body_html: str) -> bool:
    """Send an email. Returns True on success. Never raises."""
    html = _WRAPPER.format(body=body_html)

    if not settings.RESEND_API_KEY:
        print(f"\n=== EMAIL (no RESEND_API_KEY — printing instead) ===\n"
              f"To: {to}\nSubject: {subject}\n{body_html}\n"
              f"====================================================\n")
        return True

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                RESEND_URL,
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                json={
                    "from": settings.EMAIL_FROM,
                    "to": [to],
                    "subject": subject,
                    "html": html,
                },
            )
        if resp.status_code in (200, 201):
            return True
        logger.error("Resend error %s: %s", resp.status_code, resp.text[:300])
    except httpx.HTTPError as exc:
        logger.error("Resend unreachable: %s", exc)
    return False


async def send_otp_email(to: str, otp: str) -> bool:
    return await send_email(
        to,
        "Your NOVA LABS verification code",
        f"<p>Your email verification code is:</p>"
        f"<p style='font-size:28px;font-weight:bold;letter-spacing:6px;color:#2F67C7'>{otp}</p>"
        f"<p>It expires in {settings.OTP_EXPIRE_MINUTES} minutes.</p>",
    )


async def send_welcome_email(to: str, first_name: str) -> bool:
    """Sent once, on signup. Deliberately not on every login — repeat mail to the
    same address on routine activity is what gets a sending domain filtered."""
    day_one = f"{settings.FRONTEND_URL}/days/1"
    return await send_email(
        to,
        "Welcome to NOVA LABS — Day 1 is open",
        f"<p>Hi {first_name}, your account is ready.</p>"
        f"<p>Day 1 is free and takes about 45 minutes: a lesson, a quiz and a "
        f"short build. Finish the lesson and the quiz and the day is marked "
        f"complete.</p>"
        f"<p><a href='{day_one}' style='display:inline-block;background:#2F67C7;color:#fff;"
        f"padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold'>"
        f"Start Day 1</a></p>",
    )


async def send_payment_receipt_email(
    to: str, first_name: str, amount_paise: int, order_id: str
) -> bool:
    """Sent once payment is verified, so the learner has a record of the charge."""
    amount = f"₹{amount_paise / 100:,.2f}"
    dashboard = f"{settings.FRONTEND_URL}/dashboard"
    return await send_email(
        to,
        "Payment received — all 30 days unlocked",
        f"<p>Hi {first_name}, your payment went through and every day is now open.</p>"
        f"<p style='font-size:15px'><strong>Amount paid:</strong> {amount}<br>"
        f"<strong>Order:</strong> {order_id}</p>"
        f"<p>This email is your receipt. Refunds are available within 7 days.</p>"
        f"<p><a href='{dashboard}' style='display:inline-block;background:#2F67C7;color:#fff;"
        f"padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold'>"
        f"Go to your dashboard</a></p>",
    )


async def send_password_reset_email(to: str, reset_url: str) -> bool:
    return await send_email(
        to,
        "Reset your NOVA LABS password",
        f"<p>We received a request to reset your password.</p>"
        f"<p><a href='{reset_url}' style='display:inline-block;background:#2F67C7;color:#fff;"
        f"padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold'>"
        f"Reset password</a></p>"
        f"<p style='font-size:13px;color:#6b7280'>This link expires in 30 minutes. "
        f"Or paste this URL into your browser:<br>{reset_url}</p>",
    )
