"""
댓글 관련 API 라우터 (생성, SSE 스트리밍)
"""
import json
import asyncio
import logging
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from backend.schemas import CommentRequest
from backend.comment_agents import generate_comments, generate_edit_reactions, generate_comments_stream
from backend import user_store
from backend.database import get_db, AsyncSessionLocal
from backend.auth import get_current_user, decode_token
from backend.i18n import get_message, get_lang

logger = logging.getLogger("pawpalja.comments")

router = APIRouter()

from backend.rate_limit import limiter


@router.post("/comments/generate")
@limiter.limit("5/minute")
async def api_generate_comments(request: Request, req: CommentRequest, current_user: dict = Depends(get_current_user)):
    """일기에 대한 댓글을 생성합니다."""
    try:
        comments = generate_comments(req.diary_content, req.dog_name, req.dog_breed, count=3)
        return {"comments": comments}
    except Exception as e:
        logger.exception("댓글 생성 실패")
        raise HTTPException(status_code=500, detail=get_message("comment_create_error", get_lang(request)))


@router.get("/comments/stream/{entry_id}")
@limiter.limit("5/minute")
async def stream_comments(
    request: Request,
    entry_id: str,
    mode: str = "new",
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """SSE로 댓글을 실시간 스트리밍합니다. mode=edit이면 수정 반응만 생성.
    EventSource는 헤더를 지원하지 않으므로 token을 query param으로 전달합니다."""
    lang = get_lang(request)
    payload = decode_token(token, lang)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail=get_message("invalid_token_type", lang))
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail=get_message("invalid_token", lang))

    entry = await user_store.get_diary_by_id(db, user_id, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail=get_message("diary_not_found", lang))

    user = await user_store.get_user(db, user_id)
    diary_data = entry.get("diary", {})
    diary_text = diary_data.get("content_ko") or diary_data.get("content_en") or diary_data.get("content") or ""
    dog_name = user["dog"].get("name", "멍멍이") if user else "멍멍이"
    dog_breed = user["dog"].get("breed", "믹스견") if user else "믹스견"

    if mode not in ("new", "edit"):
        raise HTTPException(status_code=400, detail=get_message("invalid_comment_mode", lang))

    async def event_stream():
        try:
            if mode == "edit":
                reactions = generate_edit_reactions("", diary_text, dog_name, dog_breed)
                for reaction in reactions:
                    await asyncio.sleep(2)
                    if reaction and reaction.get("text") and reaction["text"].strip():
                        async with AsyncSessionLocal() as session:
                            await user_store.add_comments_to_diary(session, user_id, entry_id, [reaction])
                        data = json.dumps(reaction, ensure_ascii=False)
                        yield f"data: {data}\n\n"
            else:
                loop = asyncio.get_running_loop()
                comments_list = await loop.run_in_executor(
                    None, lambda: list(generate_comments_stream(diary_text, dog_name, dog_breed, count=3))
                )
                for i, comment in enumerate(comments_list):
                    if i > 0:
                        await asyncio.sleep(comment.get("delay_seconds", 5))
                    if comment and comment.get("text") and comment["text"].strip():
                        async with AsyncSessionLocal() as session:
                            await user_store.add_comments_to_diary(session, user_id, entry_id, [comment])
                        data = json.dumps(comment, ensure_ascii=False)
                        yield f"data: {data}\n\n"
        except Exception:
            logger.exception("SSE 스트리밍 중 오류")
            yield f'data: {json.dumps({"error": get_message("comment_create_error", lang)}, ensure_ascii=False)}\n\n'
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
