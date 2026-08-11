"""In-app notification writer. Flushes but never commits."""
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.social import Notification
from app.services.push import send_push

# Where the browser should land when a pushed notification is clicked.
_PUSH_TARGETS: dict[str, str] = {
    "submission_reviewed": "/dashboard",
    "badge_earned": "/profile",
    "certificate_issued": "/certificates",
    "refund_decision": "/dashboard",
    "doubt_reply": "/community",
    "announcement": "/dashboard",
}


async def notify(
    db: AsyncSession,
    recipient_id: str,
    type: str,
    title: str,
    body: str | None = None,
    reference_id: str | None = None,
    reference_type: str | None = None,
    push: bool = True,
) -> None:
    """Write the in-app notification and, by default, push it.

    Callers writing many rows in a loop should pass `push=False` and fan the
    pushes out concurrently afterwards; awaiting a network round trip per
    recipient inside the loop makes a broadcast take as long as the sum of it.
    """
    db.add(Notification(
        recipient_id=recipient_id,
        type=type,
        title=title,
        body=body,
        reference_id=reference_id,
        reference_type=reference_type,
    ))

    # Best effort, and never raises: the row above is the source of truth, so a
    # push failure must not roll back the notification or the caller's work.
    if push:
        await send_push(db, recipient_id, title, body, push_target(type))


def push_target(type: str) -> str:
    return _PUSH_TARGETS.get(type, "/dashboard")
