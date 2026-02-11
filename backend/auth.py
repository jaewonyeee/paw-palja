"""
JWT authentication utilities for Paw-Palja.

Security notes — JWT payloads are base64-encoded (NOT encrypted). Never include:
  - passwords or password hashes
  - PII (email, phone, SSN, address)
  - API keys or secrets
  - financial data
Keep payloads minimal: only subject identifier, role flag, and token metadata.
"""
import os
import uuid
import hashlib
import secrets
import logging
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.i18n import get_message, get_lang

logger = logging.getLogger("pawpalja.auth")

# --- Secret key validation ---
_JWT_SECRET = os.getenv("JWT_SECRET", "")
if not _JWT_SECRET or _JWT_SECRET in (
    "change-me-in-production",
    "your-jwt-secret-change-in-production",
    "secret",
    "password",
    "jwt-secret",
):
    _fallback = secrets.token_urlsafe(64)
    logger.critical(
        "JWT_SECRET is missing or insecure! "
        "Set a strong secret (64+ chars) via environment variable. "
        "Using a random ephemeral key — tokens will NOT survive restarts."
    )
    _JWT_SECRET = _fallback

_ACCESS_EXPIRE_MIN = int(os.getenv("JWT_ACCESS_EXPIRE_MINUTES", "5"))  # Shortened: 5min
_REFRESH_EXPIRE_DAYS = int(os.getenv("JWT_REFRESH_EXPIRE_DAYS", "7"))
_ALGORITHM = "HS256"

_bearer_scheme = HTTPBearer()


def create_access_token(user_id: str, is_admin: bool = False) -> str:
    """Create a short-lived access token with minimal claims.

    Payload contains ONLY: sub (user_id), admin flag, token type, timestamps.
    No PII, passwords, or sensitive data.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "admin": is_admin,
        "type": "access",
        "jti": uuid.uuid4().hex,  # Unique token ID
        "exp": now + timedelta(minutes=_ACCESS_EXPIRE_MIN),
        "iat": now,
    }
    return jwt.encode(payload, _JWT_SECRET, algorithm=_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    """Create a longer-lived refresh token (one-time use via rotation)."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "type": "refresh",
        "jti": uuid.uuid4().hex,  # Unique token ID for rotation tracking
        "exp": now + timedelta(days=_REFRESH_EXPIRE_DAYS),
        "iat": now,
    }
    return jwt.encode(payload, _JWT_SECRET, algorithm=_ALGORITHM)


def decode_token(token: str, lang: str = "ko") -> dict:
    """Decode and validate a JWT. Raises HTTPException on failure.

    Security: explicitly rejects 'none' algorithm and enforces HS256-only
    to prevent algorithm confusion / downgrade attacks.
    """
    try:
        # Peek at the unverified header to reject algorithm tampering
        unverified_header = jwt.get_unverified_header(token)
        if unverified_header.get("alg", "").lower() in ("none", "null", ""):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=get_message("invalid_token_algorithm", lang),
            )
        return jwt.decode(
            token,
            _JWT_SECRET,
            algorithms=[_ALGORITHM],  # Only HS256 accepted
            options={"require": ["exp", "iat", "sub", "type"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=get_message("token_expired", lang))
    except jwt.MissingRequiredClaimError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=get_message("malformed_token", lang))
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=get_message("invalid_token", lang))


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_token_family() -> str:
    """Create a new token family ID for refresh token rotation.

    All refresh tokens in a login session share the same family ID.
    If a token with a mismatched family is presented, it indicates
    a stolen token replay — triggering nuclear revocation.
    """
    return uuid.uuid4().hex


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """FastAPI dependency: extract and validate the current user from Bearer token."""
    lang = get_lang(request)
    payload = decode_token(credentials.credentials, lang)
    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=get_message("invalid_token_type", lang))

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=get_message("invalid_token_payload", lang))

    from backend import user_store
    user = await user_store.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=get_message("user_not_found", lang))

    user["is_admin"] = payload.get("admin", False)
    return user


async def require_admin(request: Request, current_user: dict = Depends(get_current_user)) -> dict:
    """FastAPI dependency: require admin role."""
    lang = get_lang(request)
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=get_message("admin_access_required", lang))
    return current_user
