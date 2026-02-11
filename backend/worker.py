"""
ARQ worker — executes long-running LLM agent tasks off the request path.

Run with:
    arq backend.worker.WorkerSettings
"""
import os
import uuid
import logging
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv()

from backend.tasks import _redis_settings  # noqa: E402

logger = logging.getLogger("pawpalja.worker")


# ── Task functions ───────────────────────────────────────────

async def generate_diary_task(
    ctx: dict,
    user_id: str,
    dog_profile: dict,
    daily_logs: dict,
) -> dict:
    """Run the full 3-agent graph (Oracle -> Journalist -> Vet) and persist the entry.

    Returns the saved diary entry dict (same shape as the synchronous endpoint).
    """
    from backend.schemas import DogProfile, DailyLog
    from backend.agents import build_agent_graph
    from backend import user_store
    from backend.database import AsyncSessionLocal

    logger.info("Worker: generating diary for user=%s", user_id)

    profile = DogProfile(**dog_profile)
    logs = DailyLog(**daily_logs)

    initial_state = {
        "dog_profile": profile.model_dump(),
        "daily_logs": logs.model_dump(),
        "messages": [],
        "agent_memos": [],
    }

    thread_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    graph = build_agent_graph()
    final_state = graph.invoke(initial_state, config=config)

    entry = {
        "user_id": user_id,
        "diary": final_state["diary"],
        "horoscope": final_state["horoscope"],
        "health": final_state["health"],
        "agent_memos": final_state.get("agent_memos", []),
        "logs": logs.model_dump(),
        "comments": [],
        "is_edited": False,
    }
    photo = daily_logs.get("photo")
    if photo:
        entry["photo"] = photo

    async with AsyncSessionLocal() as db:
        saved = await user_store.save_diary_entry(db, user_id, entry)
        await user_store.track_event(db, user_id, "diary_created")

    logger.info("Worker: diary saved entry_id=%s for user=%s", saved.get("entry_id"), user_id)
    return saved


async def generate_comments_task(
    ctx: dict,
    user_id: str,
    entry_id: str,
    diary_content: str,
    dog_name: str,
    dog_breed: str,
    mode: str = "new",
) -> list[dict]:
    """Generate comments (or edit reactions) and persist them.

    Returns the list of generated comments.
    """
    from backend.comment_agents import generate_comments, generate_edit_reactions
    from backend import user_store
    from backend.database import AsyncSessionLocal

    logger.info("Worker: generating comments for entry=%s mode=%s", entry_id, mode)

    if mode == "edit":
        comments = generate_edit_reactions("", diary_content, dog_name, dog_breed)
    else:
        comments = generate_comments(diary_content, dog_name, dog_breed, count=3)

    async with AsyncSessionLocal() as db:
        await user_store.add_comments_to_diary(db, user_id, entry_id, comments)

    logger.info("Worker: %d comments saved for entry=%s", len(comments), entry_id)
    return comments


# ── Startup / shutdown hooks ─────────────────────────────────

async def on_startup(ctx: dict) -> None:
    """Called once when the worker boots."""
    logger.info("ARQ worker starting up")


async def on_shutdown(ctx: dict) -> None:
    """Called when the worker shuts down."""
    logger.info("ARQ worker shutting down")


# ── ARQ WorkerSettings ──────────────────────────────────────

class WorkerSettings:
    """Configuration class consumed by `arq backend.worker.WorkerSettings`."""

    redis_settings = _redis_settings()

    functions = [
        generate_diary_task,
        generate_comments_task,
    ]

    on_startup = on_startup
    on_shutdown = on_shutdown

    # Concurrency: 1 agent graph is heavy (~7-17s and memory-intensive)
    max_jobs = int(os.getenv("ARQ_MAX_JOBS", "3"))

    # Individual job timeout (LLM calls can be slow)
    job_timeout = int(os.getenv("ARQ_JOB_TIMEOUT", "120"))

    # How long to keep results in Redis (5 minutes)
    keep_result = 300

    # Poll interval for new jobs (seconds)
    poll_delay = 0.5
