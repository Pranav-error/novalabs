import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.ratelimit import enforce_rate_limit, rate_limit
from app.core.security import (
    create_access_token,
    create_reset_token,
    generate_otp,
    get_password_hash,
    hash_otp,
    password_fingerprint,
    verify_otp,
    verify_password,
    verify_token,
)
from app.models.auth import OTPVerification, RefreshToken
from app.models.referral import ReferralCode
from app.models.user import User
import secrets as _secrets

import httpx

from app.services.email import send_otp_email, send_password_reset_email, send_welcome_email
from app.services.referral import get_or_create_referral_code
from app.services.gamification import award_xp, grant_badge, record_activity

router = APIRouter()

REFRESH_COOKIE_NAME = "refresh_token"


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    referral_code: str | None = Field(None, max_length=50)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    # Only populated for mobile clients (X-Client-Type: mobile) — web relies on the
    # HttpOnly refresh cookie instead and never sees this in the body.
    refresh_token: str | None = None


def _is_mobile_client(x_client_type: str | None) -> bool:
    return (x_client_type or "").lower() == "mobile"


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    otp: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=128)


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=not settings.DEBUG,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        # Scoped so the token is only ever sent to the auth endpoints. The path
        # must match the URL the *browser* requests, which is not the same as
        # the route path when the frontend proxies the API under a prefix —
        # hence the setting. A mismatch is silent: the cookie is stored and
        # simply never sent, so sessions die at the first refresh.
        path=settings.REFRESH_COOKIE_PATH,
    )


def _clear_refresh_cookie(response: Response) -> None:
    # Must match the path used to set it, or logout leaves the cookie behind.
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path=settings.REFRESH_COOKIE_PATH)


async def _create_refresh_token(user_id: str, db: AsyncSession) -> str:
    """Create a new refresh token, store its hash, and return `{id}.{secret}`.

    Embedding the row ID in the cookie lets /refresh look the token up
    directly instead of bcrypt-scanning every stored token.
    """
    raw_secret = secrets.token_urlsafe(48)
    token_hash = get_password_hash(raw_secret)
    family = secrets.token_hex(8)

    refresh = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        family=family,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(refresh)
    await db.flush()
    return f"{refresh.id}.{raw_secret}"


async def _lookup_refresh_token(cookie_value: str, db: AsyncSession) -> RefreshToken | None:
    """Resolve a `{id}.{secret}` cookie to a valid RefreshToken row, or None."""
    token_id, _, raw_secret = cookie_value.partition(".")
    if not token_id or not raw_secret:
        return None

    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.id == token_id,
            RefreshToken.is_revoked == False,
        )
    )
    token = result.scalar_one_or_none()
    if not token:
        return None

    expires_at = token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None

    if not verify_password(raw_secret, token.token_hash):
        return None
    return token


@router.post(
    "/signup",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit("signup", settings.SIGNUP_RATE_LIMIT_PER_HOUR, 3600))],
)
async def signup(
    req: SignupRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    x_client_type: str | None = Header(None),
):
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    referred_by = None
    if req.referral_code:
        code_result = await db.execute(
            select(ReferralCode).where(
                ReferralCode.code == req.referral_code.lower(),
                ReferralCode.is_active == True,
            )
        )
        if code_result.scalar_one_or_none():
            referred_by = req.referral_code.lower()

    user = User(
        email=req.email,
        password_hash=get_password_hash(req.password),
        first_name=req.first_name,
        last_name=req.last_name,
        referred_by_code=referred_by,
    )
    db.add(user)
    await db.flush()

    # Every signup gets a referral code, not just paid unlocks
    await get_or_create_referral_code(db, user.id, user.first_name)

    # Generate OTP for email verification
    otp = generate_otp()
    otp_record = OTPVerification(
        user_id=user.id,
        otp_hash=hash_otp(otp),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
    )
    db.add(otp_record)

    await send_otp_email(user.email, otp)
    # Once, on signup. Not on login: repeat mail on routine activity is what
    # gets a sending domain filtered.
    await send_welcome_email(user.email, user.first_name)

    access_token = create_access_token({"sub": user.id})
    raw_refresh = await _create_refresh_token(user.id, db)
    _set_refresh_cookie(response, raw_refresh)

    await grant_badge(db, user.id, "first_login")
    await award_xp(db, user.id, "daily_login", once_per_day=True)
    await record_activity(db, user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh if _is_mobile_client(x_client_type) else None,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit("login", settings.LOGIN_RATE_LIMIT, 60))],
)
async def login(
    req: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    x_client_type: str | None = Header(None),
):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if user.is_suspended:
        raise HTTPException(status_code=403, detail="Account suspended")

    access_token = create_access_token({"sub": user.id})
    raw_refresh = await _create_refresh_token(user.id, db)
    _set_refresh_cookie(response, raw_refresh)

    await grant_badge(db, user.id, "first_login")
    await award_xp(db, user.id, "daily_login", once_per_day=True)
    await record_activity(db, user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh if _is_mobile_client(x_client_type) else None,
    )


