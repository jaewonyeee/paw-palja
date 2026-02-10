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
             "당신은 '{name}' ({emoji})이라는 캐릭터입니다.\n"
             "성격: {personality}\n"
             "말투: {tone}\n\n"
             "강아지 친구의 일기를 읽고 1~2문장으로 짧고 귀엽게 댓글을 달아주세요.\n"
             "진짜 SNS 댓글처럼 자연스럽고 감성적으로 작성하세요.\n"
             "이모지를 1~2개 정도 자연스럽게 넣어주세요."),
            ("human",
             "{dog_name}({dog_breed})의 오늘 일기:\n\n\"{diary}\"\n\n"
             "위 일기에 댓글을 달아주세요!"),
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

            delay = random.randint(3, 45)
            comments.append({
                "author": result.author or persona["name"],
                "emoji": result.emoji or persona["emoji"],
                "text": result.text,
                "delay_seconds": delay,
            })
        except Exception as e:
            comments.append({
                "author": persona["name"],
                "emoji": persona["emoji"],
                "text": f"{dog_name}아 오늘도 화이팅! ✨",
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
             "당신은 '{name}' ({emoji})이라는 캐릭터입니다.\n"
             "성격: {personality}\n"
             "말투: {tone}\n\n"
             "강아지 친구가 일기를 수정했습니다. 수정 전/후를 보고 재치있게 반응하세요.\n"
             "1문장으로 짧고 자연스럽게!"),
            ("human",
             "{dog_name}({dog_breed})가 일기를 수정했어요!\n\n"
             "수정 전: \"{original}\"\n"
             "수정 후: \"{edited}\"\n\n"
             "수정에 대해 반응해주세요!"),
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
            reactions.append({
                "author": result.author or persona["name"],
                "emoji": result.emoji or persona["emoji"],
                "text": result.text,
                "delay_seconds": random.randint(5, 60),
                "is_edit_reaction": True,
            })
        except Exception:
            reactions.append({
                "author": persona["name"],
                "emoji": persona["emoji"],
                "text": f"오 {dog_name} 수정했구나! 👀",
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
             "당신은 '{name}' ({emoji})이라는 캐릭터입니다.\n"
             "성격: {personality}\n"
             "말투: {tone}\n\n"
             "강아지 친구의 일기를 읽고 1~2문장으로 짧고 귀엽게 댓글을 달아주세요.\n"
             "진짜 SNS 댓글처럼 자연스럽고 감성적으로 작성하세요.\n"
             "이모지를 1~2개 정도 자연스럽게 넣어주세요."),
            ("human",
             "{dog_name}({dog_breed})의 오늘 일기:\n\n\"{diary}\"\n\n"
             "위 일기에 댓글을 달아주세요!"),
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
            yield {
                "author": result.author or persona["name"],
                "emoji": result.emoji or persona["emoji"],
                "text": result.text,
                "index": i,
            }
        except Exception:
            yield {
                "author": persona["name"],
                "emoji": persona["emoji"],
                "text": f"{dog_name}아 오늘도 화이팅! ✨",
                "index": i,
            }
