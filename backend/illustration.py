"""
DALL-E 3 일러스트 생성 모듈
일기 내용을 바탕으로 귀여운 일러스트를 자동 생성합니다.
"""
import os
import logging

logger = logging.getLogger("pawpalja.illustration")


async def generate_diary_illustration(
    diary_content: str, dog_name: str, breed: str
) -> str | None:
    """DALL-E 3로 일기 일러스트 생성.

    Args:
        diary_content: 일기 내용 텍스트
        dog_name: 반려견 이름
        breed: 견종

    Returns:
        base64 data URI 문자열 또는 실패 시 None
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or api_key == "your_openai_api_key_here":
        logger.warning("OPENAI_API_KEY not configured, skipping illustration")
        return None

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)

        # Build illustration prompt from diary content
        scene = diary_content[:200] if diary_content else "playing happily"
        prompt = (
            f"Cute kawaii-style illustration of a {breed} dog named {dog_name}. "
            f"Scene: {scene}. "
            "Style: Soft watercolor, warm pastel colors, children's book illustration. "
            "No text, no words, no letters in the image. "
            "Simple, heartwarming, and adorable."
        )

        response = client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1024x1024",
            quality="standard",
            response_format="b64_json",
            n=1,
        )

        b64 = response.data[0].b64_json
        logger.info("Illustration generated for %s", dog_name)
        return f"data:image/png;base64,{b64}"

    except Exception as e:
        logger.error("Illustration generation failed: %s", e)
        return None
