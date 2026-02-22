"""
구독 관리 API 엔드포인트
프리미엄 구독 티어 관리 및 기능 게이팅
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

logger = logging.getLogger("pawpalja.subscription")

router = APIRouter()

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
    from backend import user_store
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
    }


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
