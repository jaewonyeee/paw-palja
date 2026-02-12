# 아키텍처 상세

## 1. Multi-Agent 시스템 (`backend/agents.py`)

### LangGraph StateGraph 구조

Paw-Palja는 LangGraph의 `StateGraph`를 사용하여 3개의 전문 Agent를 순차적으로 실행합니다.

```
                  ┌─────────────┐
                  │   START     │
                  └──────┬──────┘
                         ▼
                  ┌─────────────┐
                  │   Oracle    │  temp=0.8
                  │  (운세 Agent)│  Tool Calling
                  └──────┬──────┘
                         │ A2A memo
                         ▼
                  ┌─────────────┐
                  │ Journalist  │  temp=0.9
                  │ (일기 Agent) │  Few-Shot + RAG
                  └──────┬──────┘
                         │ A2A memo
                         ▼
                  ┌─────────────┐
                  │    Vet      │  temp=0.3
                  │ (건강 Agent) │  CoT + RAG
                  └──────┬──────┘
                         │
                         ▼
                  ┌─────────────┐
                  │    END      │
                  └─────────────┘
```

### Agent 상세

| Agent | 역할 | Temperature | 기법 | 출력 스키마 |
|---|---|---|---|---|
| **Oracle** | 오늘의 운세 생성 | 0.8 | Tool Calling (날씨, 트렌드, 견종 정보) | `HoroscopeResult` |
| **Journalist** | 1인칭 강아지 시점 일기 | 0.9 | Few-Shot + RAG (밈/SNS 트렌드) | `DiaryResult` |
| **Vet** | 건강 리스크 분석 | 0.3 | Chain-of-Thought 4단계 추론 + RAG | `HealthAnalysis` |

### State 관리

```python
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    breed: str
    mbti: str
    mood: str
    health_notes: str
    horoscope: dict
    diary: dict
    health: dict
    memos: list       # A2A 메모 리스트
    context: dict     # MCP 컨텍스트
```

- `MemorySaver` Checkpointer를 사용하여 Agent 실행 간 상태를 유지합니다.
- 각 Agent는 실행 후 결과를 State에 저장하고, 다음 Agent가 참조합니다.

---

## 2. A2A (Agent-to-Agent) 프로토콜 (`backend/a2a_protocol.py`)

### 개요

Agent 간에 구조화된 메모(Memo)를 교환하여 컨텍스트를 공유합니다.

### 데이터 모델

```python
class AgentMemo(BaseModel):
    sender: Literal["oracle", "journalist", "vet"]
    receiver: Literal["oracle", "journalist", "vet", "all"]
    memo_type: Literal["context", "alert", "insight"]
    content: str
    priority: Literal["low", "medium", "high"]
    timestamp: str
```

### Agent Card (A2A 식별)

각 Agent는 자신의 능력을 `AgentCard`로 선언합니다:

```python
class AgentCard(BaseModel):
    agent_id: str       # "oracle", "journalist", "vet"
    name: str           # 사람이 읽을 수 있는 이름
    description: str    # Agent 역할 설명
    capabilities: list  # 제공하는 기능 목록
```

### 메모 흐름

1. **Oracle → Journalist**: 날씨/트렌드 정보를 `context` 메모로 전달
2. **Oracle → Vet**: 운세 결과를 `insight` 메모로 전달
3. **Journalist → Vet**: 일기 내용에서 발견된 건강 관련 키워드를 `alert` 메모로 전달

---

## 3. MCP (Model Context Protocol) (`backend/mcp/`)

### 구조

```
mcp/
├── bootstrap.py    # 도구 자동 등록 및 초기화
├── registry.py     # Tool Registry (등록, 실행, 메타데이터)
├── server.py       # MCP 서버 (초기화, 도구 목록, 도구 호출, 통계)
└── tools/
    ├── weather.py      # 날씨 도구 (OpenWeatherMap API)
    ├── trends.py       # 트렌드 도구 (Tavily API)
    ├── rag.py          # RAG 검색 도구 (ChromaDB)
    └── rag_advanced.py # 고급 RAG 도구 (Hybrid Search)
```

### Tool Registry

- 각 도구는 메타데이터(이름, 버전, 설명, 카테고리, 파라미터)와 함께 등록됩니다.
- 미들웨어 지원: 도구 실행 전후에 로깅, 캐싱 등의 처리가 가능합니다.
- 사용량 추적: 각 도구의 호출 횟수, 에러 횟수를 자동으로 기록합니다.
- 카테고리 기반 관리: 도구를 카테고리별로 그룹화하여 관리합니다.
- 런타임 제어: 도구를 런타임에 활성화/비활성화할 수 있습니다.

### MCP Server 인터페이스

```python
class MCPServer:
    async def initialize()          # MCP 서버 초기화 + 도구 등록
    async def list_tools()          # 등록된 도구 목록 조회
    async def call_tool(name, args) # 도구 실행
    async def get_stats()           # 사용 통계 조회
    async def shutdown()            # 서버 종료
```

---

## 4. RAG 파이프라인

### 기본 RAG (`backend/rag_pipeline.py`)

