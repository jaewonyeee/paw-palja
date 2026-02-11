"""
댓글 Sub-Agent 시스템
일기에 대해 다양한 페르소나로 귀여운 댓글을 생성합니다.
각 에이전트는 서로 다른 성격을 가지며, 무작위 딜레이로 "진짜 사람처럼" 반응합니다.
SSE 스트리밍을 통해 실시간으로 댓글이 도착합니다.
"""
import random
from typing import Generator
from langchain_core.prompts import ChatPromptTemplate
from backend.llm_provider import get_llm
from backend.schemas import CommentResult

# LLM 이모지 생성을 위한 캐시
EMOJI_CACHE = {}


# 댓글 에이전트 페르소나 정의
COMMENT_PERSONAS = [
    {
        "name": "뽀삐언니",
        "emoji": "🐩",
        "personality": "동네 인기견. 항상 밝고 텐션 높음. 사투리 섞어 씀.",
        "tone": "언니/오빠 느낌, 텐션 높은 칭찬, '대박!', '완전!', '진짜?!'",
    },
    {
        "name": "츄르대장",
        "emoji": "🐱",
        "personality": "고양이인데 강아지 동네에 살고 있음. 시크하지만 은근 관심 많음.",
        "tone": "시크하고 도도한 말투. '뭐... 괜찮네', '나라면 안 했겠지만'",
    },
    {
        "name": "할배멍",
        "emoji": "🦮",
        "personality": "동네 최고 원로견. 인생 선배 느낌. 따뜻한 한마디.",
        "tone": "어르신 말투, '그래 잘했구나', '옛날 생각이 나는구만'",
    },
    {
        "name": "멍스타그램",
        "emoji": "📸",
        "personality": "인플루언서 강아지. SNS에 진심. 해시태그 중독.",
        "tone": "SNS 인플루언서 말투, '#오늘도산책', '#멍멍스타그램', 이모지 가득",
    },
    {
        "name": "Dr.왕왕",
        "emoji": "🩺",
        "personality": "수의학 지식이 풍부한 강아지. 건강 관련 한마디를 꼭 던짐.",
        "tone": "전문적이지만 친근, '건강 팁 하나!', '이건 꼭 챙겨!'",
    },
]


def generate_comment_emoji(persona_name: str, comment_text: str, use_cache: bool = True) -> str:
    """LLM을 사용하여 댓글 작성자에 맞는 이모지 생성

    Args:
        persona_name: 페르소나 이름 (예: "뽀삐언니", "츄르대장")
        comment_text: 댓글 내용
        use_cache: 캐싱 사용 여부 (기본값: True)

    Returns:
        생성된 이모지 (단일 이모지 문자열)
    """
    # 캐싱 체크
    cache_key = f"{persona_name}:{comment_text[:50]}"
    if use_cache and cache_key in EMOJI_CACHE:
        return EMOJI_CACHE[cache_key]

    # 기본 이모지 폴백 매핑
    default_emojis = {
        "뽀삐언니": "🐩",
        "츄르대장": "🐱",
        "할배멍": "🦮",
        "멍스타그램": "📸",
        "Dr.왕왕": "🩺",
    }

    llm = get_llm(temperature=0.9)

    prompt = f"""댓글 작성자 페르소나: {persona_name}
댓글 내용: {comment_text}

이 페르소나와 댓글 내용에 가장 어울리는 이모지 1개를 생성하세요.
이모지만 출력하세요 (설명 없이).

예시:
- 뽀삐언니 + 칭찬 댓글 → 🐩
- 츄르대장 + 시크한 댓글 → 🐱
- 할배멍 + 조언 댓글 → 🦮
- 멍스타그램 + SNS 댓글 → 📸
- Dr.왕왕 + 건강 조언 → 🩺
"""

    try:
        response = llm.invoke(prompt)
        emoji = response.content.strip()

        # 이모지 검증 (길이가 2자 이하이고 비어있지 않아야 함)
        if emoji and len(emoji) <= 4:  # 일부 이모지는 2자 이상일 수 있음
            if use_cache:
                EMOJI_CACHE[cache_key] = emoji
            return emoji
        else:
            # 기본값 폴백
            return default_emojis.get(persona_name, "🐕")
    except Exception:
        # 오류 시 기본값 폴백
        return default_emojis.get(persona_name, "🐕")


