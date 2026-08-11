"""Web Push delivery.

Sends to every browser a learner has subscribed. Failures never propagate: a
notification row is already written by `notify()`, and the in-app bell is the
source of truth — push is a best-effort nudge on top of it.
"""
import asyncio
import json
import logging

from pywebpush import WebPushException, webpush
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.push import PushSubscription

logger = logging.getLogger("novalabs.push")

# The push service drops a subscription permanently on these; anything else
# (rate limits, transient 5xx) is worth keeping the row for.
_DEAD_SUBSCRIPTION_CODES = {404, 410}


def push_enabled() -> bool:
    return bool(settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY)


def _deliver(sub: PushSubscription, payload: str) -> bool:
    """One blocking send. Returns True if delivered, False if the browser
    dropped the subscription. Raises for anything worth keeping the row for."""
    try:
        webpush(
            subscription_info={
                "endpoint": sub.endpoint,
                "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
            },
            data=payload,
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_SUBJECT},
            timeout=10,
        )
        return True
    except WebPushException as exc:
        if getattr(exc.response, "status_code", None) in _DEAD_SUBSCRIPTION_CODES:
            return False
        raise


async def send_push_many(
    db: AsyncSession,
    user_ids: list[str],
    title: str,
    body: str | None = None,
    url: str = "/dashboard",
) -> int:
    """Push to every browser of every listed user. Returns deliveries.

    All database work happens before and after the fan-out, never inside it:
    an AsyncSession cannot be driven by concurrent tasks, so gathering calls
    that each query the session would corrupt it.
    """
    if not push_enabled() or not user_ids:
        return 0

    subs = (
        await db.execute(
            select(PushSubscription).where(PushSubscription.user_id.in_(user_ids))
        )
    ).scalars().all()
    if not subs:
        return 0

    payload = json.dumps({"title": title, "body": body or "", "url": url})

    # pywebpush is synchronous, so each send goes to a worker thread; calling it
    # inline would block the event loop for up to `timeout` per subscription.
    results = await asyncio.gather(
        *(asyncio.to_thread(_deliver, sub, payload) for sub in subs),
        return_exceptions=True,
    )

    delivered = 0
    for sub, result in zip(subs, results):
        if result is True:
            delivered += 1
        elif result is False:
            # Unsubscribed browsers never come back; drop the row.
            await db.delete(sub)
        else:
            logger.warning("Push error for %s: %s", sub.user_id, result)

    return delivered


async def send_push(
    db: AsyncSession,
    user_id: str,
    title: str,
    body: str | None = None,
    url: str = "/dashboard",
) -> int:
    """Push to all of one user's browsers. Returns how many were delivered."""
    return await send_push_many(db, [user_id], title, body, url)