```
데이터 소스                    ChromaDB                      검색
┌────────────┐  임베딩   ┌─────────────┐  유사도 검색  ┌──────────┐
│dog_breeds  │──────────▶│             │──────────────▶│ Top-K    │
│.json (66종)│           │  Vector DB  │               │ Documents│
│dog_memes   │──────────▶│             │               └──────────┘
│.json       │           │ (Gemini     │
│sns_memes   │──────────▶│  Embedding) │
│.json       │           └─────────────┘
└────────────┘
```

- **데이터**: 66종 견종 정보, 강아지 밈, SNS 트렌드 데이터
- **임베딩**: Gemini Embedding (`models/gemini-embedding-001`) 또는 Azure OpenAI Embedding
- **벡터 DB**: ChromaDB (로컬 파일 기반, `data/chroma/` 디렉토리)
- **검색**: 코사인 유사도 기반 Top-K 문서 검색

### Advanced RAG (`backend/rag_advanced.py`)

기본 RAG에 3가지 고급 기법을 추가합니다:

| 기법 | 설명 | 적용 위치 |
|---|---|---|
| **Hybrid Search** | 벡터 검색 + BM25 키워드 검색 결합 | `hybrid_search()` |
| **Re-ranking** | LLM 기반 검색 결과 재순위화 | `rerank_documents()` |
| **Context Compression** | LLMChainExtractor로 관련 문맥만 추출 | `compressed_search()` |

```
Query ─┬──▶ Vector Search (ChromaDB) ──┐
       │                                 ├──▶ Merge ──▶ Re-rank ──▶ Compress ──▶ Result
       └──▶ BM25 Search (Keyword)   ────┘
```

---

## 5. Comment Agent 시스템 (`backend/comment_agents.py`)

### 5 페르소나

| 이름 | 이모지 | 성격 | 톤 |
|---|---|---|---|
| 뽀삐언니 | 🐩 | 에너지 넘치는 옆집 강아지 | 텐션 높은 칭찬, 사투리 |
| 츄르대장 | 🐱 | 쿨한 고양이, 은근 관심 | 시크하지만 따뜻한 한마디 |
| 할배멍 | 🦮 | 따뜻한 어르신 멍멍이 | 어르신 말투, 격려 |
| 멍스타그램 | 📸 | SNS 인플루언서 | 해시태그, 트렌디 |
| Dr.왕왕 | 🩺 | 수의학 전문 멍멍이 | 전문 용어, 건강 팁 |

### SSE 스트리밍

- 각 댓글 Agent는 무작위 딜레이(1~5초)로 댓글을 생성하여 "실제 사용자가 타이핑하는 느낌"을 줍니다.
- Server-Sent Events(SSE)를 통해 프론트엔드에 실시간으로 전달됩니다.
- `GET /api/v1/comments/stream/{user_id}/{entry_id}?mode=new|edit`

---

## 6. Structured Output (`backend/schemas.py`)

모든 Agent의 출력은 Pydantic 모델로 강제됩니다:

```python
# 운세 결과
class HoroscopeResult(BaseModel):
    horoscope_ko: str       # 한국어 운세
    horoscope_en: str       # 영어 운세
    lucky_item: str         # 오늘의 행운 아이템
    mood_emoji: str         # 기분 이모지
    compatibility: str      # 궁합 견종

# 일기 결과
class DiaryResult(BaseModel):
    diary_ko: str           # 한국어 일기
    diary_en: str           # 영어 일기
    mood_summary: str       # 기분 요약
    highlight: str          # 하이라이트 문구

# 건강 분석
class HealthAnalysis(BaseModel):
    risk_level: RiskLevel   # 위험도 (low/medium/high)
    analysis_ko: str        # 한국어 분석
    analysis_en: str        # 영어 분석
    recommendations: list   # 권장 사항
    cot_reasoning: str      # CoT 추론 과정

# 댓글 결과
class CommentResult(BaseModel):
    persona_name: str       # 페르소나 이름
    comment: str            # 댓글 내용
    emoji: str              # 페르소나 이모지
```

---

## 7. Function Calling (`backend/tools.py`)

Oracle Agent가 사용하는 외부 API 도구:

| 도구 | API | 용도 |
|---|---|---|
| `get_weather` | OpenWeatherMap | 현재 날씨 정보 (온도, 습도, 상태) |
| `search_trends` | Tavily | 실시간 트렌드/뉴스 검색 |
| `lookup_breed_info` | 로컬 JSON | 견종별 특성, 건강 정보 조회 |

- LangChain `@tool` 데코레이터를 사용하여 정의됩니다.
- Oracle Agent는 `ToolNode`와 `bind_tools()`를 통해 도구를 호출합니다.

---

## 8. LLM Provider 스위칭 (`backend/llm_provider.py`)

```python
# .env에서 설정
LLM_PROVIDER=google  # 또는 "azure"

# 코드에서 사용
from backend.llm_provider import get_llm, get_embeddings

llm = get_llm(temperature=0.8)        # 자동으로 설정된 Provider 사용
embeddings = get_embeddings()           # 임베딩 모델도 동일
```

| Provider | LLM 모델 | Embedding 모델 |
|---|---|---|
| Google | Gemini 2.0 Flash | gemini-embedding-001 |
| Azure | GPT-4o / GPT-4o-mini | text-embedding-ada-002 / text-embedding-3-large |
