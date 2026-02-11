"""
Web Push notification endpoints: subscribe, unsubscribe, test, and VAPID public key.
"""
import os
import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from pywebpush import webpush, WebPushException

from backend.database import get_db
from backend.auth import get_current_user
from backend.models import PushSubscription, User
from backend.schemas import PushSubscribeRequest

logger = logging.getLogger("pawpalja.push")

router = APIRouter()

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_CONTACT_EMAIL = os.getenv("VAPID_CONTACT_EMAIL", "mailto:admin@pawpalja.com")


@router.get("/push/vapid-public-key")
async def get_vapid_public_key():
    """Return the VAPID public key so the frontend can subscribe."""
    if not VAPID_PUBLIC_KEY:
        raise HTTPException(status_code=500, detail="VAPID keys not configured")
    return {"vapid_public_key": VAPID_PUBLIC_KEY}


@router.post("/push/subscribe")
async def push_subscribe(
    req: PushSubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save or update a push subscription for the current user."""
    # Check if this endpoint already exists for this user
    stmt = select(PushSubscription).where(
        PushSubscription.user_id == current_user.user_id,
        PushSubscription.endpoint == req.endpoint,
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        existing.p256dh = req.p256dh
        existing.auth_key = req.auth_key
    else:
        sub = PushSubscription(
            user_id=current_user.user_id,
            endpoint=req.endpoint,
            p256dh=req.p256dh,
            auth_key=req.auth_key,
        )
        db.add(sub)

    await db.commit()
    return {"status": "subscribed"}


@router.delete("/push/unsubscribe")
async def push_unsubscribe(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove all push subscriptions for the current user."""
    stmt = delete(PushSubscription).where(
        PushSubscription.user_id == current_user.user_id
    )
    await db.execute(stmt)
    await db.commit()
    return {"status": "unsubscribed"}


@router.post("/push/test")
async def push_test(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a test push notification to the current user."""
    stmt = select(PushSubscription).where(
        PushSubscription.user_id == current_user.user_id
    )
    result = await db.execute(stmt)
    subscriptions = result.scalars().all()

    if not subscriptions:
        raise HTTPException(status_code=404, detail="No push subscription found")

    dog_name = ""
    if current_user.dog_profile:
        dog_name = current_user.dog_profile.name

    payload = json.dumps({
        "title": "Paw-Palja",
        "body": f"{dog_name or 'Your pup'}'s diary reminder - this is a test!",
        "url": "/home",
    })

    sent = 0
    for sub in subscriptions:
        try:
            _send_push(sub, payload)
            sent += 1
        except WebPushException as e:
            logger.warning(f"Push failed for {sub.endpoint[:50]}...: {e}")
            # Remove stale subscriptions (410 Gone or 404)
            if hasattr(e, 'response') and e.response is not None and e.response.status_code in (404, 410):
                await db.delete(sub)

    await db.commit()
    return {"status": "sent", "delivered": sent, "total": len(subscriptions)}


def _send_push(subscription: PushSubscription, payload: str):
    """Send a single web push notification."""
    if not VAPID_PRIVATE_KEY:
        raise WebPushException("VAPID private key not configured")

    webpush(
        subscription_info={
            "endpoint": subscription.endpoint,
            "keys": {
                "p256dh": subscription.p256dh,
                "auth": subscription.auth_key,
            },
        },
        data=payload,
        vapid_private_key=VAPID_PRIVATE_KEY,
        vapid_claims={"sub": VAPID_CONTACT_EMAIL},
    )


def send_push_to_user_subscriptions(subscriptions, payload: str):
    """Send push to a list of PushSubscription objects. Used by scheduler."""
    results = []
    for sub in subscriptions:
        try:
            _send_push(sub, payload)
            results.append(("ok", sub.id))
        except WebPushException as e:
            logger.warning(f"Push failed for subscription {sub.id}: {e}")
            results.append(("fail", sub.id))
    return results
