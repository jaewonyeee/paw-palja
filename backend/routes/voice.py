"""
Whisper 음성→텍스트 변환 API 엔드포인트
"""
import os
import logging
from fastapi import APIRouter, File, UploadFile, Depends, HTTPException, Request
from backend.auth import get_current_user, require_premium
from backend.i18n import get_message, get_lang

logger = logging.getLogger("pawpalja.voice")

router = APIRouter()


@router.post("/voice/transcribe")
async def transcribe_voice(
    request: Request,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_premium),
):
    """Whisper를 사용하여 음성을 텍스트로 변환합니다."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or api_key == "your_openai_api_key_here":
        raise HTTPException(status_code=503, detail="OpenAI API key not configured")

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)

        audio_data = await file.read()
        if len(audio_data) > 25 * 1024 * 1024:  # 25MB limit
            raise HTTPException(status_code=413, detail="Audio file too large (max 25MB)")

        content_type = file.content_type or "audio/webm"
        filename = file.filename or "audio.webm"

        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=(filename, audio_data, content_type),
            language="ko",
        )

        logger.info("Voice transcription completed for user %s", current_user["user_id"])
        return {"text": transcript.text}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Voice transcription failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail=get_message("voice_transcription_error", get_lang(request))
        )
