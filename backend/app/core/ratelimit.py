import time
from collections import defaultdict

from fastapi import HTTPException, Request

from app.core.config import settings

# In-memory sliding-window rate limiter (per process).
# Keyed by (scope, identity) -> list of request timestamps.
_hits: dict[tuple[str, str], list[float]] = defaultdict(list)

# Stale keys are swept periodically so a flood of distinct identities can't
# grow this dict without bound — otherwise the limiter itself becomes a
# memory-exhaustion vector for anyone rotating clients.
_last_sweep = 0.0
_SWEEP_INTERVAL_SECONDS = 300
_MAX_TRACKED_KEYS = 50_000


def _sweep(now: float, window_seconds: int) -> None:
    global _last_sweep
    if now - _last_sweep < _SWEEP_INTERVAL_SECONDS and len(_hits) < _MAX_TRACKED_KEYS:
        return
    _last_sweep = now
    cutoff = now - max(window_seconds, 3600)
    for key in [k for k, ts in _hits.items() if not ts or ts[-1] < cutoff]:
        del _hits[key]


def _client_ip(request: Request) -> str:
    """The caller's IP.

    X-Forwarded-For is only honoured when the app really is behind a proxy that
    sets it (TRUST_PROXY_HEADERS). Otherwise any client could send an arbitrary
    value and get a fresh bucket on every request, which would make every rate
    limit in the app decorative.
    """
    if settings.TRUST_PROXY_HEADERS:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            # The right-most entry is the one appended by our own proxy; entries
            # to the left are client-supplied and trivially forged.
            return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


def _consume(scope: str, identity: str, max_requests: int, window_seconds: int) -> None:
    key = (scope, identity)
    now = time.monotonic()
    _sweep(now, window_seconds)
    window_start = now - window_seconds

    timestamps = _hits[key]
    while timestamps and timestamps[0] < window_start:
        timestamps.pop(0)

    if len(timestamps) >= max_requests:
        retry_after = int(timestamps[0] + window_seconds - now) + 1
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )

    timestamps.append(now)


def rate_limit(scope: str, max_requests: int, window_seconds: int):
    """Dependency factory: limit requests per client IP within a sliding window."""

    async def _check(request: Request) -> None:
        _consume(scope, _client_ip(request), max_requests, window_seconds)

    return _check


def enforce_rate_limit(scope: str, identity: str, max_requests: int, window_seconds: int) -> None:
    """Limit by something other than IP — an email, a user id.

    Call this inside a handler for anything an attacker would rotate IPs to
    grind at (OTP guessing being the obvious case), where a per-IP cap alone
    doesn't protect the account actually being targeted.
    """
    _consume(scope, identity.lower().strip(), max_requests, window_seconds)