class RefreshRequest(BaseModel):
    # Mobile clients pass their stored refresh token here instead of a cookie.
    refresh_token: str | None = None


@router.post(
    "/refresh",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit("refresh", 60, 3600))],
)
async def refresh_token(
    response: Response,
    req: RefreshRequest | None = None,
    db: AsyncSession = Depends(get_db),
    refresh_token: str | None = Cookie(None, alias=REFRESH_COOKIE_NAME),
    x_client_type: str | None = Header(None),
):
    incoming_token = (req.refresh_token if req else None) or refresh_token
    if not incoming_token:
        raise HTTPException(status_code=401, detail="No refresh token")

    matched_token = await _lookup_refresh_token(incoming_token, db)

    if not matched_token:
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    # Rotate: revoke old, issue new
    matched_token.is_revoked = True

    new_access = create_access_token({"sub": matched_token.user_id})
    new_raw_refresh = await _create_refresh_token(matched_token.user_id, db)
    _set_refresh_cookie(response, new_raw_refresh)

    return TokenResponse(
        access_token=new_access,
        refresh_token=new_raw_refresh if _is_mobile_client(x_client_type) else None,
    )


@router.post("/logout")
async def logout(
    response: Response,
    req: RefreshRequest | None = None,
    db: AsyncSession = Depends(get_db),
    refresh_token: str | None = Cookie(None, alias=REFRESH_COOKIE_NAME),
):
    incoming_token = (req.refresh_token if req else None) or refresh_token
    if incoming_token:
        matched = await _lookup_refresh_token(incoming_token, db)
        if matched:
            matched.is_revoked = True

    _clear_refresh_cookie(response)
    return {"message": "Logged out"}


