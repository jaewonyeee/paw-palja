"""
Paw-Palja LangGraph Multi-Agent System
- Oracle (운세): Tool Calling (날씨, 트렌드, 견종정보) — MCP Registry + bind_tools
- Journalist (일기): Few-Shot + RAG 밈
- Vet (건강): CoT 추론 + RAG 견종 건강 + 의료 고지
- A2A: Agent 간 메모 교환
- Memory: MemorySaver Checkpointer
- Conditional Edge: 위험도에 따른 분기 (alert_handler)
- Retry/Fallback: 파싱 실패 시 재시도 + 폴백 응답
"""
import os
import json
import hashlib
import logging
import time
from typing import TypedDict, Annotated, Sequence
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, ToolMessage
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.memory import MemorySaver
from dotenv import load_dotenv

from backend.llm_provider import get_llm
from backend.schemas import (
    HoroscopeResult, DiaryResult, HealthAnalysis,
    SourceItem, EMERGENCY_GUIDANCE,
)
from backend.tools import oracle_tools, get_weather, search_trends, lookup_breed_info
from backend.a2a_protocol import create_memo, filter_memos_for

# MCP 통합
from backend.mcp.bootstrap import initialize_mcp
from backend.mcp.registry import get_registry

# Prompt Engineering
from backend.prompt_engineering import get_oracle_few_shot_prompt

load_dotenv()

logger = logging.getLogger("pawpalja.agents")

# MCP 레지스트리 초기화
_mcp_registry = get_registry()


# --- LLM Retry/Fallback Wrapper ---
def _invoke_with_retry(chain, params: dict, max_retries: int = 2, base_temp: float = 0.0):
    """Structured Output 호출 시 재시도 + 폴백 전략.

    1차 시도 실패 시 temperature를 0.1 낮추고 재시도합니다.
    모든 시도 실패 시 예외를 상위로 전파합니다.
    """
    last_error = None
    for attempt in range(max_retries + 1):
        try:
            start = time.perf_counter()
            result = chain.invoke(params)
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            logger.info(
                "LLM invoke success",
                extra={
                    "agent_name": params.get("_agent_name", "unknown"),
                    "duration_ms": duration_ms,
                    "attempt": attempt + 1,
                },
            )
            return result
        except Exception as e:
            last_error = e
            logger.warning(
                "LLM invoke failed (attempt %d/%d): %s",
                attempt + 1, max_retries + 1, str(e)[:200],
                extra={"agent_name": params.get("_agent_name", "unknown")},
            )
            if attempt < max_retries:
                # 재시도 시 temperature 낮춤
                new_temp = max(0.0, base_temp - 0.1 * (attempt + 1))
                llm = get_llm(temperature=new_temp)
                # chain의 LLM만 교체 (프롬프트는 유지)
                if hasattr(chain, 'first') and hasattr(chain, 'last'):
                    chain = chain.first | llm.with_structured_output(type(result) if 'result' in dir() else chain.last)
    raise last_error


# --- Horoscope Cache Helpers ---
def _horoscope_cache_key(breed: str, mbti: str) -> str:
    """Generate a daily cache key for the horoscope agent.

    Same breed + MBTI on the same day produces the same key,
    so the LLM call can be skipped if a cached result exists.
    """
    from datetime import date
    raw = f"horoscope:{breed}:{mbti}:{date.today().isoformat()}"
    return f"llm:oracle:{hashlib.sha256(raw.encode()).hexdigest()[:16]}"


async def _get_cached_horoscope(key: str) -> dict | None:
    """Try to fetch a cached horoscope result from Redis."""
    try:
        from backend.cache import cache_get
        return await cache_get(key)
    except Exception:
        return None


async def _set_cached_horoscope(key: str, data: dict) -> None:
    """Cache a horoscope result for 1 hour."""
    try:
        from backend.cache import cache_set
        await cache_set(key, data, ttl=3600)
    except Exception:
        pass


def _try_horoscope_cache(breed: str, mbti: str) -> dict | None:
    """Synchronous wrapper — safe to call from inside a LangGraph node.

    Returns cached dict or None.  Falls back gracefully if Redis
    is unavailable or the cache module hasn't been initialised.
    """
    import asyncio
    key = _horoscope_cache_key(breed, mbti)
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                result = pool.submit(asyncio.run, _get_cached_horoscope(key)).result()
            return result
        return asyncio.run(_get_cached_horoscope(key))
    except Exception:
        return None


