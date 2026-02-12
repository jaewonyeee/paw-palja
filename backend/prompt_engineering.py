"""
Advanced Prompt Engineering Techniques
Self-Consistency, Few-Shot Enhancement, CoT Refinement
"""
from typing import List, Dict, Any, Callable
from collections import Counter
import json
import logging
from backend.llm_provider import get_llm

logger = logging.getLogger("pawpalja.prompt_engineering")


def self_consistency_generate(
    prompt_template: Callable,
    prompt_params: Dict[str, Any],
    n_samples: int = 3,
    temperature: float = 0.9,
    output_schema: Any = None
) -> Dict[str, Any]:
    """Self-Consistency 기법으로 LLM 출력 생성

    동일한 프롬프트로 여러 번 생성하여 가장 일관성 있는 결과 선택

    Args:
        prompt_template: ChatPromptTemplate 또는 프롬프트 생성 함수
        prompt_params: 프롬프트 파라미터
        n_samples: 생성 샘플 수 (기본값: 3)
        temperature: 생성 temperature (다양성 위해 높게 설정)
        output_schema: Pydantic 모델 (Structured Output용)

    Returns:
        가장 일관성 있는 결과
    """
    llm = get_llm(temperature=temperature)

    # 여러 번 생성
    results = []
    for i in range(n_samples):
        try:
            if output_schema:
                chain = prompt_template | llm.with_structured_output(output_schema)
            else:
                chain = prompt_template | llm

            result = chain.invoke(prompt_params)

            if output_schema:
                results.append(result.model_dump())
            else:
                results.append({"content": result.content})

            logger.debug(f"Self-Consistency 샘플 {i+1}/{n_samples} 생성 완료")

        except Exception as e:
            logger.warning(f"Self-Consistency 샘플 {i+1} 생성 실패: {e}")
            continue

    if not results:
        raise ValueError("Self-Consistency: 모든 샘플 생성 실패")

    # 투표 방식으로 가장 일관성 있는 결과 선택
    return _select_most_consistent(results)


