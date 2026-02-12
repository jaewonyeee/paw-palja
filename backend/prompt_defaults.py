"""
Prompt configuration defaults and cache system.
Provides default values for all configurable prompts/temperatures,
with in-memory caching of DB overrides.
"""
from typing import Optional
import logging

logger = logging.getLogger("pawpalja.prompt_defaults")

PROMPT_DEFAULTS = {
    "agent.oracle.temperature": {"value": "0.8", "type": "float", "description": "Oracle agent (horoscope) LLM temperature"},
    "agent.journalist.temperature": {"value": "0.9", "type": "float", "description": "Journalist agent (diary) LLM temperature"},
    "agent.vet.temperature": {"value": "0.3", "type": "float", "description": "Vet agent (health) LLM temperature"},
    "comment.temperature": {"value": "0.95", "type": "float", "description": "Comment generation LLM temperature"},
    "comment.edit_reaction.temperature": {"value": "0.9", "type": "float", "description": "Edit reaction comment LLM temperature"},
    "persona.뽀삐언니.personality": {"value": "동네 인기견. 항상 밝고 텐션 높음. 사투리 섞어 씀.", "type": "text", "description": "뽀삐언니 personality"},
    "persona.뽀삐언니.tone": {"value": "언니/오빠 느낌, 텐션 높은 칭찬, '대박!', '완전!', '진짜?!'", "type": "text", "description": "뽀삐언니 tone"},
    "persona.츄르대장.personality": {"value": "고양이인데 강아지 동네에 살고 있음. 시크하지만 은근 관심 많음.", "type": "text", "description": "츄르대장 personality"},
    "persona.츄르대장.tone": {"value": "시크하고 도도한 말투. '뭐... 괜찮네', '나라면 안 했겠지만'", "type": "text", "description": "츄르대장 tone"},
    "persona.할배멍.personality": {"value": "동네 최고 원로견. 인생 선배 느낌. 따뜻한 한마디.", "type": "text", "description": "할배멍 personality"},
    "persona.할배멍.tone": {"value": "어르신 말투, '그래 잘했구나', '옛날 생각이 나는구만'", "type": "text", "description": "할배멍 tone"},
    "persona.멍스타그램.personality": {"value": "인플루언서 강아지. SNS에 진심. 해시태그 중독.", "type": "text", "description": "멍스타그램 personality"},
    "persona.멍스타그램.tone": {"value": "SNS 인플루언서 말투, '#오늘도산책', '#멍멍스타그램', 이모지 가득", "type": "text", "description": "멍스타그램 tone"},
    "persona.Dr.왕왕.personality": {"value": "수의학 지식이 풍부한 강아지. 건강 관련 한마디를 꼭 던짐.", "type": "text", "description": "Dr.왕왕 personality"},
    "persona.Dr.왕왕.tone": {"value": "전문적이지만 친근, '건강 팁 하나!', '이건 꼭 챙겨!'", "type": "text", "description": "Dr.왕왕 tone"},
}

# In-memory cache: config_key -> config_value
_cache: dict[str, str] = {}
_cache_loaded: bool = False


def get_cached_prompt_value(config_key: str, default: str) -> str:
    """Get prompt config value. Returns DB override if cached, else default."""
    if config_key in _cache:
        return _cache[config_key]
    # Fall back to PROMPT_DEFAULTS then to provided default
    if config_key in PROMPT_DEFAULTS:
        return PROMPT_DEFAULTS[config_key]["value"]
    return default


async def refresh_prompt_cache(db) -> None:
    """Load all PromptConfig rows from DB into in-memory cache."""
    global _cache, _cache_loaded
    try:
        from sqlalchemy import select
        from backend.models import PromptConfig
        result = await db.execute(select(PromptConfig))
        rows = result.scalars().all()
        _cache = {row.config_key: row.config_value for row in rows}
        _cache_loaded = True
        logger.info(f"Prompt cache refreshed: {len(_cache)} overrides loaded")
    except Exception as e:
        logger.warning(f"Failed to refresh prompt cache: {e}")


def invalidate_cache() -> None:
    """Clear the in-memory cache."""
    global _cache, _cache_loaded
    _cache = {}
    _cache_loaded = False