@router.post(
    "/verify-email",
    dependencies=[Depends(rate_limit("verify_email_ip", 20, 3600))],
)
async def verify_email(req: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    # The OTP is six digits. Capped per-address as well as per-IP, because an
    # attacker grinding one account will simply rotate IPs — 10/hour makes a
    # 1-in-a-million guess hopeless, while leaving room for genuine typos.
    enforce_rate_limit("verify_email_addr", req.email, 10, 3600)

    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Newest unused code wins. `.first()` rather than `scalar_one_or_none()`:
    # a resend legitimately leaves more than one unused row, which used to
    # raise MultipleResultsFound and 500.
    otp_result = await db.execute(
        select(OTPVerification)
        .where(OTPVerification.user_id == user.id, OTPVerification.is_used == False)  # noqa: E712
        .order_by(OTPVerification.created_at.desc())
    )
    otp_record = otp_result.scalars().first()

    # SQLite hands back naive datetimes, so this comparison raised TypeError
    # against an aware "now" — the same workaround exists in payments.py.
    expires_at = otp_record.expires_at if otp_record else None
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if not otp_record or expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP expired or not found")

    if not verify_otp(req.otp, otp_record.otp_hash):
        raise HTTPException(status_code=400, detail="Invalid OTP")

    # Retire every outstanding code, not just the one used — a resend leaves
    # older ones live, and they should not remain usable after verification.
    await db.execute(
        update(OTPVerification)
        .where(OTPVerification.user_id == user.id, OTPVerification.is_used == False)  # noqa: E712
        .values(is_used=True)
    )
    user.email_verified = True
    return {"message": "Email verified successfully"}


@router.post(
    "/resend-verification",
    dependencies=[Depends(rate_limit("resend_verification_ip", 10, 3600))],
)
async def resend_verification(req: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    # Per-address too, so nobody can use this to mail-bomb someone or burn
    # through the email provider's quota.
    enforce_rate_limit("resend_verification_addr", req.email, 3, 3600)

    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user:
        return {"message": "If the email exists, a verification code has been sent"}

    otp = generate_otp()
    otp_record = OTPVerification(
        user_id=user.id,
        otp_hash=hash_otp(otp),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
    )
    db.add(otp_record)
    await send_otp_email(user.email, otp)
    return {"message": "If the email exists, a verification code has been sent"}


@router.post(
    "/forgot-password",
    dependencies=[Depends(rate_limit("forgot_password", 5, 3600))],
)
async def forgot_password(req: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    enforce_rate_limit("forgot_password_addr", req.email, 3, 3600)

    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if user:
        token = create_reset_token(user.id, user.password_hash)
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        await send_password_reset_email(user.email, reset_url)
    # Same response either way so the endpoint can't be used to probe emails
    return {"message": "If the email exists, a password reset link has been sent"}


@router.post(
    "/reset-password",
    dependencies=[Depends(rate_limit("reset_password", 10, 3600))],
)
async def reset_password(req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    payload = verify_token(req.token)
    if not payload or payload.get("type") != "reset":
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # The link is bound to the password it was issued against, so it stops
    # working once used. Without this a reset link stays valid for its full
    # 30 minutes and can be replayed by anyone who sees the email.
    if payload.get("pwf") != password_fingerprint(user.password_hash):
        raise HTTPException(status_code=400, detail="This reset link has already been used")

    user.password_hash = get_password_hash(req.new_password)

    # Resetting a password must end every other session — otherwise someone
    # who already signed in keeps their access after the owner locks them out.
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.is_revoked == False)  # noqa: E712
        .values(is_revoked=True)
    )
    return {"message": "Password reset successfully"}


class GoogleLoginRequest(BaseModel):
    credential: str  # Google Identity Services ID token


GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"


@router.post(
    "/google",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit("google_login", settings.LOGIN_RATE_LIMIT, 60))],
)
async def google_login(
    req: GoogleLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    x_client_type: str | None = Header(None),
):
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(GOOGLE_TOKENINFO_URL, params={"id_token": req.credential})
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="Could not verify Google sign-in. Try again.")

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google credential")
    info = resp.json()

    if info.get("aud") != settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=401, detail="Invalid Google credential")
    if info.get("email_verified") not in (True, "true"):
        raise HTTPException(status_code=401, detail="Google account email is not verified")

    email = info["email"].lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            email=email,
            # Google users have no password; store an unguessable one
            password_hash=get_password_hash(_secrets.token_urlsafe(32)),
            first_name=info.get("given_name") or "Learner",
            last_name=info.get("family_name") or "",
            email_verified=True,
        )
        db.add(user)
        await db.flush()
        await get_or_create_referral_code(db, user.id, user.first_name)
        await grant_badge(db, user.id, "first_login")

    if user.is_suspended:
        raise HTTPException(status_code=403, detail="Account suspended")

    # Google verified this email, so mark existing accounts verified too
    user.email_verified = True

    access_token = create_access_token({"sub": user.id})
    raw_refresh = await _create_refresh_token(user.id, db)
    _set_refresh_cookie(response, raw_refresh)

    await award_xp(db, user.id, "daily_login", once_per_day=True)
    await record_activity(db, user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh if _is_mobile_client(x_client_type) else None,
    )


@router.get("/sessions")
async def list_sessions(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user.id, RefreshToken.is_revoked == False
        )
    )
    tokens = result.scalars().all()
    return [{"id": t.id, "created_at": t.created_at} for t in tokens]


@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.id == session_id, RefreshToken.user_id == user.id)
    )
    token = result.scalar_one_or_none()
    if not token:
        raise HTTPException(status_code=404, detail="Session not found")

    token.is_revoked = True
    return {"message": "Session revoked"}
