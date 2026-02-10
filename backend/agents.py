"""
Paw-Palja LangGraph Multi-Agent System
- Oracle (운세): Tool Calling (날씨, 트렌드, 견종정보)
- Journalist (일기): Few-Shot + RAG 밈
- Vet (건강): CoT 추론 + RAG 견종 건강
- A2A: Agent 간 메모 교환
- Memory: MemorySaver Checkpointer
"""
import os
import json
from typing import TypedDict, Annotated, Sequence
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, ToolMessage
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.memory import MemorySaver
from dotenv import load_dotenv

from backend.llm_provider import get_llm
from backend.schemas import HoroscopeResult, DiaryResult, HealthAnalysis
from backend.tools import oracle_tools, get_weather, search_trends, lookup_breed_info
from backend.a2a_protocol import create_memo, filter_memos_for

load_dotenv()


# --- Agent State (A2A 확장) ---
class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    dog_profile: dict
    daily_logs: dict
    agent_memos: list[dict]
    horoscope: dict | None
    diary: dict | None
    health: dict | None


# --- Oracle Agent (Tool Calling + A2A) ---
def oracle_agent(state: AgentState):
    llm = get_llm(temperature=0.8)
    profile = state["dog_profile"]
    logs = state["daily_logs"]

    # Tool Calling으로 실시간 데이터 수집
    weather_data = get_weather.invoke({"city": "Seoul"})
    from datetime import datetime as _dt
    trend_data = search_trends.invoke({"query": f"강아지 트렌드 {profile.get('breed', '')} {_dt.now().year}"})
    breed_rag = lookup_breed_info.invoke({"breed": profile.get("breed", "믹스견")})

    weather_str = f"{weather_data.get('weather', '정보 없음')}, {weather_data.get('temp', '?')}°C, 습도 {weather_data.get('humidity', '?')}%"

    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "당신은 신비롭지만 위트 있는 강아지 점술가 'Oracle'입니다.\n"
         "반려견의 견종 특성, 오늘의 날씨, 최신 트렌드를 결합하여 재미있고 유용한 운세를 작성하세요.\n"
         "트렌디한 MZ 감성으로, 실제 날씨와 트렌드를 반영해야 합니다.\n\n"
         "견종 정보 (RAG):\n{breed_info}\n\n"
         "오늘 날씨:\n{weather}\n\n"
         "최신 트렌드:\n{trends}"),
        ("human",
         "내 강아지 프로필: 이름={name}, 견종={breed}, MBTI={mbti}\n"
         "오늘 기분: {mood}, 산책: {walk}분\n"
         "위 정보를 바탕으로 오늘의 운세를 점쳐주세요!"),
    ])

    chain = prompt | llm.with_structured_output(HoroscopeResult)
    result = chain.invoke({
        "breed_info": breed_rag,
        "weather": weather_str,
        "trends": trend_data,
        "name": profile.get("name", "멍멍이"),
        "breed": profile.get("breed", "믹스견"),
        "mbti": profile.get("mbti", "ENFP"),
        "mood": logs.get("mood", "평범"),
        "walk": logs.get("walk", "0"),
    })

    # A2A: 다른 Agent에게 컨텍스트 전달
    memos = state.get("agent_memos", [])
    memos.append(create_memo(
        sender="oracle",
        receiver="all",
        memo_type="context",
        content=f"오늘 날씨: {weather_str}. 운세 키워드: {result.summary}. 트렌드: {trend_data[:100]}",
    ))

    return {"horoscope": result.model_dump(), "agent_memos": memos}


# --- Journalist Agent (Few-Shot + RAG + A2A) ---
def journalist_agent(state: AgentState):
    llm = get_llm(temperature=0.9)
    profile = state["dog_profile"]
    logs = state["daily_logs"]

    # A2A: Oracle의 메모 읽기
    my_memos = filter_memos_for("journalist", state.get("agent_memos", []))
    oracle_context = ""
    if my_memos:
        oracle_context = "\n".join([f"[{m['sender']}]: {m['content']}" for m in my_memos])

    # RAG: 밈 데이터 검색
    meme_context = ""
    try:
        from backend.rag_pipeline import query_rag_with_filter
        meme_results = query_rag_with_filter(f"{logs.get('mood', '평범')} 강아지", source_filter="memes", k=2)
        sns_results = query_rag_with_filter(f"강아지 {logs.get('mood', '')}", source_filter="sns", k=2)
        all_meme_results = meme_results + sns_results
        if all_meme_results:
            meme_context = "\n".join([doc.page_content for doc in all_meme_results])
    except Exception:
        meme_context = "밈 데이터 없음"

    # Few-Shot 예시
    few_shot_examples = """
[예시 1 - 기분: 신남]
제목: 오늘은 내가 세상의 주인공이다!
내용: "산책길에 비둘기를 세 마리나 쫓았다. 나는야 동네 최강 사냥꾼! 집사가 '안돼!'라고 했지만 내 귀에는 '파이팅!'으로 들렸거든."

[예시 2 - 기분: 우울]
제목: 집사의 배신... 그리고 빈 간식통
내용: "집사가 나한테 당근을 줬다. 당근을요. 내가 토끼로 보여? 간식통은 텅 비었고 내 마음도 텅 비었다. 오늘은 이불 속에서 세상을 원망하련다."

[예시 3 - 기분: 평범]
제목: 하품 세 번이면 낮잠의 신호
내용: "소파 위 햇살이 내 자리에 딱 떨어졌다. 움직이기 싫다. 집사가 뭐라 하는데 '...zzz' 이게 내 대답이다."
"""

    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "당신은 1인칭 시점의 강아지 'Journalist'입니다.\n"
         "오늘의 활동 기록을 바탕으로, 주인(집사)에게 투정부리거나 애정을 표현하는 감성적인 일기를 쓰세요.\n"
         "인터넷 밈 말투를 적극 활용하고, MZ세대 감성으로 작성하세요.\n"
         "반드시 강아지 1인칭 시점이어야 합니다.\n\n"
         "=== 말투 예시 (Few-Shot) ===\n{few_shot}\n"
         "=== 참고 밈 데이터 (RAG) ===\n{meme_context}\n"
         "=== 다른 Agent 메모 (A2A) ===\n{oracle_context}"),
        ("human",
         "강아지 이름: {name}, 견종: {breed}\n"
         "오늘 활동: 기분={mood}, 식사={food}, 산책={walk}분, 배변={poop}\n"
         "추가 메모: {notes}\n"
         "위 정보를 바탕으로 일기를 써주세요!"),
    ])

    chain = prompt | llm.with_structured_output(DiaryResult)
    result = chain.invoke({
        "few_shot": few_shot_examples,
        "meme_context": meme_context,
        "oracle_context": oracle_context or "없음",
        "name": profile.get("name", "멍멍이"),
        "breed": profile.get("breed", "믹스견"),
        "mood": logs.get("mood", "평범"),
        "food": logs.get("food", "보통"),
        "walk": logs.get("walk", "0"),
        "poop": logs.get("poop", "정상"),
        "notes": logs.get("notes", ""),
    })

    # A2A: Vet에게 감정 상태 전달
    memos = state.get("agent_memos", [])
    memos.append(create_memo(
        sender="journalist",
        receiver="vet",
        memo_type="insight",
        content=f"강아지 기분: {logs.get('mood', '평범')}. 일기 무드: {result.mood_icon}",
    ))

    return {"diary": result.model_dump(), "agent_memos": memos}


