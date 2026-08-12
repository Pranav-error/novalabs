from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "NOVA LABS"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./novalabs.db"

    # Auth
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    OTP_EXPIRE_MINUTES: int = 10

    # Razorpay
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # Email (Resend). Without a key, emails are printed to the console.
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "NOVA LABS <onboarding@resend.dev>"

    # Google OAuth sign-in (optional; login button hides without it)
    GOOGLE_CLIENT_ID: str = ""

    # Code execution (public Wandbox API; no API key needed)
    WANDBOX_URL: str = "https://wandbox.org/api"

    # GitHub (optional token raises the API rate limit from 60 to 5000 req/hour)
    GITHUB_TOKEN: str = ""

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"
    # Path the refresh cookie is scoped to. Must match the URL the browser
    # requests: "/auth" when the frontend calls the API directly, "/api/auth"
    # when it proxies under /api (as the Vercel deployment does).
    REFRESH_COOKIE_PATH: str = "/auth"

    # Rate limits
    LOGIN_RATE_LIMIT: int = 5
    SIGNUP_RATE_LIMIT_PER_HOUR: int = 10
    CODE_EXEC_RATE_LIMIT_PER_HOUR: int = 60
    AI_ANALYSIS_RATE_LIMIT_PER_DAY: int = 5

    # Set to True *only* when running behind a proxy/load balancer that sets
    # X-Forwarded-For (Vercel, nginx, Cloudflare). Enabling it without such a
    # proxy lets any client forge its IP and bypass every rate limit.
    TRUST_PROXY_HEADERS: bool = False

    # Send HSTS and a stricter referrer policy once served over HTTPS.
    SECURITY_HEADERS_ENABLED: bool = True

    # Upload ceilings, in MB. Recorded lecture video routinely exceeds the old
    # hardcoded 500 MB, so this is configurable per deployment. Note that a
    # storage provider may impose its own, lower, per-file limit.
    MAX_VIDEO_UPLOAD_MB: int = 2048
    MAX_MATERIAL_UPLOAD_MB: int = 50

    # Payment
    COURSE_PRICE_PAISE: int = 153282  # ₹1,299 + 18% GST, GST-inclusive
    GST_PERCENT: int = 18  # only used to show the tax split at checkout

    # Web Push (VAPID). Generate a pair with py_vapid; without them the
    # subscribe endpoint reports unavailable and nothing is sent.
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    # Contact address the push service can reach you at, per the VAPID spec.
    VAPID_SUBJECT: str = "mailto:novalabsprivatelimited@gmail.com"

    # Referral economics — defaults only. Once an admin edits these in
    # /admin/referrals the stored value wins; see services/platform_settings.py.
    # Flat amounts so both sides of the offer match: give ₹100, get ₹100.
    # A percentage cannot express ₹100 exactly against a GST-inclusive price.
    REFERRAL_DISCOUNT_PAISE: int = 10000  # what the referred friend saves
    REFERRAL_CREDIT_PAISE: int = 10000  # ₹100 credited to the referrer

    class Config:
        env_file = ".env"


settings = Settings()


# Values that must never reach production. Anything shipped as a placeholder
# is effectively public — a known SECRET_KEY lets anyone forge an admin JWT.
_INSECURE_SECRETS = {
    "change-me-in-production-use-openssl-rand-hex-32",
    "your-secret-key-here-use-openssl-rand-hex-32",
}


def validate_production_config() -> list[str]:
    """Check production settings. Returns warnings; raises on unsafe ones.

    Deliberately fatal rather than advisory: a platform running with a
    placeholder signing key or unverifiable payment webhooks is worse than one
    that refuses to start, because nothing about it looks wrong from outside.
    """
    if settings.DEBUG:
        return []

    fatal: list[str] = []
    warnings: list[str] = []

    if settings.SECRET_KEY in _INSECURE_SECRETS or len(settings.SECRET_KEY) < 32:
        fatal.append(
            "SECRET_KEY is a placeholder or too short — anyone who knows it can "
            "forge any token, including an admin's. Generate one with "
            "`openssl rand -hex 32`."
        )
    if not settings.RAZORPAY_WEBHOOK_SECRET:
        fatal.append(
            "RAZORPAY_WEBHOOK_SECRET is empty — payment webhook signatures cannot "
            "be verified, so payment confirmations can be forged."
        )
    if "resend.dev" in settings.EMAIL_FROM:
        fatal.append(
            "EMAIL_FROM is still Resend's shared sandbox sender "
            f"({settings.EMAIL_FROM!r}) — Resend rejects every recipient except "
            "the account owner, while send_email still reports success, so "
            "verification codes and password resets vanish with no trace. Verify "
            "a domain at resend.com/domains and set EMAIL_FROM to an address on it."
        )
    if "localhost" in settings.FRONTEND_URL or "127.0.0.1" in settings.FRONTEND_URL:
        fatal.append(
            f"FRONTEND_URL is {settings.FRONTEND_URL!r} — password-reset links are "
            "built from it and would point at localhost."
        )

    if settings.DATABASE_URL.startswith("sqlite"):
        warnings.append("DATABASE_URL is SQLite; use PostgreSQL in production.")
    if not settings.RESEND_API_KEY:
        warnings.append(
            "RESEND_API_KEY is empty — password resets and verification codes "
            "will be dropped silently."
        )
    if not settings.CLOUDINARY_CLOUD_NAME:
        warnings.append(
            "Cloudinary is unconfigured — uploads fall back to local disk and are "
            "lost on redeploy."
        )

    if fatal:
        raise RuntimeError(
            "Refusing to start with unsafe production configuration:\n  - "
            + "\n  - ".join(fatal)
        )
    return warnings
