"""
댓글 관련 API 라우터 (생성, SSE 스트리밍)
"""
import json
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from backend.schemas import CommentRequest
from backend.comment_agents import generate_comments, generate_edit_reactions, generate_comments_stream
from backend import user_store

logger = logging.getLogger("pawpalja.comments")

router = APIRouter()


@router.post("/comments/generate")
async def api_generate_comments(req: CommentRequest):
    """일기에 대한 댓글을 생성합니다."""
    try:
        comments = generate_comments(req.diary_content, req.dog_name, req.dog_breed, count=3)
        return {"comments": comments}
    except Exception as e:
        logger.exception("댓글 생성 실패")
        raise HTTPException(status_code=500, detail="댓글 생성 중 오류가 발생했습니다.")


@router.get("/comments/stream/{user_id}/{entry_id}")
async def stream_comments(user_id: str, entry_id: str, mode: str = "new"):
    """SSE로 댓글을 실시간 스트리밍합니다. mode=edit이면 수정 반응만 생성."""
    entry = user_store.get_diary_by_id(user_id, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="다이어리를 찾을 수 없습니다.")

    user = user_store.get_user(user_id)
    diary_text = entry.get("diary", {}).get("content", "")
    dog_name = user["dog"].get("name", "멍멍이") if user else "멍멍이"
    dog_breed = user["dog"].get("breed", "믹스견") if user else "믹스견"

    if mode not in ("new", "edit"):
        raise HTTPException(status_code=400, detail="mode는 'new' 또는 'edit'만 가능합니다.")

    def event_stream():
        try:
            if mode == "edit":
                reactions = generate_edit_reactions("", diary_text, dog_name, dog_breed)
                import time
                for reaction in reactions:
                    time.sleep(2)
                    user_store.add_comments_to_diary(user_id, entry_id, [reaction])
                    data = json.dumps(reaction, ensure_ascii=False)
                    yield f"data: {data}\n\n"
            else:
                for comment in generate_comments_stream(diary_text, dog_name, dog_breed, count=3):
                    user_store.add_comments_to_diary(user_id, entry_id, [comment])
                    data = json.dumps(comment, ensure_ascii=False)
                    yield f"data: {data}\n\n"
        except Exception:
            logger.exception("SSE 스트리밍 중 오류")
            yield f'data: {json.dumps({"error": "댓글 생성 중 오류가 발생했습니다."}, ensure_ascii=False)}\n\n'
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
