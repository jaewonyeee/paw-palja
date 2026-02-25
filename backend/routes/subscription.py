"""
구독 관리 API 엔드포인트
프리미엄 구독 티어 관리, Stripe 결제 연동 및 기능 게이팅
"""
import os
import logging
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from backend.auth import get_current_user, require_admin
from backend.database import get_db
from backend.i18n import get_message, get_lang

import stripe

logger = logging.getLogger("pawpalja.subscription")

router = APIRouter()

# Stripe configuration
stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID", "")
STRIPE_SUCCESS_URL = os.getenv("STRIPE_SUCCESS_URL", "http://localhost:8000/pricing?payment=success")
STRIPE_CANCEL_URL = os.getenv("STRIPE_CANCEL_URL", "http://localhost:8000/pricing?payment=cancelled")

STRIPE_LOCALE_MAP = {
    "ko": "ko",
    "en": "en",
    "ja": "ja",
    "zh": "zh",
    "es": "es",
}

# Tier definitions
TIERS = {
    "free": {
        "name_ko": "무료",
        "name_en": "Free",
        "diary_limit": 3,
        "comment_limit": 3,
        "photo_analysis": False,
        "illustration": False,
        "voice_input": False,
        "tts": False,
        "detailed_health": False,
        "price": 0,
    },
    "premium": {
        "name_ko": "프리미엄",
        "name_en": "Premium",
        "diary_limit": -1,  # unlimited
        "comment_limit": 5,
        "photo_analysis": True,
        "illustration": True,
        "voice_input": True,
        "tts": True,
        "detailed_health": True,
        "price": 9900,
    },
}


class SubscriptionUpdate(BaseModel):
    user_id: str
    tier: str  # "free" or "premium"
    duration_days: int = 30


@router.get("/subscription/tiers")
async def get_tiers():
    """구독 티어 정보를 반환합니다."""
    return {"tiers": TIERS}