def _store_horoscope_cache(breed: str, mbti: str, data: dict) -> None:
    """Synchronous wrapper — stores horoscope result in cache."""
    import asyncio
    key = _horoscope_cache_key(breed, mbti)
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                pool.submit(asyncio.run, _set_cached_horoscope(key, data)).result()
        else:
            asyncio.run(_set_cached_horoscope(key, data))
    except Exception:
        pass


# --- Agent State (A2A 확장 + 페르소나 + 다국어) ---
class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    dog_profile: dict  # 'persona_type', 'language' 추가
    daily_logs: dict
    agent_memos: list[dict]
    horoscope: dict | None
    diary: dict | None
    health: dict | None


# --- Oracle Agent (Tool Calling + A2A + MCP + Cache + bind_tools) ---
def oracle_agent(state: AgentState):
    from backend.prompt_defaults import get_cached_prompt_value
    temp = float(get_cached_prompt_value("agent.oracle.temperature", "0.8"))
    llm = get_llm(temperature=temp)
    profile = state["dog_profile"]
    logs = state["daily_logs"]

    # Check horoscope cache (same breed + MBTI + date = cacheable)
    breed = profile.get("breed", "믹스견")
    mbti = profile.get("mbti", "ENFP")
    cached = _try_horoscope_cache(breed, mbti)
    if cached:
        logger.info("Oracle cache HIT for breed=%s mbti=%s", breed, mbti)
        memos = state.get("agent_memos", [])
        memos.append(create_memo(
            sender="oracle",
            receiver="all",
            memo_type="context",
            content=f"운세 키워드: {cached.get('summary_ko', '')} (cached)",
        ))
        return {"horoscope": cached, "agent_memos": memos}

    # MCP Tool Calling으로 실시간 데이터 수집
    from datetime import datetime as _dt

    # MCP 레지스트리를 통한 도구 실행 (각 도구의 의사결정은 Agent가 수행)
    tool_start = time.perf_counter()
    weather_data = _mcp_registry.execute("get_weather", city="Seoul")
    logger.info("Tool get_weather completed", extra={
        "tool_name": "get_weather", "duration_ms": round((time.perf_counter() - tool_start) * 1000, 2),
    })

    tool_start = time.perf_counter()
    trend_data = _mcp_registry.execute(
        "search_trends",
        query=f"강아지 트렌드 {profile.get('breed', '')} {_dt.now().year}",
        max_results=3
    )
    logger.info("Tool search_trends completed", extra={
        "tool_name": "search_trends", "duration_ms": round((time.perf_counter() - tool_start) * 1000, 2),
    })

    tool_start = time.perf_counter()
    breed_rag = _mcp_registry.execute("lookup_breed_info", breed=profile.get("breed", "믹스견"), k=3)
    logger.info("Tool lookup_breed_info completed", extra={
        "tool_name": "lookup_breed_info", "duration_ms": round((time.perf_counter() - tool_start) * 1000, 2),
        "rag_hit": bool(breed_rag and "찾지 못했습니다" not in str(breed_rag)),
    })

    weather_str = f"{weather_data.get('weather', '정보 없음')}, {weather_data.get('temp', '?')}°C, 습도 {weather_data.get('humidity', '?')}%"

    # 언어 설정 및 Few-Shot 예시 가져오기 (양쪽 언어 모두)
    language = profile.get("language", "ko")
    few_shot_ko = get_oracle_few_shot_prompt("ko")
    few_shot_en = get_oracle_few_shot_prompt("en")

    # 듀얼 언어 생성: 한국어와 영어를 동시에 생성
    system_prompt = f"""You are 'Oracle', a bilingual mystical dog fortune teller.
You MUST generate horoscope content in BOTH Korean and English simultaneously.

⚠️ CRITICAL: Fill ALL fields ending with _ko (Korean) AND _en (English) in the output schema.
- summary_ko + summary_en
- content_ko + content_en
- lucky_item_ko + lucky_item_en
- interaction_hint_ko + interaction_hint_en
- weather_context_ko + weather_context_en
- trend_reference_ko + trend_reference_en

Use trendy Gen-Z vibes and reflect real weather and trends in both languages.

=== Few-Shot Examples (Korean) ===
{few_shot_ko}

=== Few-Shot Examples (English) ===
{few_shot_en}

=== Today's Data ===
Breed Info (RAG):
{{breed_info}}

Today's Weather:
{{weather}}

Latest Trends:
{{trends}}

🎯 TASK: Generate horoscope content in BOTH languages with culturally appropriate expressions."""

    human_prompt = """Dog Profile: Name={name}, Breed={breed}, MBTI={mbti}
Today's Mood: {mood}, Walk: {walk} minutes

Based on the above, generate today's fortune in BOTH Korean and English!"""

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", human_prompt),
    ])

    # LLM에 도구 바인딩 (bind_tools) — LLM이 도구 목록을 인식
    llm_with_tools = llm.bind_tools(oracle_tools)
    chain = prompt | llm.with_structured_output(HoroscopeResult)
    result = _invoke_with_retry(chain, {
        "breed_info": breed_rag,
        "weather": weather_str,
        "trends": trend_data,
        "name": profile.get("name", "멍멍이"),
        "breed": profile.get("breed", "믹스견"),
        "mbti": profile.get("mbti", "ENFP"),
        "mood": logs.get("mood", "평범"),
        "walk": logs.get("walk", "0"),
        "_agent_name": "oracle",
    }, base_temp=temp)

    result_dict = result.model_dump()

    # Cache the horoscope result (1 hour TTL)
    _store_horoscope_cache(breed, mbti, result_dict)
    logger.info("Oracle cache MISS — stored for breed=%s mbti=%s", breed, mbti)

    # A2A: 다른 Agent에게 컨텍스트 전달
    memos = state.get("agent_memos", [])
    memos.append(create_memo(
        sender="oracle",
        receiver="all",
        memo_type="context",
        content=f"오늘 날씨: {weather_str}. 운세 키워드: {result.summary_ko}. 트렌드: {str(trend_data)[:100]}",
    ))

    return {"horoscope": result_dict, "agent_memos": memos}


