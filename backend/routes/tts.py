"""
OpenAI TTS 음성 생성 API 엔드포인트
"""
import io
import os
import logging
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from backend.auth import get_current_user
from backend.i18n import get_message, get_lang

logger = logging.getLogger("pawpalja.tts")

router = APIRouter()


class TTSRequest(BaseModel):
    text: str
    voice: str = "nova"  # nova: warm female voice


@router.post("/tts/generate")
async def generate_tts(
    request: Request,
    data: TTSRequest,
    current_user: dict = Depends(get_current_user),
):
    """OpenAI TTS를 사용하여 텍스트를 음성으로 변환합니다."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or api_key == "your_openai_api_key_here":
        raise HTTPException(status_code=503, detail="OpenAI API key not configured")

    if not data.text or not data.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")

    # Validate voice option
    valid_voices = ("alloy", "echo", "fable", "onyx", "nova", "shimmer")
    voice = data.voice if data.voice in valid_voices else "nova"

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)

        response = client.audio.speech.create(
            model="tts-1",
            voice=voice,
            input=data.text[:4096],
        )

        logger.info("TTS generated for user %s (%d chars)", current_user["user_id"], len(data.text))

        return StreamingResponse(
            io.BytesIO(response.content),
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=diary-tts.mp3"},
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("TTS generation failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail=get_message("tts_generation_error", get_lang(request))
        )
