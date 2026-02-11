"""
Social features: share diary entries via public links and public profiles.
"""
import secrets
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.auth import get_current_user
from backend.models import User, DiaryEntry, DogProfile
from backend.user_store import _dog_to_dict
from backend.i18n import get_message, get_lang

logger = logging.getLogger("pawpalja.social")

router = APIRouter(tags=["social"])


# ---- Share / Unshare a diary entry ----

@router.post("/diary/{entry_id}/share")
async def share_diary(
    entry_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    lang = get_lang(request)
    stmt = select(DiaryEntry).where(DiaryEntry.entry_id == entry_id)
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()

    if not entry:
        raise HTTPException(status_code=404, detail=get_message("entry_not_found", lang))
    if entry.user_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail=get_message("entry_not_owned", lang))

    if not entry.share_token:
        entry.share_token = secrets.token_urlsafe(16)
    entry.is_public = True
    await db.commit()
    await db.refresh(entry)

    return {
        "share_token": entry.share_token,
        "share_url": f"/share/{entry.share_token}",
        "is_public": True,
    }


@router.delete("/diary/{entry_id}/share")
async def unshare_diary(
    entry_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    lang = get_lang(request)
    stmt = select(DiaryEntry).where(DiaryEntry.entry_id == entry_id)
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()

    if not entry:
        raise HTTPException(status_code=404, detail=get_message("entry_not_found", lang))
    if entry.user_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail=get_message("entry_not_owned", lang))

    entry.is_public = False
    entry.share_token = None
    await db.commit()

    return {"ok": True}


# ---- Public shared diary view ----

@router.get("/share/{share_token}")
async def get_shared_diary(
    share_token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    lang = get_lang(request)
    stmt = select(DiaryEntry).where(
        DiaryEntry.share_token == share_token,
        DiaryEntry.is_public == True,  # noqa: E712
    )
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()

    if not entry:
        raise HTTPException(status_code=404, detail=get_message("shared_entry_not_found", lang))

    # Increment view count
    entry.view_count = (entry.view_count or 0) + 1
    await db.commit()

    # Fetch author info (nickname + dog)
    user = await db.get(User, entry.user_id)
    dog = _dog_to_dict(user.dog_profile) if user else {}

    return {
        "entry_id": entry.entry_id,
        "date": entry.date,
        "diary": entry.diary,
        "horoscope": entry.horoscope,
        "health": entry.health,
        "comments": entry.comments or [],
        "photo": entry.photo,
        "view_count": entry.view_count,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
        "author": {
            "nickname": user.nickname if user else "Unknown",
            "dog": dog,
            "user_id": user.user_id if user else None,
        },
    }


# ---- Public profile ----

@router.get("/profile/{user_id}/public")
async def get_public_profile(
    user_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    lang = get_lang(request)
    user = await db.get(User, user_id)

    if not user or not user.is_profile_public:
        raise HTTPException(status_code=404, detail=get_message("profile_not_public", lang))

    # Count public diaries
    count_stmt = select(func.count()).select_from(DiaryEntry).where(
        DiaryEntry.user_id == user_id,
        DiaryEntry.is_public == True,  # noqa: E712
    )
    count_result = await db.execute(count_stmt)
    public_diary_count = count_result.scalar() or 0

    # Fetch public diaries (most recent 20)
    diary_stmt = (
        select(DiaryEntry)
        .where(
            DiaryEntry.user_id == user_id,
            DiaryEntry.is_public == True,  # noqa: E712
        )
        .order_by(DiaryEntry.created_at.desc())
        .limit(20)
    )
    diary_result = await db.execute(diary_stmt)
    public_diaries = diary_result.scalars().all()

    return {
        "user_id": user.user_id,
        "nickname": user.nickname,
        "bio": user.bio,
        "dog": _dog_to_dict(user.dog_profile),
        "public_diary_count": public_diary_count,
        "public_diaries": [
            {
                "entry_id": e.entry_id,
                "date": e.date,
                "share_token": e.share_token,
                "diary": {"title_ko": (e.diary or {}).get("title_ko", ""), "title_en": (e.diary or {}).get("title_en", "")},
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in public_diaries
        ],
    }


# ---- Update profile visibility ----

@router.put("/profile/me/visibility")
async def update_profile_visibility(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    lang = get_lang(request)
    body = await request.json()

    user = await db.get(User, current_user["user_id"])
    if not user:
        raise HTTPException(status_code=404, detail=get_message("user_not_found", lang))

    if "is_profile_public" in body:
        user.is_profile_public = bool(body["is_profile_public"])
    if "bio" in body:
        user.bio = str(body["bio"])[:200] if body["bio"] else None

    await db.commit()
    await db.refresh(user)

    return {
        "user_id": user.user_id,
        "nickname": user.nickname,
        "bio": user.bio,
        "is_profile_public": user.is_profile_public,
    }