# --- Journalist Agent (Few-Shot + RAG + A2A + 페르소나 + 다국어) ---
def journalist_agent(state: AgentState):
    from backend.prompt_defaults import get_cached_prompt_value
    temp = float(get_cached_prompt_value("agent.journalist.temperature", "0.9"))
    llm = get_llm(temperature=temp)
    profile = state["dog_profile"]
    logs = state["daily_logs"]

    # 언어 설정 (양쪽 언어 페르소나 준비)
    language = profile.get("language", "ko")

    # 🎭 향상된 페르소나 시스템: 상황별 자동 믹싱 (양쪽 언어)
    use_auto_mixing = profile.get("auto_persona_mixing", True)  # 기본값: 자동 믹싱 활성화

    if use_auto_mixing:
        # 상황 분석하여 최적의 페르소나 조합 추천 (한국어/영어)
        from backend.enhanced_persona_system import get_recommended_personas
        persona_recommendation_ko = get_recommended_personas(
            mood=logs.get("mood", "평범"),
            activity=f"{logs.get('walk', '0')}분 산책, {logs.get('food', '보통')} 식사",
            notes=logs.get("notes", ""),
            language="ko"
        )
        persona_recommendation_en = get_recommended_personas(
            mood=logs.get("mood", "평범"),
            activity=f"{logs.get('walk', '0')}분 산책, {logs.get('food', '보통')} 식사",
            notes=logs.get("notes", ""),
            language="en"
        )
        persona_profile_ko = persona_recommendation_ko["mixed_profile"]
        persona_profile_en = persona_recommendation_en["mixed_profile"]
        persona_type = f"{persona_recommendation_ko['primary']}"
        if persona_recommendation_ko.get("secondary"):
            persona_type += f" × {persona_recommendation_ko['secondary']}"
        persona_examples_ko = persona_profile_ko.get("examples", [])
        persona_examples_en = persona_profile_en.get("examples", [])
    else:
        # 수동 선택 모드: 사용자가 지정한 페르소나 사용 (양쪽 언어)
        persona_type = profile.get("persona_type", "사고뭉치")
        from backend.enhanced_persona_system import get_persona_profile
        persona_profile_ko = get_persona_profile(persona_type, "ko")
        persona_profile_en = get_persona_profile(persona_type, "en")
        persona_examples_ko = persona_profile_ko.get("examples", [])
        persona_examples_en = persona_profile_en.get("examples", [])

    # A2A: Oracle의 메모 읽기
    my_memos = filter_memos_for("journalist", state.get("agent_memos", []))
    oracle_context = ""
    if my_memos:
        oracle_context = "\n".join([f"[{m['sender']}]: {m['content']}" for m in my_memos])

    # RAG: 밈 데이터 + 페르소나 데이터 검색
    meme_context = ""
    persona_context = ""
    try:
        from backend.rag_pipeline import query_rag_with_filter
        # 밈/SNS 데이터 (더 다양하게 수집)
        rag_start = time.perf_counter()
        meme_results = query_rag_with_filter(f"{logs.get('mood', '평범')} 강아지", source_filter="memes", k=2)
        sns_results = query_rag_with_filter(f"강아지 {logs.get('mood', '')}", source_filter="sns", k=3)
        all_meme_results = meme_results + sns_results
        logger.info("Journalist RAG search completed", extra={
            "agent_name": "journalist",
            "rag_hit": bool(all_meme_results),
            "rag_source_count": len(all_meme_results),
            "duration_ms": round((time.perf_counter() - rag_start) * 1000, 2),
        })
        if all_meme_results:
            meme_context = "\n".join([doc.page_content for doc in all_meme_results])

        # 페르소나 데이터
        primary_persona = persona_recommendation_ko["primary"] if use_auto_mixing else persona_type
        persona_results = query_rag_with_filter(primary_persona, source_filter="personas", k=1)
        if persona_results:
            persona_context = persona_results[0].page_content
    except Exception as e:
        meme_context = "밈 데이터 없음"
        persona_context = "페르소나 데이터 없음"

    # Few-Shot 예시 (양쪽 언어 모두 준비)
    few_shot_ko = f"""
[예시 1 - 기분: 신남]
제목: 오늘은 내가 세상의 주인공이다!
내용: "산책길에 비둘기를 세 마리나 쫓았다. 나는야 동네 최강 사냥꾼! 집사가 '안돼!'라고 했지만 내 귀에는 '파이팅!'으로 들렸거든."

[예시 2 - 기분: 우울]
제목: 집사의 배신... 그리고 빈 간식통
내용: "집사가 나한테 당근을 줬다. 당근을요. 내가 토끼로 보여? 간식통은 텅 비었고 내 마음도 텅 비었다. 오늘은 이불 속에서 세상을 원망하련다."

[페르소나 스타일 - {persona_type}]
{persona_examples_ko[0] if persona_examples_ko else 'N/A'}
"""

    few_shot_en = f"""
[Example 1 - Mood: Happy]
Title: Today I'm The Main Character!
Content: "Chased THREE pigeons on the walk. I'm basically the neighborhood apex predator! Human yelled 'NO!' but I heard 'GO!' lol"

[Example 2 - Mood: Sad]
Title: Betrayed... And The Empty Treat Jar
Content: "Human gave me a CARROT. A carrot. Do I look like a rabbit? The treat jar is empty and so is my soul. Today I shall sulk under the blanket."

[Persona Style - {persona_type}]
{persona_examples_en[0] if persona_examples_en else 'N/A'}
"""

    # 시스템 프롬프트 (듀얼 언어 생성)
    tone_desc_ko = persona_profile_ko.get('archetype', persona_profile_ko.get('tone', '장난스러운'))
    traits_ko = ", ".join(persona_profile_ko.get('traits', ['에너지 넘침']))
    patterns_ko = ", ".join(persona_profile_ko.get('speech_patterns', ['!']))

    tone_desc_en = persona_profile_en.get('archetype', persona_profile_en.get('tone', 'Playful'))
    traits_en = ", ".join(persona_profile_en.get('traits', ['energetic']))
    patterns_en = ", ".join(persona_profile_en.get('speech_patterns', ['!']))

    system_prompt = f"""You are 'Journalist', a bilingual first-person dog narrator.
You MUST generate diary content in BOTH Korean and English simultaneously.

⚠️ CRITICAL: Fill ALL fields ending with _ko (Korean) AND _en (English) in the output schema.
- title_ko + title_en
- content_ko + content_en
- meme_reference_ko + meme_reference_en

Use internet meme language and Gen-Z vibes. MUST be in first-person dog perspective.
Adapt cultural nuances appropriately for each language.

🎭 PERSONA: {persona_type}

KOREAN VERSION:
- Archetype: {tone_desc_ko}
- Traits: {traits_ko}
- Speech Patterns: {patterns_ko}
- Style: 강아지 1인칭 + MZ 밈 말투

ENGLISH VERSION:
- Archetype: {tone_desc_en}
- Traits: {traits_en}
- Speech Patterns: {patterns_en}
- Style: Dog's 1st-person POV + Gen-Z meme slang

=== Korean Style Examples (Few-Shot) ===
{few_shot_ko}

=== English Style Examples (Few-Shot) ===
{few_shot_en}

=== Reference Meme Data (RAG) ===
{meme_context}

=== Persona Context (RAG) ===
{persona_context}

=== Other Agent Memos (A2A) ===
{oracle_context}

🎯 TASK: Write diary entries in BOTH languages with culturally appropriate meme references."""

    human_prompt = """Dog Name: {name}, Breed: {breed}
Today's Activities: Mood={mood}, Food={food}, Walk={walk}min, Poop={poop}
Additional Notes: {notes}

Generate diary content in BOTH Korean and English!"""

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", human_prompt),
    ])

    chain = prompt | llm.with_structured_output(DiaryResult)
    result = _invoke_with_retry(chain, {
        "meme_context": meme_context,
        "oracle_context": oracle_context or "없음",
        "name": profile.get("name", "멍멍이"),
        "breed": profile.get("breed", "믹스견"),
        "mood": logs.get("mood", "평범"),
        "food": logs.get("food", "보통"),
        "walk": logs.get("walk", "0"),
        "poop": logs.get("poop", "정상"),
        "notes": logs.get("notes", ""),
        "_agent_name": "journalist",
    }, base_temp=temp)

    # A2A: Vet에게 감정 상태 전달
    memos = state.get("agent_memos", [])
    memos.append(create_memo(
        sender="journalist",
        receiver="vet",
        memo_type="insight",
        content=f"강아지 기분: {logs.get('mood', '평범')}. 일기 무드: {result.mood_icon}",
    ))

    return {"diary": result.model_dump(), "agent_memos": memos}


