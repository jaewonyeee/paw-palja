"""
Task queue helpers — enqueue jobs and query status/results via ARQ + Redis.

When USE_TASK_QUEUE is disabled the helpers are still importable but
enqueue functions raise RuntimeError (callers should check the flag).
"""
import os
import json
import logging
from typing import Any

from arq import create_pool
from arq.connections import RedisSettings, ArqRedis
from arq.jobs import Job, JobStatus

logger = logging.getLogger("pawpalja.tasks")


def _redis_settings() -> RedisSettings:
    """Parse REDIS_URL into ARQ RedisSettings."""
    url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    # redis://[:password@]host:port/db
    from urllib.parse import urlparse
    parsed = urlparse(url)
    return RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        database=int(parsed.path.lstrip("/") or "0"),
        password=parsed.password,
    )


# Singleton pool (lazily created)
_pool: ArqRedis | None = None


async def get_arq_pool() -> ArqRedis:
    """Return (and cache) a shared ARQ Redis connection pool."""
    global _pool
    if _pool is None:
        _pool = await create_pool(_redis_settings())
    return _pool


async def close_arq_pool() -> None:
    """Gracefully close the ARQ pool. Call at shutdown."""
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None


# ── Enqueue helpers ──────────────────────────────────────────

async def enqueue_diary_generation(
    user_id: str,
    dog_profile: dict,
    daily_logs: dict,
) -> str:
    """Enqueue a diary generation job. Returns the job ID."""
    pool = await get_arq_pool()
    job = await pool.enqueue_job(
        "generate_diary_task",
        user_id,
        dog_profile,
        daily_logs,
    )
    logger.info("Enqueued diary job %s for user %s", job.job_id, user_id)
    return job.job_id


async def enqueue_comment_generation(
    user_id: str,
    entry_id: str,
    diary_content: str,
    dog_name: str,
    dog_breed: str,
    mode: str = "new",
) -> str:
    """Enqueue a comment generation job. Returns the job ID."""
    pool = await get_arq_pool()
    job = await pool.enqueue_job(
        "generate_comments_task",
        user_id,
        entry_id,
        diary_content,
        dog_name,
        dog_breed,
        mode,
    )
    logger.info("Enqueued comment job %s for entry %s", job.job_id, entry_id)
    return job.job_id


# ── Status / result helpers ──────────────────────────────────

# Map ARQ JobStatus to simple string labels
_STATUS_MAP = {
    JobStatus.deferred: "queued",
    JobStatus.queued: "queued",
    JobStatus.in_progress: "in_progress",
    JobStatus.complete: "complete",
    JobStatus.not_found: "not_found",
}


async def get_task_status(job_id: str) -> str:
    """Return a human-friendly status string for the given job."""
    pool = await get_arq_pool()
    job = Job(job_id, pool)
    status = await job.status()
    return _STATUS_MAP.get(status, "unknown")


async def get_task_result(job_id: str) -> dict[str, Any]:
    """Return {status, result} for the given job.

    If complete the result key contains the job's return value.
    If failed the result key contains the error message.
    """
    pool = await get_arq_pool()
    job = Job(job_id, pool)
    info = await job.result_info()

    if info is None:
        status = await job.status()
        return {"status": _STATUS_MAP.get(status, "unknown"), "result": None}

    if info.success:
        return {"status": "complete", "result": info.result}
    else:
        return {"status": "failed", "result": str(info.result)}
