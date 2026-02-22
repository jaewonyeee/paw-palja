"""
다이어리 CRUD API 라우터

Supports two execution modes controlled by USE_TASK_QUEUE env flag:
  - Synchronous (default): blocks until the agent graph completes
  - Async task queue: enqueues the job, returns a job_id for polling
"""
import os
import time
import uuid
import secrets
import logging
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from backend.schemas import DogProfile, DailyLog, DiaryEditRequest
from backend.agents import build_agent_graph
from backend import user_store
from backend.database import get_db
from backend.auth import get_current_user
from backend.i18n import get_message, get_lang

logger = logging.getLogger("pawpalja.diary")

router = APIRouter()

from backend.rate_limit import limiter

# Agent Graph (shared instance — used in synchronous mode only)
_agent_graph = None


def _use_task_queue() -> bool:
    """Check whether the async task queue is enabled."""
    return os.getenv("USE_TASK_QUEUE", "false").lower() in ("true", "1", "yes")


def _get_agent_graph():
    global _agent_graph
    if _agent_graph is None:
        _agent_graph = build_agent_graph()
    return _agent_graph


def _prepare_state(profile: DogProfile, logs: DailyLog):
    return {
        "dog_profile": profile.model_dump(),
        "daily_logs": logs.model_dump(),
        "messages": [],
        "agent_memos": [],
    }