# --- Vet Agent (CoT + RAG + A2A + 의료 고지 + 요약된 근거) ---
def vet_agent(state: AgentState):
    from backend.prompt_defaults import get_cached_prompt_value
    temp = float(get_cached_prompt_value("agent.vet.temperature", "0.3"))
    llm = get_llm(temperature=temp)
    profile = state["dog_profile"]
    logs = state["daily_logs"]

    # A2A: 다른 Agent 메모 읽기
    my_memos = filter_memos_for("vet", state.get("agent_memos", []))
    a2a_context = ""
    if my_memos:
        a2a_context = "\n".join([f"[{m['sender']}]: {m['content']}" for m in my_memos])

    # RAG: 견종 건강 정보 + 질병 QA + KISTI 질병 데이터 검색
    breed_health_context = ""
    disease_qa_context = ""
    kisti_disease_context = ""
    rag_sources: list[SourceItem] = []
    try:
        from backend.rag_pipeline import query_rag_with_filter, query_rag

        rag_start = time.perf_counter()

        # 1. 견종별 건강 정보
        breed_results = query_rag_with_filter(
            f"{profile.get('breed', '믹스견')} 건강 주의 질환",
            source_filter="breeds", k=2
        )
        if breed_results:
            breed_health_context = "\n".join([doc.page_content for doc in breed_results])
            for doc in breed_results:
                rag_sources.append(SourceItem(
                    title=f"{doc.metadata.get('breed', '알 수 없음')} 건강 정보",
                    snippet=doc.page_content[:200],
                    source_type="breeds",
                    metadata=doc.metadata,
                ))

        # 2. 질병 QA 데이터 (증상 기반 검색)
        symptoms_query = f"{logs.get('mood', '평범')} {logs.get('poop', '정상')} {logs.get('notes', '')}"
        disease_qa_results = query_rag_with_filter(symptoms_query, source_filter="disease_qa", k=2)
        if disease_qa_results:
            disease_qa_context = "\n".join([doc.page_content[:300] for doc in disease_qa_results])
            for doc in disease_qa_results:
                rag_sources.append(SourceItem(
                    title=f"질병 QA: {doc.metadata.get('disease', '알 수 없음')}",
                    snippet=doc.page_content[:200],
                    source_type="disease_qa",
                    metadata=doc.metadata,
                ))

        # 3. KISTI 질병 분류 데이터
        if logs.get('notes'):  # 메모에 증상이 있을 경우
            kisti_results = query_rag_with_filter(logs.get('notes', ''), source_filter="kisti_disease", k=2)
            if kisti_results:
                kisti_disease_context = "\n".join([doc.page_content for doc in kisti_results])
                for doc in kisti_results:
                    rag_sources.append(SourceItem(
                        title=f"KISTI: {doc.metadata.get('category', '알 수 없음')}",
                        snippet=doc.page_content[:200],
                        source_type="kisti_disease",
                        metadata=doc.metadata,
                    ))

        logger.info("Vet RAG search completed", extra={
            "agent_name": "vet",
            "rag_hit": bool(breed_results or disease_qa_results),
            "rag_source_count": len(rag_sources),
            "duration_ms": round((time.perf_counter() - rag_start) * 1000, 2),
        })

    except Exception as e:
        breed_health_context = "견종 건강 데이터 없음"
        disease_qa_context = "질병 QA 데이터 없음"
        kisti_disease_context = "KISTI 질병 데이터 없음"

    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "You are 'Vet', a bilingual analytical veterinarian.\n"
         "You MUST generate health analysis in BOTH Korean and English simultaneously.\n\n"
         "⚠️ IMPORTANT: This analysis is for REFERENCE ONLY and does NOT replace professional veterinary advice.\n"
         "Always include this disclaimer in your output.\n\n"
         "⚠️ CRITICAL: Fill ALL fields ending with _ko (Korean) AND _en (English) in the output schema.\n"
         "- symptom_analysis_ko + symptom_analysis_en\n"
         "- duration_context_ko + duration_context_en\n"
         "- breed_context_ko + breed_context_en\n"
         "- conclusion_ko + conclusion_en\n"
         "- advice_ko + advice_en\n\n"
         "⚠️ OUTPUT GUIDELINE: Each CoT step should contain ONLY a summarized user-facing rationale (1-2 sentences).\n"
         "Do NOT expose verbose internal reasoning. Keep it concise and understandable for pet guardians.\n\n"
         "Analyze dog health records through the 4-step Chain-of-Thought (CoT) process:\n\n"
         "Step 1 - Symptom Analysis: Summarize key symptoms in 1-2 sentences for the guardian\n"
         "Step 2 - Duration Context: Briefly note observation period and patterns\n"
         "Step 3 - Breed Context: Mention relevant breed-specific traits concisely\n"
         "Step 4 - Final Conclusion: State risk level with clear, actionable rationale\n\n"
         "=== Breed Health Data (RAG) ===\n{breed_health}\n"
         "=== Disease Q&A Data (RAG) ===\n{disease_qa}\n"
         "=== KISTI Disease Classification (RAG) ===\n{kisti_disease}\n"
         "=== Other Agent Memos (A2A) ===\n{a2a_context}\n\n"
         "🎯 TASK: Generate concise 4-step CoT analysis in BOTH Korean and English. "
         "Each step must be a brief, guardian-friendly summary (not verbose reasoning)."),
        ("human",
         "Breed: {breed}, Name: {name}\n"
         "Today's Record: Mood={mood}, Food={food}, Walk={walk}min, Poop={poop}\n"
         "Additional Notes: {notes}\n\n"
         "Analyze with 4-step CoT in BOTH Korean and English!"),
    ])

    chain = prompt | llm.with_structured_output(HealthAnalysis)
    result = _invoke_with_retry(chain, {
        "breed_health": breed_health_context or "데이터 없음",
        "disease_qa": disease_qa_context or "데이터 없음",
        "kisti_disease": kisti_disease_context or "데이터 없음",
        "a2a_context": a2a_context or "없음",
        "breed": profile.get("breed", "믹스견"),
        "name": profile.get("name", "멍멍이"),
        "mood": logs.get("mood", "평범"),
        "food": logs.get("food", "보통"),
        "walk": logs.get("walk", "0"),
        "poop": logs.get("poop", "정상"),
        "notes": logs.get("notes", ""),
        "_agent_name": "vet",
    }, base_temp=temp)

    result_dict = result.model_dump()
    result_dict["rag_sources"] = [s.model_dump() for s in rag_sources]

    # 위험도별 긴급 안내 자동 추가
    risk = result.risk_level.value
    guidance = EMERGENCY_GUIDANCE.get(risk, EMERGENCY_GUIDANCE["Low"])
    result_dict["emergency_guidance_ko"] = guidance["ko"]
    result_dict["emergency_guidance_en"] = guidance["en"]

    # A2A: 위험도 높으면 경고 메모
    memos = state.get("agent_memos", [])
    if result.risk_level.value in ("High", "Critical"):
        memos.append(create_memo(
            sender="vet",
            receiver="oracle",
            memo_type="alert",
            content=f"건강 위험 감지! 위험도: {result.risk_level.value}. {result.conclusion_ko}",
            priority="high",
        ))

    return {"health": result_dict, "agent_memos": memos}


