"""
인증 관련 API 라우터 (회원가입, 로그인, JWT 토큰 관리, 사용자 관리)

Security: Implements Refresh Token Rotation with reuse detection.
Each login creates a new "token family". On each refresh, the token is
rotated (new refresh token issued, old one invalidated). If a previously-used
refresh token is replayed (indicating theft), the ENTIRE family is revoked,
forcing the attacker AND the legitimate user to re-authenticate.
"""
import logging

from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from backend.schemas import LoginRequest, SignupRequest, RefreshRequest, UpdateUserRequest
from backend import user_store
from backend.database import get_db
from backend.auth import (
    create_access_token,
    create_refresh_token,
    create_token_family,
    decode_token,
    hash_refresh_token,
    get_current_user,
)
from backend.i18n import get_message, get_lang

logger = logging.getLogger("pawpalja.auth.routes")

router = APIRouter()


@router.post("/auth/signup")
async def auth_signup(request: Request, req: SignupRequest, db: AsyncSession = Depends(get_db)):
    lang = get_lang(request)
    result = await user_store.signup(db, req.user_id, req.nickname, req.password, req.dog.model_dump(), req.diary_time, lang=lang)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    is_admin = req.user_id == "admin"
    access_token = create_access_token(req.user_id, is_admin=is_admin)
    refresh_token = create_refresh_token(req.user_id)
    family = create_token_family()
    await user_store.set_refresh_token(db, req.user_id, hash_refresh_token(refresh_token), family)

    # Track signup event
    await user_store.track_event(db, req.user_id, "signup")

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": result,
    }


@router.get("/auth/check-id/{user_id}")
async def check_id(user_id: str, db: AsyncSession = Depends(get_db)):
    """아이디 중복 확인"""
    if user_store._validate_user_id(user_id):
        return {"available": False}
    existing = await user_store.get_user(db, user_id)
    return {"available": existing is None}


@router.post("/auth/login")
async def auth_login(request: Request, req: LoginRequest, db: AsyncSession = Depends(get_db)):
    lang = get_lang(request)
    result = await user_store.login(db, req.user_id, req.password, lang=lang)
    if "error" in result:
        raise HTTPException(status_code=401, detail=result["error"])

    is_admin = req.user_id == "admin"
    access_token = create_access_token(req.user_id, is_admin=is_admin)
    refresh_token = create_refresh_token(req.user_id)
    # New login = new token family (breaks any previous session's rotation chain)
    family = create_token_family()
    await user_store.set_refresh_token(db, req.user_id, hash_refresh_token(refresh_token), family)

    # Track login event
    await user_store.track_event(db, req.user_id, "login")

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": result,
    }


@router.post("/auth/refresh")
async def auth_refresh(request: Request, req: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Refresh Token Rotation with reuse detection.

    Flow:
    1. Validate the refresh JWT (signature + expiry)
    2. Look up user and verify token hash matches the stored hash
    3. If hash DOESN'T match → REUSE DETECTED:
       - A previously-rotated token is being replayed
       - Revoke the entire token family (nuclear option)
       - Both the attacker and legitimate user must re-login
    4. If hash matches → normal rotation:
       - Issue new access + refresh tokens
       - Update stored hash (old token is now invalid)
       - Keep the same family ID
    """
    lang = get_lang(request)
    payload = decode_token(req.refresh_token, lang)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail=get_message("invalid_token_type", lang))

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail=get_message("invalid_token", lang))

    user_row = await user_store.get_user_raw(db, user_id)
    if not user_row:
        raise HTTPException(status_code=401, detail=get_message("user_not_found", lang))

    presented_hash = hash_refresh_token(req.refresh_token)

    # --- Reuse detection ---
    if user_row.refresh_token_hash != presented_hash:
        # This token was already used and rotated. Someone is replaying it.
        # Could be the attacker using a stolen token, or the legitimate user
        # using a stale token. Either way: REVOKE EVERYTHING.
        logger.warning(
            "Refresh token reuse detected for user '%s'. "
            "Revoking all tokens (potential token theft).",
            user_id,
        )
        await user_store.set_refresh_token(db, user_id, None, None)
        raise HTTPException(
            status_code=401,
            detail=get_message("token_reuse_detected", lang),
        )

    # --- Normal rotation ---
    is_admin = user_id == "admin"
    new_access = create_access_token(user_id, is_admin=is_admin)
    new_refresh = create_refresh_token(user_id)
    # Keep the same family — this is a continuation of the same session
    await user_store.set_refresh_token(
        db, user_id, hash_refresh_token(new_refresh), user_row.refresh_token_family
    )

    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
    }


@router.post("/auth/logout")
async def auth_logout(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Invalidate the user's refresh token and family."""
    await user_store.set_refresh_token(db, current_user["user_id"], None, None)
    return {"ok": True}


@router.get("/user/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """현재 로그인된 사용자 정보 반환"""
    return current_user


@router.put("/user/me")
async def update_me(
    request: Request,
    body: UpdateUserRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """사용자 정보 업데이트 (dog 프로필 및 알림 시간)"""
    lang = get_lang(request)
    result = await user_store.update_user(
        db, current_user["user_id"],
        body.dog.model_dump() if body.dog else None,
        body.diary_time,
        lang=lang,
    )
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result
