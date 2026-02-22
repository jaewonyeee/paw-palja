"""
GPT-4o Vision 사진 분석 모듈
반려견 사진을 분석하여 감정, 활동, 건강 관찰, 재미 포인트를 추출합니다.
"""
import os
import json
import logging

logger = logging.getLogger("pawpalja.photo_analysis")


async def analyze_pet_photo(photo_base64: str, dog_name: str, breed: str) -> dict | None:
    """GPT-4o Vision으로 반려견 사진 분석.

    Args:
        photo_base64: base64 data URI (data:image/...;base64,...) 또는 URL
        dog_name: 반려견 이름
        breed: 견종

    Returns:
        분석 결과 dict 또는 실패 시 None
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or api_key == "your_openai_api_key_here":
        logger.warning("OPENAI_API_KEY not configured, skipping photo analysis")
        return None

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)

        # Prepare image URL
        if photo_base64.startswith("data:"):
            image_url = photo_base64
        elif photo_base64.startswith("http"):
            image_url = photo_base64
        else:
            image_url = f"data:image/jpeg;base64,{photo_base64}"

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            f"이 사진은 {breed} 품종의 반려견 '{dog_name}'입니다. "
                            "다음 항목을 분석해주세요:\n"
                            "1. 표정/감정 상태\n"
                            "2. 활동 (뭘 하고 있는지)\n"
                            "3. 건강 관찰 (털 상태, 눈, 체형 등)\n"
                            "4. 재미있는 포인트\n\n"
                            "반드시 JSON으로 응답해주세요:\n"
                            '{"emotion_ko": "...", "emotion_en": "...", '
                            '"activity_ko": "...", "activity_en": "...", '
                            '"health_observation_ko": "...", "health_observation_en": "...", '
                            '"fun_point_ko": "...", "fun_point_en": "..."}'
                        )
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": image_url, "detail": "low"}
                    }
                ]
            }],
            response_format={"type": "json_object"},
            max_tokens=500,
        )

        result = json.loads(response.choices[0].message.content)
        logger.info("Photo analysis completed for %s", dog_name)
        return result

    except Exception as e:
        logger.error("Photo analysis failed: %s", e)
        return None
