"""
사용자 세션 및 다이어리 저장소
PostgreSQL + async SQLAlchemy 기반 영속 스토어
"""
import re
import uuid
import logging
from datetime import datetime, timezone

import bcrypt
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models import User, DogProfile, DiaryEntry, UserEvent, ApiUsageLog
from backend.i18n import get_message
from backend.cache import cache_get, cache_set, cache_delete, cache_delete_pattern

logger = logging.getLogger("pawpalja.store")

# SEC-008: user_id 허용 패턴 (영문+숫자, 3~30자)
_VALID_USER_ID = re.compile(r"^[a-zA-Z0-9]{3,30}$")


def _validate_user_id(user_id: str, lang: str = "ko") -> str | None:
    """user_id를 검증합니다. 유효하지 않으면 에러 메시지를 반환합니다."""
    if not user_id or not _VALID_USER_ID.match(user_id):
        return get_message("invalid_user_id", lang)
    return None


# SEC-003: bcrypt 비밀번호 해싱
def _hash_pw(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_pw(password: str, hashed: str) -> bool:
    """비밀번호 검증. SHA-256 레거시 해시도 호환 지원합니다."""
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except (ValueError, TypeError):
        import hashlib
        return hashlib.sha256(password.encode()).hexdigest() == hashed


def _dog_to_dict(dog: DogProfile | None) -> dict:
    if dog is None:
        return {}
    return {"name": dog.name, "breed": dog.breed, "mbti": dog.mbti, "image": dog.image}


def _user_to_dict(user: User) -> dict:
    return {
        "user_id": user.user_id,
        "nickname": user.nickname,
        "dog": _dog_to_dict(user.dog_profile),
        "diary_time": user.diary_time or "09:00",
        "bio": user.bio,
        "email": user.email,
        "is_profile_public": user.is_profile_public,
        "auto_share_social": user.auto_share_social,
    }


def _entry_to_dict(entry: DiaryEntry) -> dict:
    return {
        "entry_id": entry.entry_id,
        "user_id": entry.user_id,
        "date": entry.date,
        "diary": entry.diary,
        "horoscope": entry.horoscope,
        "health": entry.health,
        "comments": entry.comments or [],
        "agent_memos": entry.agent_memos or [],
        "logs": entry.logs,
        "photo": entry.photo,
        "is_edited": entry.is_edited,
        "is_public": entry.is_public,
        "share_token": entry.share_token,
        "likes": entry.likes or [],
        "user_comments": entry.user_comments or [],
        "view_count": entry.view_count,
        "created_at": entry.created_at.isoformat() if entry.created_at else None,
    }


async def signup(db: AsyncSession, user_id: str, nickname: str, password: str, dog: dict, diary_time: str = "09:00", lang: str = "ko", email: str | None = None) -> dict:
    err = _validate_user_id(user_id, lang)
    if err:
        return {"error": err}

    existing = await db.get(User, user_id)
    if existing:
        return {"error": get_message("user_id_taken", lang)}

    user = User(
        user_id=user_id,
        nickname=nickname,
        password_hash=_hash_pw(password),
        diary_time=diary_time,
        email=email,
    )
    dog_profile = DogProfile(
        user_id=user_id,
        name=dog.get("name", ""),
        breed=dog.get("breed", ""),
        mbti=dog.get("mbti", ""),
        image=dog.get("image"),
    )
    user.dog_profile = dog_profile
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return {"user_id": user_id, "nickname": nickname, "dog": _dog_to_dict(user.dog_profile), "diary_time": diary_time}


async def login(db: AsyncSession, user_id: str, password: str, lang: str = "ko") -> dict:
    err = _validate_user_id(user_id, lang)
    if err:
        return {"error": get_message("invalid_credentials", lang)}

    user = await db.get(User, user_id)
    if user and _verify_pw(password, user.password_hash):
        # 레거시 SHA-256 해시인 경우 bcrypt로 자동 마이그레이션
        if not user.password_hash.startswith("$2"):
            user.password_hash = _hash_pw(password)
            await db.commit()
        return _user_to_dict(user)

    return {"error": get_message("invalid_credentials", lang)}


async def get_user(db: AsyncSession, user_id: str) -> dict | None:
    if _validate_user_id(user_id):
        return None
    cached = await cache_get(f"user:{user_id}")
    if cached is not None:
        return cached
    user = await db.get(User, user_id)
    if not user:
        return None
    result = _user_to_dict(user)
    await cache_set(f"user:{user_id}", result, ttl=300)
    return result


async def update_user(db: AsyncSession, user_id: str, dog: dict = None, diary_time: str = None, lang: str = "ko", email: str | None = ...) -> dict:
    if _validate_user_id(user_id, lang):
        return {"error": get_message("user_not_found", lang)}

    user = await db.get(User, user_id)
    if not user:
        return {"error": get_message("user_not_found", lang)}

    if dog:
        if user.dog_profile:
            user.dog_profile.name = dog.get("name", user.dog_profile.name)
            user.dog_profile.breed = dog.get("breed", user.dog_profile.breed)
            user.dog_profile.mbti = dog.get("mbti", user.dog_profile.mbti)
            user.dog_profile.image = dog.get("image", user.dog_profile.image)
        else:
            user.dog_profile = DogProfile(
                user_id=user_id,
                name=dog.get("name", ""),
                breed=dog.get("breed", ""),
                mbti=dog.get("mbti", ""),
                image=dog.get("image"),
            )
    if diary_time:
        user.diary_time = diary_time
    if email is not ...:
        user.email = email

    await db.commit()
    await db.refresh(user)
    await cache_delete(f"user:{user_id}")
    return _user_to_dict(user)


async def save_diary_entry(db: AsyncSession, user_id: str, entry: dict) -> dict:
    """일기를 저장합니다. 같은 날짜의 일기가 이미 존재하면 덮어씁니다."""
    today = datetime.now().strftime("%Y-%m-%d")

    stmt = select(DiaryEntry).where(
        DiaryEntry.user_id == user_id, DiaryEntry.date == today
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        existing.diary = entry.get("diary")
        existing.horoscope = entry.get("horoscope")
        existing.health = entry.get("health")
        existing.comments = entry.get("comments", [])
        existing.agent_memos = entry.get("agent_memos", [])
        existing.logs = entry.get("logs")
        existing.photo = entry.get("photo")
        existing.is_edited = entry.get("is_edited", False)
        if "is_public" in entry:
            existing.is_public = entry["is_public"]
        if "share_token" in entry:
            existing.share_token = entry["share_token"]
        await db.commit()
        await db.refresh(existing)
        await cache_delete_pattern(f"diaries:{user_id}:*")
        await cache_delete("admin:stats")
        return _entry_to_dict(existing)
    else:
        new_entry = DiaryEntry(
            entry_id=str(uuid.uuid4()),
            user_id=user_id,
            date=today,
            diary=entry.get("diary"),
            horoscope=entry.get("horoscope"),
            health=entry.get("health"),
            comments=entry.get("comments", []),
            agent_memos=entry.get("agent_memos", []),
            logs=entry.get("logs"),
            photo=entry.get("photo"),
            is_edited=entry.get("is_edited", False),
            is_public=entry.get("is_public", False),
            share_token=entry.get("share_token"),
        )
        db.add(new_entry)
        await db.commit()
        await db.refresh(new_entry)
        await cache_delete_pattern(f"diaries:{user_id}:*")
        await cache_delete("admin:stats")
        return _entry_to_dict(new_entry)


async def get_diaries(db: AsyncSession, user_id: str, limit: int = 30) -> list[dict]:
    if _validate_user_id(user_id):
        return []
    limit = min(limit, 100)
    cache_key = f"diaries:{user_id}:{limit}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached
    stmt = (
        select(DiaryEntry)
        .where(DiaryEntry.user_id == user_id)
        .order_by(DiaryEntry.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    entries = result.scalars().all()
    data = [_entry_to_dict(e) for e in entries]
    await cache_set(cache_key, data, ttl=120)
    return data


async def get_diary_by_id(db: AsyncSession, user_id: str, entry_id: str) -> dict | None:
    stmt = select(DiaryEntry).where(
        DiaryEntry.user_id == user_id, DiaryEntry.entry_id == entry_id
    )
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()
    if not entry:
        return None
    return _entry_to_dict(entry)


async def update_diary_entry(db: AsyncSession, user_id: str, entry_id: str, updates: dict) -> dict | None:
    stmt = select(DiaryEntry).where(
        DiaryEntry.user_id == user_id, DiaryEntry.entry_id == entry_id
    )
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()
    if not entry:
        return None

    for key, value in updates.items():
        if hasattr(entry, key):
            setattr(entry, key, value)
    entry.is_edited = True
    await db.commit()
    await db.refresh(entry)
    await cache_delete_pattern(f"diaries:{user_id}:*")
    return _entry_to_dict(entry)


async def delete_diary_entry(db: AsyncSession, user_id: str, entry_id: str) -> bool:
    stmt = select(DiaryEntry).where(
        DiaryEntry.user_id == user_id, DiaryEntry.entry_id == entry_id
    )
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()
    if not entry:
        return False
    await db.delete(entry)
    await db.commit()
    await cache_delete_pattern(f"diaries:{user_id}:*")
    await cache_delete("admin:stats")
    return True


async def clear_comments(db: AsyncSession, user_id: str, entry_id: str) -> bool:
    stmt = select(DiaryEntry).where(
        DiaryEntry.user_id == user_id, DiaryEntry.entry_id == entry_id
    )
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()
    if not entry:
        return False
    entry.comments = []
    await db.commit()
    return True


async def add_comments_to_diary(db: AsyncSession, user_id: str, entry_id: str, comments: list[dict]) -> bool:
    stmt = select(DiaryEntry).where(
        DiaryEntry.user_id == user_id, DiaryEntry.entry_id == entry_id
    )
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()
    if not entry:
        return False
    existing = list(entry.comments or [])
    existing.extend(comments)
    entry.comments = existing
    await db.commit()
    return True


async def set_refresh_token(
    db: AsyncSession, user_id: str, token_hash: str | None, family: str | None = None
) -> None:
    """Store or clear a hashed refresh token and its family for the user.

    When issuing a new login/signup, pass a new family ID.
    When rotating during refresh, keep the same family ID.
    When revoking (logout or reuse detection), pass None for both.
    """
    user = await db.get(User, user_id)
    if user:
        user.refresh_token_hash = token_hash
        user.refresh_token_family = family
        await db.commit()


async def get_user_raw(db: AsyncSession, user_id: str) -> User | None:
    """Return the raw ORM User object (for token validation)."""
    return await db.get(User, user_id)


async def get_all_users_with_diary_counts(db: AsyncSession) -> dict:
    """Admin: 전체 사용자 및 다이어리 통계를 조회합니다."""
    cached = await cache_get("admin:stats")
    if cached is not None:
        return cached

    stmt = (
        select(
            User.user_id,
            User.nickname,
            User.created_at,
            func.count(DiaryEntry.entry_id).label("diary_count"),
        )
        .outerjoin(DiaryEntry, User.user_id == DiaryEntry.user_id)
        .group_by(User.user_id)
        .order_by(User.created_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    users = []
    total_diaries = 0
    for row in rows:
        user = await db.get(User, row.user_id)
        diary_count = row.diary_count
        total_diaries += diary_count
        users.append({
            "user_id": row.user_id,
            "nickname": row.nickname,
            "dog": _dog_to_dict(user.dog_profile) if user else {},
            "diary_count": diary_count,
            "created_at": row.created_at.isoformat() if row.created_at else "",
        })

    data = {"total_users": len(users), "total_diaries": total_diaries, "users": users}
    await cache_set("admin:stats", data, ttl=60)
    return data


async def track_event(db: AsyncSession, user_id: str, event_type: str, metadata: dict | None = None) -> None:
    """Record a user event for analytics."""
    event = UserEvent(user_id=user_id, event_type=event_type, metadata_json=metadata)
    db.add(event)
    await db.commit()


async def log_api_usage(
    db: AsyncSession,
    user_id: str | None,
    endpoint: str,
    model_name: str | None = None,
    input_tokens: int = 0,
    output_tokens: int = 0,
    total_tokens: int = 0,
    cost_usd: float = 0.0,
    duration_ms: int = 0,
    success: bool = True,
    error_message: str | None = None,
) -> None:
    """Record an API usage log entry."""
    log = ApiUsageLog(
        user_id=user_id,
        endpoint=endpoint,
        model_name=model_name,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
        cost_usd=cost_usd,
        duration_ms=duration_ms,
        success=success,
        error_message=error_message,
    )
    db.add(log)
    await db.commit()
