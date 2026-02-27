"""
댓글 관련 API 라우터 (생성, SSE 스트리밍)
"""
import json
import time
import random
import asyncio
import logging
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from backend.schemas import CommentRequest
from backend.comment_agents import (
    generate_comments, generate_edit_reactions, generate_single_comment,
    COMMENT_PERSONAS,
)
from backend import user_store
from backend.database import get_db, AsyncSessionLocal
from backend.auth import get_current_user, decode_token, check_premium
from backend.i18n import get_message, get_lang

logger = logging.getLogger("pawpalja.comments")

router = APIRouter()

from backend.rate_limit import limiter


@router.post("/comments/generate")
@limiter.limit("5/minute")
async def api_generate_comments(
    request: Request,
    req: CommentRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """일기에 대한 댓글을 생성합니다."""
    try:
        start_time = time.time()
        comment_count = 5 if check_premium(current_user) else 3
        comments = generate_comments(req.diary_content, req.dog_name, req.dog_breed, count=comment_count)
        duration_ms = int((time.time() - start_time) * 1000)
        try:
            from backend import user_store as _us
            await _us.log_api_usage(
                db, user_id=current_user["user_id"], endpoint="/comments/generate",
                model_name="comment-agents", duration_ms=duration_ms, success=True,
            )
        except Exception:
            logger.warning("Failed to log API usage")
        return {"comments": comments}
    except Exception as e:
        logger.exception("댓글 생성 실패")
        try:
            from backend import user_store as _us
            await _us.log_api_usage(
                db, user_id=current_user["user_id"], endpoint="/comments/generate",
                model_name="comment-agents", success=False,
                error_message=str(e)[:500],
            )
        except Exception:
            logger.warning("Failed to log API usage error")
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
    is_premium = check_premium(user) if user else False
    diary_data = entry.get("diary", {})
    diary_text = diary_data.get("content_ko") or diary_data.get("content_en") or diary_data.get("content") or ""
    dog = user.get("dog") if user else None
    dog_name = dog.get("name", "멍멍이") if dog else "멍멍이"
    dog_breed = dog.get("breed", "믹스견") if dog else "믹스견"

    if mode not in ("new", "edit"):
        raise HTTPException(status_code=400, detail=get_message("invalid_comment_mode", lang))

    async def event_stream():
        loop = asyncio.get_running_loop()
        try:
            if mode == "edit":
                # edit 반응도 executor에서 실행 (blocking LLM 호출)
                reactions = await loop.run_in_executor(
                    None, lambda: generate_edit_reactions("", diary_text, dog_name, dog_breed)
                )
                for reaction in reactions:
                    await asyncio.sleep(2)
                    has_text = (
                        (reaction.get("text_ko") and reaction["text_ko"].strip()) or
                        (reaction.get("text_en") and reaction["text_en"].strip()) or
                        (reaction.get("text") and reaction["text"].strip())
                    )
                    if reaction and has_text:
                        async with AsyncSessionLocal() as session:
                            await user_store.add_comments_to_diary(session, user_id, entry_id, [reaction])
                        data = json.dumps(reaction, ensure_ascii=False)
                        yield f"data: {data}\n\n"
                    else:
                        logger.warning("Empty comment skipped for entry %s: %s", entry_id, reaction)
            else:
                # 진짜 순차 스트리밍: 댓글 1개 생성 → 즉시 전송 → 다음 생성
                count = 5 if is_premium else 3
                selected = random.sample(COMMENT_PERSONAS, min(count, len(COMMENT_PERSONAS)))
                for i, persona in enumerate(selected):
                    if i > 0:
                        await asyncio.sleep(random.uniform(3, 7))
                    comment = await loop.run_in_executor(
                        None, lambda p=persona, idx=i: generate_single_comment(
                            diary_text, dog_name, dog_breed, p, idx
                        )
                    )
                    has_text = (
                        (comment.get("text_ko") and comment["text_ko"].strip()) or
                        (comment.get("text_en") and comment["text_en"].strip()) or
                        (comment.get("text") and comment["text"].strip())
                    )
                    if comment and has_text:
                        async with AsyncSessionLocal() as session:
                            await user_store.add_comments_to_diary(session, user_id, entry_id, [comment])
                        data = json.dumps(comment, ensure_ascii=False)
                        yield f"data: {data}\n\n"
                    else:
                        logger.warning("Empty comment skipped for entry %s: %s", entry_id, comment)
        except Exception:
            logger.exception("SSE 스트리밍 중 오류")
            yield f'data: {json.dumps({"error": get_message("comment_create_error", lang)}, ensure_ascii=False)}\n\n'
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
