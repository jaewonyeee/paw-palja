"""
다이어리 CRUD API 라우터
"""
import uuid
import logging
from fastapi import APIRouter, HTTPException, Depends, Request
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

# Agent Graph (shared instance)
_agent_graph = None


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
    """오늘의 다이어리를 생성하고 저장합니다."""
    user_id = current_user["user_id"]
    try:
        profile = DogProfile(**current_user["dog"])
        initial_state = _prepare_state(profile, logs)
        thread_id = str(uuid.uuid4())
        config = {"configurable": {"thread_id": thread_id}}

        final_state = _get_agent_graph().invoke(initial_state, config=config)

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
        if logs.photo:
            entry["photo"] = logs.photo

        saved = await user_store.save_diary_entry(db, user_id, entry)

        # Track diary_created event
        await user_store.track_event(db, user_id, "diary_created")

        return saved
    except Exception as e:
        logger.exception("다이어리 생성 실패")
        raise HTTPException(status_code=500, detail=get_message("diary_create_error", get_lang(request)))


@router.get("/diary/list")
async def list_diaries(
    limit: int = 30,
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
