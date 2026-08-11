import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

_BCRYPT_ROUNDS = 12


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=_BCRYPT_ROUNDS)).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def password_fingerprint(password_hash: str) -> str:
    """Short digest of a stored password hash, used to make reset links single-use.

    Binding the link to the password it was issued against means the link stops
    working the moment the password changes — without a schema migration and
    without unrelated profile edits invalidating a pending link.
    """
    return hashlib.sha256(password_hash.encode()).hexdigest()[:16]


def create_reset_token(user_id: str, password_hash: str) -> str:
    """Short-lived single-use token for password reset links (type='reset')."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=30)
    return jwt.encode(
        {
            "sub": user_id,
            "exp": expire,
            "type": "reset",
            "pwf": password_fingerprint(password_hash),
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def verify_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def generate_otp() -> str:
    return f"{secrets.randbelow(1000000):06d}"


def hash_otp(otp: str) -> str:
    # Use HMAC-SHA256 for OTP hashing (faster than bcrypt for short codes)
    return hmac.new(settings.SECRET_KEY.encode(), otp.encode(), hashlib.sha256).hexdigest()


def verify_otp(plain_otp: str, hashed_otp: str) -> bool:
    expected = hmac.new(settings.SECRET_KEY.encode(), plain_otp.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, hashed_otp)


def verify_razorpay_signature(order_id: str, payment_id: str, signature: str, secret: str) -> bool:
    message = f"{order_id}|{payment_id}"
    expected = hmac.new(
        secret.encode(), message.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def generate_referral_code(first_name: str) -> str:
    random_part = secrets.token_hex(3).upper()
    return f"{first_name.lower()}-{random_part}"
