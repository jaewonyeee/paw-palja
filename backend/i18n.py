"""
Centralized bilingual (ko/en) error message registry for Paw-Palja backend.

Usage:
    from backend.i18n import get_message, get_lang
    lang = get_lang(request)
    msg = get_message("user_not_found", lang)
"""
from fastapi import Request

MESSAGES = {
    # --- user_store.py ---
    "invalid_user_id": {
        "ko": "아이디는 영문과 숫자 3~30자만 사용 가능합니다.",
        "en": "User ID must be 3-30 alphanumeric characters.",
    },
    "user_id_taken": {
        "ko": "이미 사용 중인 아이디입니다.",
        "en": "This user ID is already taken.",
    },
    "invalid_credentials": {
        "ko": "아이디 또는 비밀번호가 올바르지 않습니다.",
        "en": "Invalid user ID or password.",
    },
    "user_not_found": {
        "ko": "사용자를 찾을 수 없습니다.",
        "en": "User not found.",
    },
    # --- auth.py ---
    "invalid_token_algorithm": {
        "ko": "유효하지 않은 토큰 알고리즘입니다.",
        "en": "Invalid token algorithm",
    },
    "token_expired": {
        "ko": "토큰이 만료되었습니다.",
        "en": "Token expired",
    },
    "malformed_token": {
        "ko": "잘못된 형식의 토큰입니다.",
        "en": "Malformed token",
    },
    "invalid_token": {
        "ko": "유효하지 않은 토큰입니다.",
        "en": "Invalid token",
    },
    "invalid_token_type": {
        "ko": "유효하지 않은 토큰 유형입니다.",
        "en": "Invalid token type",
    },
    "invalid_token_payload": {
        "ko": "유효하지 않은 토큰 페이로드입니다.",
        "en": "Invalid token payload",
    },
    "admin_access_required": {
        "ko": "관리자 권한이 필요합니다.",
        "en": "Admin access required",
    },
    # --- routes/auth.py ---
    "token_reuse_detected": {
        "ko": "토큰 재사용이 감지되었습니다. 모든 세션이 해지되었습니다. 다시 로그인해주세요.",
        "en": "Token reuse detected. All sessions revoked. Please log in again.",
    },
    # --- routes/diary.py ---
    "diary_create_error": {
        "ko": "다이어리 생성 중 오류가 발생했습니다.",
        "en": "An error occurred while creating the diary.",
    },
    "diary_not_found": {
        "ko": "다이어리를 찾을 수 없습니다.",
        "en": "Diary not found.",
    },
    "diary_edit_failed": {
        "ko": "수정에 실패했습니다.",
        "en": "Failed to update the diary.",
    },
    # --- routes/comments.py ---
    "comment_create_error": {
        "ko": "댓글 생성 중 오류가 발생했습니다.",
        "en": "An error occurred while creating comments.",
    },
    "invalid_comment_mode": {
        "ko": "mode는 'new' 또는 'edit'만 가능합니다.",
        "en": "Mode must be 'new' or 'edit'.",
    },
    # --- routes/agents.py ---
    "processing_error": {
        "ko": "처리 중 오류가 발생했습니다.",
        "en": "An error occurred during processing.",
    },
    # --- routes/hospitals.py ---
    "hospital_search_fallback_name": {
        "ko": "주변 동물병원을 검색해보세요",
        "en": "Search for nearby veterinary hospitals",
    },
    "hospital_search_fallback_address": {
        "ko": "카카오맵에서 '동물병원'을 검색하세요",
        "en": "Search for 'veterinary hospital' on Kakao Maps",
    },
    # --- main.py ---
    "forbidden": {
        "ko": "접근이 금지되었습니다.",
        "en": "Forbidden",
    },
}


def get_message(key: str, lang: str = "ko") -> str:
    """Look up an i18n message by key and language code."""
    msg = MESSAGES.get(key, {})
    return msg.get(lang, msg.get("en", key))


def get_lang(request: Request) -> str:
    """FastAPI dependency: extract language from request.state (set by middleware)."""
    return getattr(request.state, "lang", "ko")
