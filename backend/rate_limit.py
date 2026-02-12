"""
Rate limiter configuration for Paw-Palja API.

Shared module to avoid circular imports between main.py and route modules.
Uses Redis storage when REDIS_URL is set (distributed rate limiting),
otherwise falls back to in-memory storage.
"""
import os

from fastapi import Request
from slowapi import Limiter


def _get_user_id_from_request(request: Request) -> str:
    """Extract user_id from JWT Bearer token for rate limiting.
    Falls back to client IP if no valid token is present."""
    auth_header = request.headers.get("Authorization", "")
    token = request.query_params.get("token", "")

    raw_token = None
    if auth_header.startswith("Bearer "):
        raw_token = auth_header[7:]
    elif token:
        raw_token = token

    if raw_token:
        try:
            import jwt as pyjwt
            payload = pyjwt.decode(
                raw_token,
                options={"verify_signature": False, "verify_exp": False},
            )
            user_id = payload.get("sub")
            if user_id:
                return user_id
        except Exception:
            pass

    return request.client.host if request.client else "unknown"


import logging

_logger = logging.getLogger("pawpalja.rate_limit")

_redis_url = os.getenv("REDIS_URL")
_storage_uri = None

if _redis_url:
    try:
        import redis as _sync_redis
        _test_conn = _sync_redis.from_url(_redis_url, socket_connect_timeout=2)
        _test_conn.ping()
        _test_conn.close()
        _storage_uri = _redis_url
        _logger.info("Rate limiter using Redis: %s", _redis_url.split("@")[-1] if "@" in _redis_url else _redis_url)
    except Exception:
        _logger.warning("Redis unavailable at %s — rate limiter falling back to in-memory storage", _redis_url)

limiter = Limiter(
    key_func=_get_user_id_from_request,
    storage_uri=_storage_uri,
)