# --- Vet Agent (CoT + RAG + A2A) ---
def vet_agent(state: AgentState):
    llm = get_llm(temperature=0.3)
    profile = state["dog_profile"]
    logs = state["daily_logs"]

    # A2A: 다른 Agent 메모 읽기
    my_memos = filter_memos_for("vet", state.get("agent_memos", []))
    a2a_context = ""
    if my_memos:
        a2a_context = "\n".join([f"[{m['sender']}]: {m['content']}" for m in my_memos])

    # RAG: 견종 건강 정보 검색
    breed_health_context = ""
    rag_sources = []
    try:
        from backend.rag_pipeline import query_rag_with_filter, query_rag
        breed_results = query_rag_with_filter(
            f"{profile.get('breed', '믹스견')} 건강 주의 질환",
            source_filter="breeds", k=2
        )
        if breed_results:
            breed_health_context = "\n".join([doc.page_content for doc in breed_results])
            rag_sources = [doc.metadata.get("breed", "unknown") for doc in breed_results]
    except Exception:
        breed_health_context = "견종 건강 데이터 없음"

    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "당신은 냉철하고 분석적인 수의사 'Vet'입니다.\n"
         "반려견의 건강 기록을 보고 반드시 아래 4단계 사고 과정(CoT)을 거쳐 분석하세요:\n\n"
         "Step 1 - 증상 분석: 기록된 증상/행동을 의학적으로 분석\n"
         "Step 2 - 기간/빈도 맥락: 기록 빈도와 기간 고려\n"
         "Step 3 - 견종 특성: 해당 견종의 유전적/체질적 특성 반영\n"
         "Step 4 - 최종 결론: 종합 판단 및 위험도 결정\n\n"
         "=== 견종 건강 데이터 (RAG) ===\n{breed_health}\n"
         "=== 다른 Agent 메모 (A2A) ===\n{a2a_context}"),
        ("human",
         "견종: {breed}, 이름: {name}\n"
         "오늘 기록: 기분={mood}, 식사={food}, 산책={walk}분, 배변={poop}\n"
         "추가 메모: {notes}\n"
         "위 기록을 4단계 CoT로 분석해주세요."),
    ])

    chain = prompt | llm.with_structured_output(HealthAnalysis)
    result = chain.invoke({
        "breed_health": breed_health_context or "데이터 없음",
        "a2a_context": a2a_context or "없음",
        "breed": profile.get("breed", "믹스견"),
        "name": profile.get("name", "멍멍이"),
        "mood": logs.get("mood", "평범"),
        "food": logs.get("food", "보통"),
        "walk": logs.get("walk", "0"),
        "poop": logs.get("poop", "정상"),
        "notes": logs.get("notes", ""),
    })

    result_dict = result.model_dump()
    result_dict["rag_sources"] = rag_sources

    # A2A: 위험도 높으면 경고 메모
    memos = state.get("agent_memos", [])
    if result.risk_level.value in ("High", "Critical"):
        memos.append(create_memo(
            sender="vet",
            receiver="oracle",
            memo_type="alert",
            content=f"건강 위험 감지! 위험도: {result.risk_level.value}. {result.conclusion}",
            priority="high",
        ))

    return {"health": result_dict, "agent_memos": memos}


# --- Graph Orchestration ---
def build_agent_graph():
    """LangGraph StateGraph를 구축합니다 (Memory 포함)."""
    workflow = StateGraph(AgentState)

    workflow.add_node("oracle", oracle_agent)
    workflow.add_node("journalist", journalist_agent)
    workflow.add_node("vet", vet_agent)

    workflow.set_entry_point("oracle")
    workflow.add_edge("oracle", "journalist")
    workflow.add_edge("journalist", "vet")
    workflow.add_edge("vet", END)

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
