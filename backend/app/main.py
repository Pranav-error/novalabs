import logging
from contextlib import asynccontextmanager

from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.core.config import settings, validate_production_config
from app.core.database import init_db
from app.core.media_signing import verify_media_signature
from app.routers import (
    admin,
    auth,
    certificates,
    code_execution,
    content,
    feed,
    gamification,
    interviews,
    learner,
    payments,
    portfolio,
    progress,
    referrals,
    resume,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail fast on unsafe production config, before serving a single request.
    for warning in validate_production_config():
        logging.getLogger("uvicorn.error").warning(warning)

    await init_db()
    # uvicorn enables ProxyHeadersMiddleware by default, which rewrites
    # request.client from the *left-most* X-Forwarded-For entry whenever the
    # peer is in --forwarded-allow-ips (default 127.0.0.1). Behind a same-host
    # reverse proxy that means a client can forge its own IP and get a fresh
    # rate-limit bucket per request. Rate limiting is only sound if the server
    # is launched to match this setting.
    if not settings.TRUST_PROXY_HEADERS:
        logging.getLogger("uvicorn.error").warning(
            "TRUST_PROXY_HEADERS is off — run uvicorn with --no-proxy-headers, "
            "or clients can forge X-Forwarded-For and bypass every rate limit."
        )
    yield


app = FastAPI(
    title="NOVA LABS API",
    description="30-Day Full-Stack Challenge Platform API",
    version="1.0.0",
    lifespan=lifespan,
)

# Uploaded media (videos etc.) — swap for Cloudinary/S3 in production.
# Deliberately NOT a StaticFiles mount: that served every uploaded file to
# anyone holding the URL, forever. Course content is paid-for, so each request
# must carry a short-lived signature bound to the learner it was issued to.
MEDIA_DIR = Path(__file__).resolve().parent.parent / "uploads"
MEDIA_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/media/{file_path:path}", tags=["Media"])
async def serve_media(file_path: str, request: Request):
    is_download = request.query_params.get("dl") == "1"
    ok, reason = verify_media_signature(
        file_path,
        request.query_params.get("u", ""),
        request.query_params.get("e", ""),
        request.query_params.get("s", ""),
        download=is_download,
    )
    if not ok:
        raise HTTPException(status_code=403, detail=reason)

    # Resolve inside MEDIA_DIR so "../" can't escape the uploads directory.
    target = (MEDIA_DIR / file_path).resolve()
    if not target.is_file() or MEDIA_DIR.resolve() not in target.parents:
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        target,
        # Only a download-signed link gets an attachment disposition, so a
        # viewing link cannot be turned into a save-to-disk link.
        filename=target.name if is_download else None,
        headers={
            # Signed URLs are per-learner and expire; caching them in a shared
            # proxy would hand one learner's link to another.
            "Cache-Control": "private, max-age=300",
            "X-Content-Type-Options": "nosniff",
        },
    )

_allowed_origins = [settings.FRONTEND_URL]
if settings.DEBUG:
    # `flutter run -d chrome` serves the mobile app from its own port, so it
    # needs its own CORS entry. Dev only — never widened in production.
    # (5000 is taken by AirPlay Receiver on macOS, hence 5050.)
    _allowed_origins += ["http://localhost:5050", "http://127.0.0.1:5050"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request, call_next):
    """Baseline response hardening.

    The API serves JSON and user-uploaded files from /media, so the important
    ones are nosniff (stop a browser executing an upload as script) and a frame
    policy (the API should never be embedded).
    """
    response = await call_next(request)
    if not settings.SECURITY_HEADERS_ENABLED:
        return response

    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault(
        "Permissions-Policy", "geolocation=(), microphone=(), camera=()"
    )
    if not settings.DEBUG:
        # Only meaningful over HTTPS, and setting it in dev would pin
        # localhost to https in the browser for a year.
        response.headers.setdefault(
            "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
        )
    return response

app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(learner.router, prefix="/me", tags=["Learner Profile"])
app.include_router(content.router, tags=["Content"])
app.include_router(progress.router, tags=["Progress & Submissions"])
app.include_router(gamification.router, tags=["Gamification"])
app.include_router(certificates.router, tags=["Certificates"])
app.include_router(payments.router, tags=["Payments"])
app.include_router(referrals.router, tags=["Referrals & Coupons"])
app.include_router(feed.router, prefix="/feed", tags=["Community Feed"])
app.include_router(portfolio.router, tags=["Portfolio"])
app.include_router(resume.router, prefix="/resume", tags=["Resume Builder"])
app.include_router(interviews.router, prefix="/interviews", tags=["Mock Interviews"])
app.include_router(code_execution.router, tags=["Code Execution"])
app.include_router(admin.router, prefix="/admin", tags=["Admin"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "NOVA LABS API"}
