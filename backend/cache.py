"""
Async Redis client for caching and shared state.

Provides a singleton Redis connection, cache helpers, and
FastAPI dependency for route-level access.
"""
import os
import json
import logging
from typing import Any

import redis.asyncio as aioredis

logger = logging.getLogger("pawpalja.cache")

_redis: aioredis.Redis | None = None


async def init_redis() -> None:
    """Initialize the async Redis connection pool. Call once at startup."""
    global _redis
    url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    _redis = aioredis.from_url(
        url,
        decode_responses=True,
        socket_connect_timeout=5,
        retry_on_timeout=True,
    )
    try:
        await _redis.ping()
        logger.info("Redis connected: %s", url.split("@")[-1] if "@" in url else url)
    except Exception as exc:
        logger.warning("Redis unavailable (%s) — caching disabled", exc)
        await _redis.aclose()
        _redis = None


async def close_redis() -> None:
    """Gracefully close the Redis connection. Call at shutdown."""
    global _redis
    if _redis:
        await _redis.aclose()
        _redis = None
        logger.info("Redis connection closed")


def get_redis() -> aioredis.Redis | None:
    """FastAPI dependency — returns the current Redis client or None."""
    return _redis


# ── Cache helpers ────────────────────────────────────────────

async def cache_get(key: str) -> Any | None:
    """Return cached value (deserialized from JSON) or None."""
    if _redis is None:
        return None
    try:
        raw = await _redis.get(key)
        if raw is not None:
            return json.loads(raw)
    except Exception as exc:
        logger.debug("cache_get(%s) error: %s", key, exc)
    return None


async def cache_set(key: str, value: Any, ttl: int = 300) -> None:
    """Store a JSON-serializable value with TTL (seconds)."""
    if _redis is None:
        return
    try:
        await _redis.set(key, json.dumps(value, default=str), ex=ttl)
    except Exception as exc:
        logger.debug("cache_set(%s) error: %s", key, exc)


async def cache_delete(key: str) -> None:
    """Delete a single cache key."""
    if _redis is None:
        return
    try:
        await _redis.delete(key)
    except Exception as exc:
        logger.debug("cache_delete(%s) error: %s", key, exc)


async def cache_delete_pattern(pattern: str) -> None:
    """Delete all keys matching a glob pattern (e.g. 'user:alice:*')."""
    if _redis is None:
        return
    try:
        cursor = None
        while cursor != 0:
            cursor, keys = await _redis.scan(cursor=cursor or 0, match=pattern, count=100)
            if keys:
                await _redis.delete(*keys)
    except Exception as exc:
        logger.debug("cache_delete_pattern(%s) error: %s", pattern, exc)
