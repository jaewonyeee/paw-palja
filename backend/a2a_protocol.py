"""
A2A (Agent-to-Agent) 협업 프로토콜
Agent 간 메모(Memo) 교환을 통한 컨텍스트 공유 및 협업 구조를 정의합니다.
"""
from pydantic import BaseModel, Field
from typing import Literal
from datetime import datetime


class AgentMemo(BaseModel):
    """Agent 간 전달되는 메모 메시지"""
    sender: Literal["oracle", "journalist", "vet"]
    receiver: Literal["oracle", "journalist", "vet", "all"]
    memo_type: Literal["context", "alert", "insight"]
    content: str
    priority: Literal["low", "medium", "high"] = "medium"
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())


class AgentCard(BaseModel):
    """각 Agent의 능력 카드 (A2A 식별용)"""
    agent_id: str
    name: str
    description: str
    capabilities: list[str]


# --- Agent Cards (정적 정의) ---
ORACLE_CARD = AgentCard(
    agent_id="oracle",
    name="Oracle (점술가)",
    description="날씨와 트렌드를 기반으로 반려견 운세를 생성합니다.",
    capabilities=["weather_lookup", "trend_search", "horoscope_generation"],
)

JOURNALIST_CARD = AgentCard(
    agent_id="journalist",
    name="Journalist (기자견)",
    description="1인칭 강아지 시점으로 감성적인 일기를 작성합니다.",
    capabilities=["diary_writing", "meme_integration", "mood_expression"],
)

VET_CARD = AgentCard(
    agent_id="vet",
    name="Vet (수의사)",
    description="건강 기록을 분석하고 CoT 기반으로 위험도를 평가합니다.",
    capabilities=["health_analysis", "breed_risk_assessment", "cot_reasoning"],
)


def create_memo(sender: str, receiver: str, memo_type: str, content: str, priority: str = "medium") -> dict:
    """Agent 메모를 생성합니다."""
    memo = AgentMemo(
        sender=sender,
        receiver=receiver,
        memo_type=memo_type,
        content=content,
        priority=priority,
    )
    return memo.model_dump()


def filter_memos_for(agent_id: str, memos: list[dict]) -> list[dict]:
    """특정 Agent에게 전달된 메모만 필터링합니다."""
    return [m for m in memos if m.get("receiver") in (agent_id, "all")]