def _select_most_consistent(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """가장 일관성 있는 결과 선택 (투표 방식)

    Args:
        results: 생성된 결과 리스트

    Returns:
        가장 빈도 높은 결과
    """
    # 각 필드별로 가장 많이 나온 값 선택
    if not results:
        return {}

    # 모든 키 수집
    all_keys = set()
    for result in results:
        all_keys.update(result.keys())

    # 각 키별로 최빈값 선택
    consensus_result = {}
    for key in all_keys:
        values = [result.get(key) for result in results if key in result]

        if not values:
            continue

        # 문자열 필드: 최빈값
        if isinstance(values[0], str):
            counter = Counter(values)
            most_common = counter.most_common(1)[0][0]
            consensus_result[key] = most_common

        # 숫자 필드: 평균
        elif isinstance(values[0], (int, float)):
            consensus_result[key] = sum(values) / len(values)

        # 기타: 첫 번째 값 사용
        else:
            consensus_result[key] = values[0]

    return consensus_result


# Oracle Few-Shot 예시
ORACLE_FEW_SHOT_EXAMPLES = {
    "ko": """
[예시 1 - 비 오는 날 + 푸들]
입력:
- 견종: 푸들
- 날씨: 비, 15°C, 습도 80%
- 기분: 우울
- 트렌드: 실내 놀이 키트 인기

출력:
제목: 오늘은 집콕이 대세!
내용: "비 오는 날엔 역시 실내 데이트가 길하다냥~ 🌧️ 푸들 특성상 털 관리가 중요한데, 오늘처럼 습한 날은 밖에 나가면 털이 엉킬 수 있으니 조심! 대신 집에서 노즈워크나 실내 놀이로 에너지 발산하면 럭키 데이가 될 거야. 요즘 대세는 실내 놀이 키트래~ 집사한테 졸라볼까? ㅋㅋ"
럭키 아이템: 노즈워크 매트
인터랙션 힌트: 집사와 숨바꼭질 놀이

[예시 2 - 더운 날 + 불독]
입력:
- 견종: 불독
- 날씨: 맑음, 32°C, 습도 60%
- 기분: 신남
- 트렌드: 반려견 쿨매트 인기

출력:
제목: 더위 주의보! 오전 일찍 산책 필수
내용: "오늘 날씨 진짜 덥다... 불독은 열에 약하니까 오후 산책은 위험해! 🥵 새벽이나 이른 아침에 짧게 다녀오고, 낮에는 에어컨 빵빵한 실내에서 쉬는 게 상책이야. 요즘 유행하는 쿨매트 깔아놓으면 완전 꿀템! 물도 자주자주 마시고, 집사가 혹시 차에 나 두고 가려고 하면 절대 안 돼! 생명 위험이야."
럭키 아이템: 쿨매트
인터랙션 힌트: 시원한 물 자주 제공

[예시 3 - 봄날 + 시츄]
입력:
- 견종: 시츄
- 날씨: 맑음, 20°C, 습도 50%
- 기분: 평범
- 트렌드: 반려견 카페 인기

출력:
제목: 봄바람 타고 산책 가기 딱 좋은 날!
내용: "오늘 날씨 완전 개이득! 🌸 시츄는 사람을 좋아하는 성격이라 카페 나들이 가면 대박 날 거야. 요즘 반려견 카페 엄청 핫하던데, 거기서 새 친구들도 만나고 맛난 간식도 먹고~ 단, 털 관리 때문에 먼지 많은 곳은 피하는 게 좋아. 오늘은 럭키 데이니까 뭐든 긍정적으로!"
럭키 아이템: 강아지 카페 쿠폰
인터랙션 힌트: 카페에서 사람들과 교류
""",
    "en": """
[Example 1 - Rainy Day + Poodle]
Input:
- Breed: Poodle
- Weather: Rain, 59°F, Humidity 80%
- Mood: Sad
- Trend: Indoor play kits trending

Output:
Title: Stay Home Vibes Today!
Content: "When it's raining, indoor dates are the vibe~ 🌧️ Poodles need careful coat management, and humid days like this can cause tangles if you go out. Instead, do some nosework or indoor play to burn energy - that's your lucky move! Indoor play kits are trending rn, maybe ask your human? lol"
Lucky Item: Nosework mat
Interaction Hint: Hide and seek with human

[Example 2 - Hot Day + Bulldog]
Input:
- Breed: Bulldog
- Weather: Sunny, 90°F, Humidity 60%
- Mood: Happy
- Trend: Cooling mats trending

Output:
Title: Heat Warning! Early Morning Walk Essential
Content: "Today is HOT hot... Bulldogs are sensitive to heat, so afternoon walks are dangerous! 🥵 Go early morning or dawn for a short walk, then chill inside with AC on full blast. Those trending cooling mats? Totally worth it! Drink water frequently, and NEVER let your human leave you in a hot car - that's life-threatening fr fr."
Lucky Item: Cooling mat
Interaction Hint: Frequent water breaks

[Example 3 - Spring Day + Shih Tzu]
Input:
- Breed: Shih Tzu
- Weather: Sunny, 68°F, Humidity 50%
- Mood: Neutral
- Trend: Dog cafes trending

Output:
Title: Perfect Spring Breeze Walk Day!
Content: "Today's weather is chef's kiss! 🌸 Shih Tzus love people, so hitting up a dog cafe would be lit. Dog cafes are trending hard rn - make new friends, get yummy treats~ Just avoid super dusty places because coat maintenance. Today's a lucky day, so stay positive about everything!"
Lucky Item: Dog cafe coupon
Interaction Hint: Socialize at cafe
"""
}


def get_oracle_few_shot_prompt(language: str = "ko") -> str:
    """Oracle Agent용 Few-Shot 예시 반환

    Args:
        language: 언어 코드 ("ko" 또는 "en")

    Returns:
        Few-Shot 예시 텍스트
    """
    return ORACLE_FEW_SHOT_EXAMPLES.get(language, ORACLE_FEW_SHOT_EXAMPLES["ko"])


if __name__ == "__main__":
    # Self-Consistency 테스트
    from langchain_core.prompts import ChatPromptTemplate
    from backend.schemas import HoroscopeResult

    prompt = ChatPromptTemplate.from_messages([
        ("system", "당신은 강아지 점술가입니다. 오늘의 운세를 작성하세요."),
        ("human", "견종: {breed}, 날씨: {weather}"),
    ])

    result = self_consistency_generate(
        prompt_template=prompt,
        prompt_params={"breed": "푸들", "weather": "비"},
        n_samples=3,
        output_schema=HoroscopeResult,
    )

    print(json.dumps(result, ensure_ascii=False, indent=2))