@router.get("/subscription/me")
async def get_my_subscription(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """현재 사용자의 구독 정보를 반환합니다."""
    from backend.models import User
    from sqlalchemy import select

    stmt = select(User).where(User.user_id == current_user["user_id"])
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    tier = getattr(user, "subscription_tier", "free") or "free"
    expires = getattr(user, "subscription_expires", None)

    # Check if subscription has expired
    if tier == "premium" and expires:
        if expires.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            tier = "free"

    tier_info = TIERS.get(tier, TIERS["free"])

    return {
        "tier": tier,
        "tier_info": tier_info,
        "expires": expires.isoformat() if expires else None,
        "is_premium": tier == "premium",
        "has_stripe_customer": bool(getattr(user, "stripe_customer_id", None)),
    }


@router.post("/subscription/create-checkout-session")
async def create_checkout_session(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stripe Checkout 세션을 생성합니다."""
    if not stripe.api_key or not STRIPE_PRICE_ID:
        raise HTTPException(status_code=503, detail="Payment system not configured")

    from backend.models import User
    from sqlalchemy import select

    stmt = select(User).where(User.user_id == current_user["user_id"])
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if already premium
    tier = getattr(user, "subscription_tier", "free") or "free"
    expires = getattr(user, "subscription_expires", None)
    if tier == "premium" and expires:
        if expires.replace(tzinfo=timezone.utc) > datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Already subscribed to premium")

    # Reuse existing Stripe customer or create a new one
    stripe_customer_id = getattr(user, "stripe_customer_id", None)
    if not stripe_customer_id:
        customer = stripe.Customer.create(
            metadata={"pawpalja_user_id": user.user_id},
            name=user.nickname,
            email=user.email,
        )
        stripe_customer_id = customer.id
        user.stripe_customer_id = stripe_customer_id
        await db.commit()

    # Determine locale for Stripe Checkout page
    lang = getattr(request.state, "lang", "ko")
    stripe_locale = STRIPE_LOCALE_MAP.get(lang, "auto")

    checkout_session = stripe.checkout.Session.create(
        customer=stripe_customer_id,
        mode="subscription",
        payment_method_types=["card"],
        line_items=[{"price": STRIPE_PRICE_ID, "quantity": 1}],
        success_url=STRIPE_SUCCESS_URL,
        cancel_url=STRIPE_CANCEL_URL,
        locale=stripe_locale,
        metadata={"pawpalja_user_id": user.user_id},
        subscription_data={
            "metadata": {"pawpalja_user_id": user.user_id},
        },
    )

    logger.info("Stripe checkout session created for user %s: %s", user.user_id, checkout_session.id)

    return {"checkout_url": checkout_session.url}


@router.post("/subscription/create-portal-session")
async def create_portal_session(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stripe Customer Portal 세션을 생성합니다 (구독 관리/해지)."""
    if not stripe.api_key:
        raise HTTPException(status_code=503, detail="Payment system not configured")

    from backend.models import User
    from sqlalchemy import select

    stmt = select(User).where(User.user_id == current_user["user_id"])
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    stripe_customer_id = getattr(user, "stripe_customer_id", None)
    if not stripe_customer_id:
        raise HTTPException(status_code=400, detail="No subscription found")

    return_url = STRIPE_SUCCESS_URL.rsplit("/pricing", 1)[0] + "/profile"

    portal_session = stripe.billing_portal.Session.create(
        customer=stripe_customer_id,
        return_url=return_url,
    )

    return {"portal_url": portal_session.url}


@router.post("/subscription/webhook")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Stripe webhook 이벤트를 처리합니다. (인증 불요 — Stripe 서명으로 검증)"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not sig_header or not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=400, detail="Missing signature or webhook secret")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except stripe.SignatureVerificationError:
        logger.warning("Stripe webhook signature verification failed")
        raise HTTPException(status_code=400, detail="Invalid signature")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")

    event_type = event["type"]
    data_object = event["data"]["object"]

    logger.info("Stripe webhook received: %s (id=%s)", event_type, event.get("id"))

    from backend.models import User
    from sqlalchemy import select

    if event_type == "checkout.session.completed":
        user_id = data_object.get("metadata", {}).get("pawpalja_user_id")
        if user_id:
            stmt = select(User).where(User.user_id == user_id)
            result = await db.execute(stmt)
            user = result.scalar_one_or_none()
            if user:
                user.subscription_tier = "premium"
                user.subscription_expires = datetime.now(timezone.utc) + timedelta(days=32)
                if not user.stripe_customer_id and data_object.get("customer"):
                    user.stripe_customer_id = data_object["customer"]
                await db.commit()
                logger.info("User %s upgraded to premium via Stripe checkout", user_id)

    elif event_type == "invoice.paid":
        customer_id = data_object.get("customer")
        if customer_id:
            stmt = select(User).where(User.stripe_customer_id == customer_id)
            result = await db.execute(stmt)
            user = result.scalar_one_or_none()
            if user:
                user.subscription_tier = "premium"
                user.subscription_expires = datetime.now(timezone.utc) + timedelta(days=32)
                await db.commit()
                logger.info("User %s subscription renewed via invoice.paid", user.user_id)

    elif event_type == "customer.subscription.updated":
        customer_id = data_object.get("customer")
        status = data_object.get("status")
        if customer_id:
            stmt = select(User).where(User.stripe_customer_id == customer_id)
            result = await db.execute(stmt)
            user = result.scalar_one_or_none()
            if user:
                if status in ("active", "trialing"):
                    current_period_end = data_object.get("current_period_end")
                    if current_period_end:
                        user.subscription_expires = datetime.fromtimestamp(
                            current_period_end, tz=timezone.utc
                        )
                    user.subscription_tier = "premium"
                elif status in ("canceled", "unpaid", "past_due"):
                    cancel_at_period_end = data_object.get("cancel_at_period_end", False)
                    if not cancel_at_period_end and status == "canceled":
                        user.subscription_tier = "free"
                        user.subscription_expires = None
                await db.commit()
                logger.info("User %s subscription updated: status=%s", user.user_id, status)

    elif event_type == "customer.subscription.deleted":
        customer_id = data_object.get("customer")
        if customer_id:
            stmt = select(User).where(User.stripe_customer_id == customer_id)
            result = await db.execute(stmt)
            user = result.scalar_one_or_none()
            if user:
                user.subscription_tier = "free"
                user.subscription_expires = None
                await db.commit()
                logger.info("User %s subscription deleted (downgraded to free)", user.user_id)

    return {"received": True}


@router.post("/subscription/admin/update")
async def admin_update_subscription(
    request: Request,
    data: SubscriptionUpdate,
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """관리자가 사용자의 구독 티어를 변경합니다."""
    if data.tier not in TIERS:
        raise HTTPException(status_code=400, detail="Invalid tier")

    from backend.models import User
    from sqlalchemy import select

    stmt = select(User).where(User.user_id == data.user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.subscription_tier = data.tier
    if data.tier == "premium":
        user.subscription_expires = datetime.now(timezone.utc) + timedelta(days=data.duration_days)
    else:
        user.subscription_expires = None

    await db.commit()

    logger.info("Admin %s updated subscription for %s to %s", admin["user_id"], data.user_id, data.tier)

    return {
        "success": True,
        "user_id": data.user_id,
        "tier": data.tier,
        "expires": user.subscription_expires.isoformat() if user.subscription_expires else None,
    }