# --- Alert Handler (위험도 High/Critical 시 긴급 안내 추가) ---
def alert_handler(state: AgentState):
    """Conditional edge target: 위험도가 High 이상일 때 추가 안내를 삽입합니다."""
    health = state.get("health", {})
    risk = health.get("risk_level", "Low")

    guidance = EMERGENCY_GUIDANCE.get(risk, EMERGENCY_GUIDANCE["Low"])
    health["emergency_guidance_ko"] = guidance["ko"]
    health["emergency_guidance_en"] = guidance["en"]

    logger.warning(
        "Alert handler triggered: risk_level=%s", risk,
        extra={"agent_name": "alert_handler", "risk_level": risk},
    )

    return {"health": health}


# --- Conditional Edge: Vet → alert_handler or END ---
def route_after_vet(state: AgentState) -> str:
    """Vet 분석 후 위험도에 따라 분기합니다."""
    health = state.get("health", {})
    risk = health.get("risk_level", "Low")
    if risk in ("High", "Critical"):
        return "alert_handler"
    return END


# --- Graph Orchestration ---
def build_agent_graph():
    """LangGraph StateGraph를 구축합니다 (Memory + Conditional Edge 포함)."""
    workflow = StateGraph(AgentState)

    workflow.add_node("oracle", oracle_agent)
    workflow.add_node("journalist", journalist_agent)
    workflow.add_node("vet", vet_agent)
    workflow.add_node("alert_handler", alert_handler)

    workflow.set_entry_point("oracle")
    workflow.add_edge("oracle", "journalist")
    workflow.add_edge("journalist", "vet")

    # Conditional edge: Vet → alert_handler (High/Critical) or END (Low/Medium)
    workflow.add_conditional_edges("vet", route_after_vet, {
        "alert_handler": "alert_handler",
        END: END,
    })
    workflow.add_edge("alert_handler", END)

    memory = MemorySaver()
    return workflow.compile(checkpointer=memory)


if __name__ == "__main__":
    graph = build_agent_graph()
    test_state = {
        "dog_profile": {"name": "초코", "breed": "푸들", "mbti": "ENFP"},
        "daily_logs": {"mood": "신남", "food": "완식", "walk": "30", "poop": "정상", "notes": ""},
        "messages": [HumanMessage(content="우리 초코 오늘 어때?")],
        "agent_memos": [],
    }
    config = {"configurable": {"thread_id": "test-session-1"}}
    try:
        output = graph.invoke(test_state, config=config)
        print("=== Oracle ===")
        print(json.dumps(output["horoscope"], ensure_ascii=False, indent=2))
        print("\n=== Journalist ===")
        print(json.dumps(output["diary"], ensure_ascii=False, indent=2))
        print("\n=== Vet ===")
        print(json.dumps(output["health"], ensure_ascii=False, indent=2))
        print("\n=== A2A Memos ===")
        for m in output.get("agent_memos", []):
            print(f"  [{m['sender']}→{m['receiver']}] {m['content'][:80]}")
    except Exception as e:
        print(f"Agent 실행 오류: {e}")
        import traceback
        traceback.print_exc()
