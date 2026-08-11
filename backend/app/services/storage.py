"""File storage: Cloudinary when configured, local ./uploads fallback for dev.

Cloudinary resource types:
  - videos  -> resource_type="video"
  - notes/documents (ppt, pdf, ...) -> resource_type="raw" (served as-is)
"""
import asyncio
import uuid
from pathlib import Path

import cloudinary
import cloudinary.uploader

from app.core.config import settings

UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"

_configured = False


def cloudinary_enabled() -> bool:
    global _configured
    if not (
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    ):
        return False
    if not _configured:
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )
        _configured = True
    return True


async def store_file(
    fileobj, filename: str, folder: str, resource_type: str
) -> dict:
    """Save an uploaded file. Returns {url, public_id, storage}.

    fileobj: a binary file-like object positioned at the start.
    folder: e.g. "novalabs/videos" or "novalabs/materials".
    resource_type: "video" or "raw".
    """
    ext = Path(filename).suffix.lower()

    if cloudinary_enabled():
        def _upload():
            # upload_large streams in chunks — required for files >100 MB
            return cloudinary.uploader.upload_large(
                fileobj,
                folder=folder,
                resource_type=resource_type,
                # keep the extension in the public id so raw files download
                # with the right type (Cloudinary serves raw files verbatim)
                public_id=f"{uuid.uuid4().hex}{ext if resource_type == 'raw' else ''}",
                chunk_size=6_000_000,
            )

        result = await asyncio.to_thread(_upload)
        return {
            "url": result["secure_url"],
            "public_id": result["public_id"],
            "storage": "cloudinary",
        }

    # Local fallback (dev only)
    subdir = folder.split("/")[-1]
    dest_dir = UPLOADS_DIR / subdir
    dest_dir.mkdir(parents=True, exist_ok=True)
    fname = f"{uuid.uuid4().hex}{ext}"
    dest = dest_dir / fname
    with open(dest, "wb") as out:
        while chunk := fileobj.read(1024 * 1024):
            out.write(chunk)
    return {"url": f"/media/{subdir}/{fname}", "public_id": None, "storage": "local"}


async def delete_file(url: str, public_id: str | None, resource_type: str) -> None:
    """Best-effort delete from whichever backend holds the file."""
    if public_id and cloudinary_enabled():
        try:
            await asyncio.to_thread(
                cloudinary.uploader.destroy, public_id, resource_type=resource_type
            )
        except Exception:
            pass
        return
    if url.startswith("/media/"):
        path = UPLOADS_DIR / url.removeprefix("/media/")
        # guard against path escape
        if path.resolve().is_relative_to(UPLOADS_DIR.resolve()):
            path.unlink(missing_ok=True)