def generate_comments(diary_content: str, dog_name: str, dog_breed: str, count: int = 3) -> list[dict]:
    """일기 내용에 대해 여러 페르소나 에이전트가 댓글을 생성합니다.

    Args:
        diary_content: 일기 본문
        dog_name: 강아지 이름
        dog_breed: 견종
        count: 생성할 댓글 수 (1~5)

    Returns:
        댓글 리스트 (각 댓글에 author, emoji, text, delay_seconds 포함)
    """
    llm = get_llm(temperature=0.95)
    count = min(count, len(COMMENT_PERSONAS))
    selected = random.sample(COMMENT_PERSONAS, count)
    comments = []

    for persona in selected:
        prompt = ChatPromptTemplate.from_messages([
            ("system",
             "You are '{name}' ({emoji}), a bilingual character.\n"
             "Personality: {personality}\n"
             "Tone: {tone}\n\n"
             "⚠️ CRITICAL: You MUST generate comments in BOTH Korean (text_ko) and English (text_en).\n"
             "Read your dog friend's diary and write a short, cute comment in 1-2 sentences.\n"
             "Make it natural and emotional like real SNS comments.\n"
             "Include 1-2 emojis naturally in BOTH versions.\n"
             "Adapt cultural nuances appropriately for each language."),
            ("human",
             "{dog_name} ({dog_breed})'s diary today:\n\n\"{diary}\"\n\n"
             "Write a comment in BOTH Korean and English!"),
        ])

        try:
            chain = prompt | llm.with_structured_output(CommentResult)
            result = chain.invoke({
                "name": persona["name"],
                "emoji": persona["emoji"],
                "personality": persona["personality"],
                "tone": persona["tone"],
                "dog_name": dog_name,
                "dog_breed": dog_breed,
                "diary": diary_content,
            })

            # LLM으로 동적 이모지 생성 (한국어 버전 기준)
            dynamic_emoji = generate_comment_emoji(persona["name"], result.text_ko or result.text or "")

            delay = random.randint(3, 45)
            comments.append({
                "author": result.author or persona["name"],
                "emoji": dynamic_emoji,  # 동적 생성된 이모지 사용
                "text_ko": result.text_ko,  # 한국어 댓글
                "text_en": result.text_en,  # 영어 댓글
                "text": result.text_ko or result.text,  # 레거시 호환용 (한국어 기본)
                "delay_seconds": delay,
            })
        except Exception as e:
            fallback_text_ko = f"{dog_name}아 오늘도 화이팅! ✨"
            fallback_text_en = f"{dog_name}, fighting today too! ✨"
            comments.append({
                "author": persona["name"],
                "emoji": generate_comment_emoji(persona["name"], fallback_text_ko),
                "text_ko": fallback_text_ko,
                "text_en": fallback_text_en,
                "text": fallback_text_ko,  # 레거시 호환용
                "delay_seconds": random.randint(5, 30),
            })

    comments.sort(key=lambda x: x["delay_seconds"])
    return comments


