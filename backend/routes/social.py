"""
Social features: share diary entries via public links, public profiles, and social feed.
"""
import secrets
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.auth import get_current_user, decode_token
from backend.models import User, DiaryEntry, DogProfile
from backend.user_store import _dog_to_dict
from backend.i18n import get_message, get_lang

logger = logging.getLogger("pawpalja.social")

router = APIRouter(tags=["social"])

_optional_bearer = HTTPBearer(auto_error=False)


async def _get_optional_user_id(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_optional_bearer),
) -> Optional[str]:
    """Extract user_id from Bearer token if present; return None otherwise."""
    if credentials is None:
        return None
    try:
        lang = get_lang(request)
        payload = decode_token(credentials.credentials, lang)
        if payload.get("type") != "access":
            return None
        return payload.get("sub")
    except HTTPException:
        return None


# ---- Social Feed ----

@router.get("/social/feed")
async def social_feed(
    request: Request,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    include_mine: bool = Query(default=False),
    current_user_id: Optional[str] = Depends(_get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return public diary entries from users with public profiles.

    Supports pagination via limit/offset. If a logged-in user passes
    include_mine=false (default), their own entries are excluded.
    """
    # Base filter: all public diary entries (regardless of profile visibility)
    base_conditions = [
        DiaryEntry.is_public == True,  # noqa: E712
    ]

    # Optionally exclude the current user's own entries
    if current_user_id and not include_mine:
        base_conditions.append(DiaryEntry.user_id != current_user_id)

    # Count total matching entries
    count_stmt = (
        select(func.count())
        .select_from(DiaryEntry)
        .join(User, DiaryEntry.user_id == User.user_id)
        .where(*base_conditions)
    )
    count_result = await db.execute(count_stmt)
    total = count_result.scalar() or 0

    # Fetch paginated entries with user + dog info
    items_stmt = (
        select(DiaryEntry, User, DogProfile)
        .join(User, DiaryEntry.user_id == User.user_id)
        .outerjoin(DogProfile, DogProfile.user_id == User.user_id)
        .where(*base_conditions)
        .order_by(DiaryEntry.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    items_result = await db.execute(items_stmt)
    rows = items_result.all()

    items = []
    for entry, user, dog in rows:
        diary_data = entry.diary or {}
        horoscope_data = entry.horoscope or {}
        comments_list = entry.comments or []

        # Anonymous handling: users with is_profile_public=False are shown anonymously
        is_anonymous = not user.is_profile_public
        display_nickname = user.nickname if not is_anonymous else None
        display_dog_name = (dog.name if dog else None) if not is_anonymous else None
        display_dog_breed = (dog.breed if dog else None) if not is_anonymous else None
        display_user_id = user.user_id if not is_anonymous else None

        items.append({
            "entry_id": entry.entry_id,
            "date": entry.date,
            "share_token": entry.share_token,
            "diary": {
                "title_ko": diary_data.get("title_ko", ""),
                "title_en": diary_data.get("title_en", ""),
                "content_ko": diary_data.get("content_ko", ""),
                "content_en": diary_data.get("content_en", ""),
                "mood_icon": diary_data.get("mood_icon", ""),
            },
            "horoscope": {
                "summary_ko": horoscope_data.get("summary_ko", ""),
                "summary_en": horoscope_data.get("summary_en", ""),
            },
            "user": {
                "user_id": display_user_id,
                "nickname": display_nickname,
                "dog_name": display_dog_name,
                "dog_breed": display_dog_breed,
                "dog_image": None,
                "is_anonymous": is_anonymous,
            },
            "comments_count": len(comments_list),
            "created_at": entry.created_at.isoformat() if entry.created_at else None,
        })

    return {
        "items": items,
        "total": total,
        "has_more": (offset + limit) < total,
    }


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
    if "auto_share_social" in body:
        user.auto_share_social = bool(body["auto_share_social"])

    await db.commit()
    await db.refresh(user)

    return {
        "user_id": user.user_id,
        "nickname": user.nickname,
        "bio": user.bio,
        "is_profile_public": user.is_profile_public,
        "auto_share_social": user.auto_share_social,
    }
