"""Short-lived, learner-bound signatures for protected media URLs.

Course video and notes used to be served from a plain static mount: the URL
was permanent, unauthenticated, and worked for anyone it was passed to. Pulling
one out of the browser's Network tab was enough to redistribute the content.

A signed URL is tied to the file path, the learner, and an expiry, so a copied
link stops working within minutes and only works for the account it was issued
to. This does not stop someone screen-recording their own session — nothing
served to a browser can — but it removes the trivial copy-the-link route and
makes any leak attributable.
"""
import hashlib
import hmac
import time
from urllib.parse import urlencode

import cloudinary.utils

from app.core.config import settings
from app.services.storage import cloudinary_enabled

# Long enough to start a large video on a slow connection, short enough that a
# leaked URL is worthless by the time it's shared.
DEFAULT_TTL_SECONDS = 900

# Cloudinary-hosted lesson videos are moved to the `authenticated` delivery
# type on upload (see sync_cloudinary_videos.py) — there is no permanent
# public URL for them at all, only ones signed per request.
#
# All of a day's videos are signed up front when the day loads, not lazily
# per click — so this can't be as short as the 900s default without expiring
# a link before a learner scrolls down to part 6. 30 minutes covers a normal
# single sitting; a copied link is still only useful for a half hour instead
# of a quarter of a day.
CLOUDINARY_VIDEO_TTL_SECONDS = 30 * 60


def sign_cloudinary_video_url(public_id: str, ttl: int = CLOUDINARY_VIDEO_TTL_SECONDS) -> str:
    """Build a short-lived, signed URL for a Cloudinary `authenticated`-type video.

    Only issued to a learner already authorized to view the day (the caller
    checks that before this is ever reached), so a copied link works for
    everyone for `ttl` seconds and then for no one.
    """
    if not cloudinary_enabled():
        return ""
    url, _ = cloudinary.utils.cloudinary_url(
        public_id,
        resource_type="video",
        type="authenticated",
        sign_url=True,
        expires_at=int(time.time()) + ttl,
        format="mp4",
        secure=True,
    )
    return url


def _sign(path: str, user_id: str, expires: int, download: bool) -> str:
    # `download` is part of the payload so a viewing link can't be edited into
    # a download link by flipping the query parameter.
    payload = f"{path}|{user_id}|{expires}|{int(download)}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), payload, hashlib.sha256).hexdigest()[:32]


def sign_media_url(
    url: str,
    user_id: str,
    ttl: int = DEFAULT_TTL_SECONDS,
    download: bool = False,
) -> str:
    """Append a signature to a local /media URL.

    `download=True` makes the server send Content-Disposition: attachment, so
    the browser saves the file rather than displaying it. Only issued to
    learners entitled to keep a copy.

    External URLs (Cloudinary, YouTube, Vimeo) are returned untouched — they're
    not ours to sign, and their own access control applies.
    """
    if not url or not url.startswith("/media/"):
        return url

    path = url.removeprefix("/media/")
    expires = int(time.time()) + ttl
    params = {
        "u": user_id,
        "e": expires,
        "s": _sign(path, user_id, expires, download),
    }
    if download:
        params["dl"] = "1"
    return f"{url}?{urlencode(params)}"


def verify_media_signature(
    path: str, user_id: str, expires: str, signature: str, download: bool = False
) -> tuple[bool, str]:
    """Check a signature. Returns (ok, reason_if_not)."""
    if not (user_id and expires and signature):
        return False, "This link is missing its signature."
    try:
        expires_at = int(expires)
    except ValueError:
        return False, "This link is malformed."

    if expires_at < int(time.time()):
        return False, "This link has expired. Reload the page to get a fresh one."

    expected = _sign(path, user_id, expires_at, download)
    # Constant-time compare so the signature can't be recovered by timing.
    if not hmac.compare_digest(expected, signature):
        return False, "This link is not valid."

    return True, ""