def generate_edit_reactions(original: str, edited: str, dog_name: str, dog_breed: str) -> list[dict]:
    """일기 수정 시 에이전트들이 수정 사항에 반응하는 댓글을 생성합니다."""
    llm = get_llm(temperature=0.9)
    selected = random.sample(COMMENT_PERSONAS, 2)
    reactions = []

    for persona in selected:
        prompt = ChatPromptTemplate.from_messages([
            ("system",
             "You are '{name}' ({emoji}), a bilingual character.\n"
             "Personality: {personality}\n"
             "Tone: {tone}\n\n"
             "⚠️ CRITICAL: You MUST generate reactions in BOTH Korean (text_ko) and English (text_en).\n"
             "Your dog friend edited their diary. React wittily to the before/after changes.\n"
             "Keep it short and natural in 1 sentence for each language!"),
            ("human",
             "{dog_name} ({dog_breed}) edited their diary!\n\n"
             "Before: \"{original}\"\n"
             "After: \"{edited}\"\n\n"
             "React to the edit in BOTH Korean and English!"),
        ])

        try:
            chain = prompt | llm.with_structured_output(CommentResult)
            result = chain.invoke({
                "name": persona["name"],
                "emoji": persona["emoji"],
                "personality": persona["personality"],
                "tone": persona["tone"],
                "dog_name": dog_name,
                "dog_breed": dog_breed,
                "original": original[:200],
                "edited": edited[:200],
            })

            # LLM으로 동적 이모지 생성 (한국어 버전 기준)
            dynamic_emoji = generate_comment_emoji(persona["name"], result.text_ko or result.text or "")

            reactions.append({
                "author": result.author or persona["name"],
                "emoji": dynamic_emoji,  # 동적 생성된 이모지 사용
                "text_ko": result.text_ko,  # 한국어 댓글
                "text_en": result.text_en,  # 영어 댓글
                "text": result.text_ko or result.text,  # 레거시 호환용
                "delay_seconds": random.randint(5, 60),
                "is_edit_reaction": True,
            })
        except Exception:
            fallback_text_ko = f"오 {dog_name} 수정했구나! 👀"
            fallback_text_en = f"Oh {dog_name} edited it! 👀"
            reactions.append({
                "author": persona["name"],
                "emoji": generate_comment_emoji(persona["name"], fallback_text_ko),
                "text_ko": fallback_text_ko,
                "text_en": fallback_text_en,
                "text": fallback_text_ko,  # 레거시 호환용
                "delay_seconds": random.randint(5, 30),
                "is_edit_reaction": True,
            })

    reactions.sort(key=lambda x: x["delay_seconds"])
    return reactions


def generate_comments_stream(diary_content: str, dog_name: str, dog_breed: str, count: int = 3) -> Generator[dict, None, None]:
    """댓글을 하나씩 생성하여 yield합니다 (SSE 스트리밍용).

    각 댓글이 생성될 때마다 바로 yield되므로 클라이언트는 실시간으로 수신 가능합니다.
    """
    llm = get_llm(temperature=0.95)
    count = min(count, len(COMMENT_PERSONAS))
    selected = random.sample(COMMENT_PERSONAS, count)

    for i, persona in enumerate(selected):
        prompt = ChatPromptTemplate.from_messages([
            ("system",
             "You are '{name}' ({emoji}), a bilingual character.\n"
             "Personality: {personality}\n"
             "Tone: {tone}\n\n"
             "⚠️ CRITICAL: You MUST generate comments in BOTH Korean (text_ko) and English (text_en).\n"
             "Read your dog friend's diary and write a short, cute comment in 1-2 sentences.\n"
             "Make it natural and emotional like real SNS comments.\n"
             "Include 1-2 emojis naturally in BOTH versions."),
            ("human",
             "{dog_name} ({dog_breed})'s diary today:\n\n\"{diary}\"\n\n"
             "Write a comment in BOTH Korean and English!"),
        ])

        try:
            chain = prompt | llm.with_structured_output(CommentResult)
            result = chain.invoke({
                "name": persona["name"],
                "emoji": persona["emoji"],
                "personality": persona["personality"],
                "tone": persona["tone"],
                "dog_name": dog_name,
                "dog_breed": dog_breed,
                "diary": diary_content,
            })

            # LLM으로 동적 이모지 생성 (한국어 버전 기준)
            dynamic_emoji = generate_comment_emoji(persona["name"], result.text_ko or result.text or "")

            yield {
                "author": result.author or persona["name"],
                "emoji": dynamic_emoji,  # 동적 생성된 이모지 사용
                "text_ko": result.text_ko,  # 한국어 댓글
                "text_en": result.text_en,  # 영어 댓글
                "text": result.text_ko or result.text,  # 레거시 호환용
                "index": i,
            }
        except Exception:
            fallback_text_ko = f"{dog_name}아 오늘도 화이팅! ✨"
            fallback_text_en = f"{dog_name}, fighting today too! ✨"
            yield {
                "author": persona["name"],
                "emoji": generate_comment_emoji(persona["name"], fallback_text_ko),
                "text_ko": fallback_text_ko,
                "text_en": fallback_text_en,
                "text": fallback_text_ko,  # 레거시 호환용
                "index": i,
            }
