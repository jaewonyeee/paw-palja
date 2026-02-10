"""
다이어리 CRUD API 라우터
"""
import uuid
import logging
from fastapi import APIRouter, HTTPException
from backend.schemas import DogProfile, DailyLog, DiaryEditRequest
from backend.agents import build_agent_graph
from backend import user_store

logger = logging.getLogger("pawpalja.diary")

router = APIRouter()

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


@router.post("/diary/generate/{user_id}")
async def generate_diary(user_id: str, logs: DailyLog):
    """오늘의 다이어리를 생성하고 저장합니다."""
    user = user_store.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    try:
        profile = DogProfile(**user["dog"])
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

        saved = user_store.save_diary_entry(user_id, entry)
        return saved
    except Exception as e:
        logger.exception("다이어리 생성 실패")
        raise HTTPException(status_code=500, detail="다이어리 생성 중 오류가 발생했습니다.")


@router.get("/diary/list/{user_id}")
async def list_diaries(user_id: str, limit: int = 30):
    return user_store.get_diaries(user_id, limit)


@router.get("/diary/entry/{user_id}/{entry_id}")
async def get_diary_entry(user_id: str, entry_id: str):
    entry = user_store.get_diary_by_id(user_id, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="다이어리를 찾을 수 없습니다.")
    return entry


@router.put("/diary/edit/{user_id}/{entry_id}")
async def edit_diary(user_id: str, entry_id: str, req: DiaryEditRequest):
    """일기를 수정하고, 기존 댓글을 모두 삭제한 뒤 수정 반응만 SSE로 전달합니다."""
    entry = user_store.get_diary_by_id(user_id, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="다이어리를 찾을 수 없습니다.")

    diary = entry.get("diary", {})
    diary["content"] = req.edited_diary
    updated = user_store.update_diary_entry(user_id, entry_id, {"diary": diary})

    if not updated:
        raise HTTPException(status_code=500, detail="수정에 실패했습니다.")

    user_store.clear_comments(user_id, entry_id)
    updated = user_store.get_diary_by_id(user_id, entry_id)
    return updated


@router.delete("/diary/{user_id}/{entry_id}")
async def delete_diary(user_id: str, entry_id: str):
    """일기를 삭제합니다."""
    success = user_store.delete_diary_entry(user_id, entry_id)
    if not success:
        raise HTTPException(status_code=404, detail="다이어리를 찾을 수 없습니다.")
    return {"success": True}