@router.post("/diary/generate")
@limiter.limit("3/minute")
async def generate_diary(
    request: Request,
    logs: DailyLog,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate today's diary.

    When USE_TASK_QUEUE is enabled, enqueues the job and returns
    ``{job_id, status: "queued"}`` immediately.  The client should
    poll ``GET /diary/job/{job_id}`` for the result.

    When USE_TASK_QUEUE is disabled (default), blocks until the full
    agent graph completes and returns the saved diary entry.
    """
    user_id = current_user["user_id"]

    if _use_task_queue():
        try:
            from backend.tasks import enqueue_diary_generation

            job_id = await enqueue_diary_generation(
                user_id=user_id,
                dog_profile=current_user["dog"],
                daily_logs=logs.model_dump(),
            )
            return {"job_id": job_id, "status": "queued"}
        except Exception:
            logger.exception("Failed to enqueue diary generation")
            raise HTTPException(
                status_code=500,
                detail=get_message("diary_create_error", get_lang(request)),
            )

    # --- Synchronous fallback (original behaviour) ---
    try:
        profile = DogProfile(**current_user["dog"])
        initial_state = _prepare_state(profile, logs)

        # GPT-4o Vision photo analysis (premium feature)
        if logs.photo:
            try:
                from backend.photo_analysis import analyze_pet_photo
                import asyncio
                photo_result = await analyze_pet_photo(
                    logs.photo,
                    current_user["dog"].get("name", "멍멍이"),
                    current_user["dog"].get("breed", "믹스견"),
                )
                if photo_result:
                    initial_state["daily_logs"]["photo_analysis"] = photo_result
            except Exception:
                logger.warning("Photo analysis failed, continuing without it")

        thread_id = str(uuid.uuid4())
        config = {"configurable": {"thread_id": thread_id}}

        start_time = time.time()
        final_state = _get_agent_graph().invoke(initial_state, config=config)
        duration_ms = int((time.time() - start_time) * 1000)

        # Determine whether to share to social
        share = logs.share_to_social
        if share is None:
            share = current_user.get("auto_share_social", False)

        # Include photo analysis in logs for storage
        logs_data = logs.model_dump()
        photo_analysis = initial_state["daily_logs"].get("photo_analysis")
        if photo_analysis:
            logs_data["photo_analysis"] = photo_analysis

        entry = {
            "user_id": user_id,
            "diary": final_state["diary"],
            "horoscope": final_state["horoscope"],
            "health": final_state["health"],
            "agent_memos": final_state.get("agent_memos", []),
            "logs": logs_data,
            "comments": [],
            "is_edited": False,
        }
        if share:
            entry["is_public"] = True
            entry["share_token"] = secrets.token_urlsafe(16)
        if logs.photo:
            entry["photo"] = logs.photo

        saved = await user_store.save_diary_entry(db, user_id, entry)

        # Generate DALL-E 3 illustration (async, non-blocking)
        try:
            from backend.illustration import generate_diary_illustration
            diary_content = ""
            if final_state.get("diary"):
                diary_content = final_state["diary"].get("content_ko", "") or final_state["diary"].get("content", "")
            if diary_content:
                illustration = await generate_diary_illustration(
                    diary_content,
                    current_user["dog"].get("name", "멍멍이"),
                    current_user["dog"].get("breed", "믹스견"),
                )
                if illustration and saved.get("entry_id"):
                    await user_store.update_diary_entry(
                        db, user_id, saved["entry_id"],
                        {"illustration_url": illustration}
                    )
                    saved["illustration_url"] = illustration
        except Exception:
            logger.warning("Illustration generation failed, continuing without it")

        # Track diary_created event
        await user_store.track_event(db, user_id, "diary_created")

        try:
            await user_store.log_api_usage(
                db, user_id=user_id, endpoint="/diary/generate",
                model_name="agent-graph", duration_ms=duration_ms, success=True,
            )
        except Exception:
            logger.warning("Failed to log API usage")

        return saved
    except Exception as e:
        logger.exception("다이어리 생성 실패")
        try:
            await user_store.log_api_usage(
                db, user_id=user_id, endpoint="/diary/generate",
                model_name="agent-graph", success=False,
                error_message=str(e)[:500],
            )
        except Exception:
            logger.warning("Failed to log API usage error")
        raise HTTPException(status_code=500, detail=get_message("diary_create_error", get_lang(request)))


@router.get("/diary/job/{job_id}")
async def poll_diary_job(
    request: Request,
    job_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Poll the status of an async diary generation job.

    Returns:
        - ``{status: "queued"}`` — still waiting
        - ``{status: "in_progress"}`` — worker picked it up
        - ``{status: "complete", entry: {...}}`` — done, diary entry included
        - ``{status: "failed", detail: "..."}`` — error description
    """
    from backend.tasks import get_task_result

    try:
        info = await get_task_result(job_id)
    except Exception:
        logger.exception("Failed to query job %s", job_id)
        raise HTTPException(status_code=500, detail=get_message("diary_create_error", get_lang(request)))

    status = info["status"]

    if status == "complete":
        return {"status": "complete", "entry": info["result"]}
    elif status == "failed":
        return {"status": "failed", "detail": str(info["result"])}
    elif status == "not_found":
        raise HTTPException(status_code=404, detail="Job not found")
    else:
        # queued / in_progress
        return {"status": status}


@router.get("/diary/list")
async def list_diaries(
    limit: int = Query(default=30, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await user_store.get_diaries(db, current_user["user_id"], limit)


@router.get("/diary/entry/{entry_id}")
async def get_diary_entry(
    request: Request,
    entry_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entry = await user_store.get_diary_by_id(db, current_user["user_id"], entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail=get_message("diary_not_found", get_lang(request)))
    return entry


@router.put("/diary/edit/{entry_id}")
async def edit_diary(
    request: Request,
    entry_id: str,
    req: DiaryEditRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """일기를 수정하고, 기존 댓글을 모두 삭제한 뒤 수정 반응만 SSE로 전달합니다."""
    lang = get_lang(request)
    user_id = current_user["user_id"]
    entry = await user_store.get_diary_by_id(db, user_id, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail=get_message("diary_not_found", lang))

    diary = entry.get("diary", {})
    diary["content"] = req.edited_diary
    # Clear bilingual variants so getLangText falls back to the edited content
    diary.pop("content_ko", None)
    diary.pop("content_en", None)
    updated = await user_store.update_diary_entry(db, user_id, entry_id, {"diary": diary})

    if not updated:
        raise HTTPException(status_code=500, detail=get_message("diary_edit_failed", lang))

    await user_store.clear_comments(db, user_id, entry_id)
    updated = await user_store.get_diary_by_id(db, user_id, entry_id)
    return updated


@router.delete("/diary/{entry_id}")
async def delete_diary(
    request: Request,
    entry_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """일기를 삭제합니다."""
    success = await user_store.delete_diary_entry(db, current_user["user_id"], entry_id)
    if not success:
        raise HTTPException(status_code=404, detail=get_message("diary_not_found", get_lang(request)))
    return {"success": True}
