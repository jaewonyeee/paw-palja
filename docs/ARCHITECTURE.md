# 아키텍처 상세

## 1. Multi-Agent 시스템 (`backend/agents.py`)

### LangGraph StateGraph 구조

Paw-Palja는 LangGraph의 `StateGraph`를 사용하여 3개의 전문 Agent를 순차적으로 실행합니다.
Vet Agent의 위험도 판정(High/Critical)에 따라 **조건부 분기**가 발생하며,
Oracle Agent에게 경고 메모를 전달하고 보호자에게 즉시 병원 안내를 포함합니다.

```
                  ┌─────────────┐
                  │   START     │
                  └──────┬──────┘
                         ▼
                  ┌─────────────┐
                  │   Oracle    │  temp=0.8
                  │  (운세 Agent)│  Tool Calling (MCP)
                  │             │  ┌─────────────────┐
                  │             │──│ get_weather      │
                  │             │  │ search_trends    │
                  │             │  │ lookup_breed_info│
                  │             │  └─────────────────┘
                  └──────┬──────┘
                         │ A2A memo (context → all)
                         ▼
                  ┌─────────────┐
                  │ Journalist  │  temp=0.9
                  │ (일기 Agent) │  Few-Shot + RAG (밈/SNS)
                  └──────┬──────┘
                         │ A2A memo (insight → vet)
                         ▼
                  ┌─────────────┐
                  │    Vet      │  temp=0.3
                  │ (건강 Agent) │  CoT 4단계 + RAG (견종/질병)
                  └──────┬──────┘
                         │
                    ┌────┴────┐
                    ▼         ▼
              risk=Low/Med  risk=High/Critical
                    │         │
                    │    ┌────┴──────────┐
                    │    │ alert_handler │
                    │    │ (긴급 병원 안내)│
                    │    │ + Oracle alert │
                    │    │   memo 전달    │
                    │    └────┬──────────┘
                    │         │
                    └────┬────┘
                         ▼
                  ┌─────────────┐
                  │    END      │
                  └─────────────┘
```

### Agent 상세

| Agent | 역할 | Temperature | 기법 | 출력 스키마 | MCP 도구 |
|---|---|---|---|---|---|
| **Oracle** | 오늘의 운세 생성 | 0.8 | Tool Calling (MCP Registry) | `HoroscopeResult` | `get_weather`, `search_trends`, `lookup_breed_info` |
| **Journalist** | 1인칭 강아지 시점 일기 | 0.9 | Few-Shot + RAG (밈/SNS) + 페르소나 믹싱 | `DiaryResult` | - |
| **Vet** | 건강 리스크 분석 | 0.3 | CoT 4단계 추론 + RAG (견종/질병/KISTI) | `HealthAnalysis` | - |

### AgentState 정의 (실제 코드)

```python
class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]  # LangGraph 메시지 히스토리
    dog_profile: dict       # 반려견 프로필 (name, breed, mbti, persona_type, language 등)
    daily_logs: dict        # 일일 기록 (mood, food, walk, poop, notes)
    agent_memos: list[dict] # A2A 메모 리스트 (AgentMemo 규격)
    horoscope: dict | None  # Oracle 출력 (HoroscopeResult)
    diary: dict | None      # Journalist 출력 (DiaryResult)
    health: dict | None     # Vet 출력 (HealthAnalysis)
```

| 필드 | 타입 | 설명 | 초기값 |
|---|---|---|---|
| `messages` | `list[BaseMessage]` | LangGraph 대화 히스토리, `add_messages` reducer로 자동 병합 | `[HumanMessage]` |
| `dog_profile` | `dict` | `name`, `breed`, `mbti`, `persona_type`, `language`, `auto_persona_mixing` | 필수 입력 |
| `daily_logs` | `dict` | `mood`, `food`, `walk`, `poop`, `notes` | 필수 입력 |
| `agent_memos` | `list[dict]` | `AgentMemo` Pydantic 모델 직렬화 (sender, receiver, memo_type, content, priority, timestamp) | `[]` |
| `horoscope` | `dict \| None` | `HoroscopeResult.model_dump()` — 12개 다국어 필드 (summary_ko/en, content_ko/en, lucky_item_ko/en 등) | `None` |
| `diary` | `dict \| None` | `DiaryResult.model_dump()` — 7개 다국어 필드 (title_ko/en, content_ko/en, mood_icon, meme_reference_ko/en) | `None` |
| `health` | `dict \| None` | `HealthAnalysis.model_dump()` — CoT 4단계 + risk_level + advice + rag_sources | `None` |

### 노드별 Input/Output

| 노드 | Input (State에서 읽는 필드) | Output (State에 쓰는 필드) | 사용 기법 |
|---|---|---|---|
| **oracle** | `dog_profile`, `daily_logs` | `horoscope`, `agent_memos` (context→all) | MCP Tool Calling (날씨/트렌드/견종), Few-Shot, 캐시(breed+mbti+date 1h TTL) |
| **journalist** | `dog_profile`, `daily_logs`, `agent_memos` (oracle 메모 읽기) | `diary`, `agent_memos` (insight→vet) | Few-Shot (한/영), RAG (밈/SNS/페르소나), 자동 페르소나 믹싱 |
| **vet** | `dog_profile`, `daily_logs`, `agent_memos` (journalist 메모 읽기) | `health`, `agent_memos` (alert→oracle, if High/Critical) | CoT 4단계, RAG (견종건강/질병QA/KISTI 256종) |
| **alert_handler** | `health` (risk_level 확인) | `health` (emergency_guidance 추가) | risk_level ≥ High일 때 conditional_edge로 진입, 병원 안내/응급 기준 추가 |

### 조건부 분기 규칙 (Conditional Edge)

```python
def route_after_vet(state: AgentState) -> str:
    """Vet 분석 후 위험도에 따라 분기"""
    health = state.get("health", {})
    risk = health.get("risk_level", "Low")
    if risk in ("High", "Critical"):
        return "alert_handler"   # 긴급 안내 노드로 진입
    return END                   # 정상 종료
```

| 조건 | 분기 대상 | 동작 |
|---|---|---|
| `risk_level` = Low / Medium | `END` | 정상 종료 |
| `risk_level` = High | `alert_handler` → `END` | 병원 방문 권고 메시지 추가, Oracle에 alert 메모 전달 |
| `risk_level` = Critical | `alert_handler` → `END` | 즉시 응급 병원 안내, 강조된 경고 메시지 추가 |

### 에러 복구 전략

| 장애 유형 | 복구 전략 | 구현 위치 |
|---|---|---|
| LLM 파싱 실패 | 재시도 (temperature 0.1 낮춤) + 폴백 응답 스키마 | `backend/agents.py` `_invoke_with_retry()` |
| MCP 도구 실패 | 도구별 폴백 값 반환 (날씨→"정보 없음", 트렌드→빈 문자열) | `backend/tools.py` 각 도구의 except 블록 |
| RAG 검색 실패 | 빈 컨텍스트로 LLM 호출 (graceful degradation) | `backend/agents.py` 각 Agent의 except 블록 |
| Redis 캐시 실패 | 캐시 무시하고 LLM 직접 호출 | `backend/agents.py` `_try_horoscope_cache()` |

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
    timestamp: str  # ISO 8601
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

### 메모 라우팅 규칙

```
Oracle ──context──▶ all (Journalist + Vet)
  │        "오늘 날씨: 맑음 25°C. 운세 키워드: 산책일. 트렌드: 쿨매트"
  │
  │  Journalist ──insight──▶ Vet
  │        "강아지 기분: 우울. 일기 무드: cloud-rain"
  │
  │  Vet ──alert──▶ Oracle  (risk_level ≥ High인 경우에만)
  │        "건강 위험 감지! 위험도: High. 배변 이상 + 식욕 감소 지속"
  │
  ▼
메모 필터링: filter_memos_for(agent_id, memos)
  → receiver가 agent_id 또는 "all"인 메모만 반환
```

| 발신 | 수신 | memo_type | 조건 | 내용 예시 |
|---|---|---|---|---|
| Oracle | all | `context` | 항상 | 날씨, 트렌드, 운세 키워드 |
| Journalist | vet | `insight` | 항상 | 감정 상태, 일기 무드 |
| Vet | oracle | `alert` | `risk_level` ≥ High | 건강 위험 경고, 결론 요약 |

---

## 3. MCP (Model Context Protocol) (`backend/mcp/`)

### 구조

```
mcp/
├── bootstrap.py    # 도구 자동 등록 및 초기화
├── registry.py     # Tool Registry (등록, 실행, 메타데이터, 미들웨어)
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

### Tool Calling 능동성

Oracle Agent는 MCP Registry를 통해 도구를 **자율적으로 호출**합니다.
도구 선택 로직은 다음과 같이 동작합니다:

```python
# 1. MCP Registry에 도구를 등록 (bootstrap.py에서 자동 수행)
_mcp_registry.register("get_weather", handler=get_weather, category="external_api")
_mcp_registry.register("search_trends", handler=search_trends, category="external_api")
_mcp_registry.register("lookup_breed_info", handler=lookup_breed_info, category="rag")

# 2. Oracle Agent가 컨텍스트에 따라 도구를 선택/실행
weather_data = _mcp_registry.execute("get_weather", city="Seoul")
trend_data = _mcp_registry.execute("search_trends", query=f"강아지 트렌드 {breed}")
breed_rag = _mcp_registry.execute("lookup_breed_info", breed=breed, k=3)

# 3. LangChain @tool 데코레이터 기반 도구 정의 + bind_tools 바인딩
oracle_tools = [get_weather, search_trends, lookup_breed_info]
llm_with_tools = get_llm(temperature=0.8).bind_tools(oracle_tools)
# → LLM이 도구 목록을 인식하고, 프롬프트 기반으로 어떤 도구를 호출할지 결정
```

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
데이터 소스 (6종)                ChromaDB                      검색
┌────────────────┐  임베딩   ┌─────────────┐  유사도 검색  ┌──────────┐
│ dog_breeds     │──────────▶│             │──────────────▶│ Top-K    │
│ .json (66종)   │           │  Vector DB  │               │ Documents│
│ dog_memes.json │──────────▶│             │  metadata     │ + Source │
│ sns_memes.json │──────────▶│ (Gemini     │  filter       │   Item   │
│ dog_personas   │──────────▶│  Embedding) │──────────────▶│          │
│ dog_disease_qa │──────────▶│             │               └──────────┘
│ kisti_diseases │──────────▶│             │
│ .json (256종)  │           └─────────────┘
└────────────────┘
```

- **데이터**: 66종 견종 정보, 강아지 밈, SNS 트렌드, 페르소나, 질병 QA, KISTI 256종 질병
- **임베딩**: Gemini Embedding (`models/gemini-embedding-001`) 또는 Azure OpenAI Embedding
- **벡터 DB**: ChromaDB (로컬 파일 기반, `data/chroma/` 디렉토리)
- **검색**: 코사인 유사도 기반 Top-K + metadata `source` 필터링
- **네임스페이스 전략**: `CHROMA_MULTI_COLLECTION=true` 설정 시 컬렉션 분리 (breeds/memes/disease)

### 컬렉션 전략

| 전략 | 설정값 | 장점 | 단점 |
|---|---|---|---|
| 단일 컬렉션 (기본) | `CHROMA_MULTI_COLLECTION=false` | 간단한 구성, metadata 필터로 충분 | 대규모 시 검색 노이즈 가능 |
| 다중 컬렉션 | `CHROMA_MULTI_COLLECTION=true` | 소스별 독립 인덱스, 검색 정확도 향상 | 관리 복잡도 증가 |

### Advanced RAG (`backend/rag_advanced.py`)

기본 RAG에 3가지 고급 기법을 추가합니다:

| 기법 | 설명 | 적용 위치 |
|---|---|---|
| **Hybrid Search** | 벡터 검색 + BM25 키워드 검색 결합 | `hybrid_search()` |
| **Re-ranking** | Cross-Encoder / LLM 기반 검색 결과 재순위화 | `rerank_documents()` |
| **Context Compression** | LLMChainExtractor로 관련 문맥만 추출 | `query_with_compression()` |

```
Query ─┬──▶ Vector Search (ChromaDB) ──┐
       │                                 ├──▶ Merge ──▶ Re-rank ──▶ Compress ──▶ Result
       └──▶ BM25 Search (Keyword)   ────┘
```

### RAG 근거 출처 표준화 (`SourceItem`)

모든 RAG 결과는 `SourceItem` 모델로 표준화되어 프론트엔드에서 "근거 보기"로 연결됩니다:

```python
class SourceItem(BaseModel):
    title: str           # 문서 제목 (예: "푸들 건강 정보")
    snippet: str         # 관련 텍스트 스니펫 (최대 200자)
    source_type: str     # 데이터 소스 (breeds/memes/sns/disease_qa/kisti_disease)
    score: float         # 유사도 점수 (0.0 ~ 1.0)
    metadata: dict       # 추가 메타데이터 (breed, disease_code 등)
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

- 각 댓글 Agent는 무작위 딜레이(3~7초)로 댓글을 생성하여 "실제 사용자가 타이핑하는 느낌"을 줍니다.
- Server-Sent Events(SSE)를 통해 프론트엔드에 실시간으로 전달됩니다.
- `GET /api/v1/comments/stream/{entry_id}?mode=new|edit&token=<jwt>`
- **연결 안정성**: `Last-Event-ID` 기반 재연결, 중복 방지 키(`comment_id`), 타임아웃 처리

---

## 6. Structured Output (`backend/schemas.py`)

모든 Agent의 출력은 Pydantic 모델로 강제됩니다 (실제 스키마):

```python
# 운세 결과 (Oracle Agent)
class HoroscopeResult(BaseModel):
    summary_ko: str              # 한 줄 요약 (한국어)
    summary_en: str              # Summary (English)
    content_ko: str              # 상세 운세 (한국어, 100자 이상)
    content_en: str              # Detailed fortune (English)
    lucky_item_ko: str           # 럭키 아이템 (한국어)
    lucky_item_en: str           # Lucky item (English)
    interaction_hint_ko: str     # 인터랙션 힌트 (한국어)
    interaction_hint_en: str     # Interaction hint (English)
    weather_context_ko: str      # 날씨 기반 조언 (한국어)
    weather_context_en: str      # Weather advice (English)
    trend_reference_ko: str      # 트렌드 참조 (한국어)
    trend_reference_en: str      # Trend reference (English)

# 일기 결과 (Journalist Agent)
class DiaryResult(BaseModel):
    title_ko: str                # 일기 제목 (한국어)
    title_en: str                # Diary title (English)
    content_ko: str              # 일기 본문 (한국어, 1인칭 강아지 시점)
    content_en: str              # Diary content (English, dog POV)
    mood_icon: str               # 무드 아이콘 (sparkles, heart 등)
    meme_reference_ko: str       # 밈 레퍼런스 (한국어)
    meme_reference_en: str       # Meme reference (English)

# 건강 분석 (Vet Agent) — CoT 4단계
class HealthAnalysis(BaseModel):
    risk_level: RiskLevel        # Low / Medium / High / Critical
    symptom_analysis_ko: str     # Step 1: 증상 분석 (요약된 근거)
    symptom_analysis_en: str     # Step 1: Symptom analysis
    duration_context_ko: str     # Step 2: 기간/빈도 맥락
    duration_context_en: str     # Step 2: Duration context
    breed_context_ko: str        # Step 3: 견종 특성 분석
    breed_context_en: str        # Step 3: Breed analysis
    conclusion_ko: str           # Step 4: 최종 결론
    conclusion_en: str           # Step 4: Conclusion
    advice_ko: str               # 보호자 행동 권장사항
    advice_en: str               # Action recommendations
    rag_sources: list[SourceItem]  # 참조 근거 (표준화된 출처)

# 댓글 결과 (Comment Agent)
class CommentResult(BaseModel):
    author: str                  # 페르소나 이름
    emoji: str                   # 페르소나 이모지
    text_ko: str                 # 댓글 (한국어)
    text_en: str                 # Comment (English)
```

### 의료 고지 (Safety Disclaimer)

Vet Agent는 수의학 참고 정보를 제공하며, **의료 자문이 아닌 참고 정보**임을 명시합니다.
위험도 High/Critical 판정 시 다음 안전 가이드가 자동으로 포함됩니다:

| 위험도 | 안내 메시지 |
|---|---|
| Low | "현재 특별한 이상은 보이지 않습니다" |
| Medium | "1주 내 호전되지 않으면 수의사 상담을 권장합니다" |
| High | "가능한 빨리 가까운 동물병원을 방문해주세요" |
| Critical | "즉시 응급 동물병원을 방문해주세요. 야간/공휴일 응급 진료 가능 병원을 확인하세요" |

---

## 7. Function Calling (`backend/tools.py`)

Oracle Agent가 사용하는 외부 API 도구:

| 도구 | API | 용도 | 카테고리 |
|---|---|---|---|
| `get_weather` | OpenWeatherMap | 현재 날씨 정보 (온도, 습도, 상태) | `external_api` |
| `search_trends` | Tavily | 실시간 트렌드/뉴스 검색 | `external_api` |
| `lookup_breed_info` | ChromaDB RAG | 견종별 특성, 건강 정보 조회 | `rag` |

- LangChain `@tool` 데코레이터를 사용하여 정의됩니다.
- MCP Registry를 통해 등록/관리되며, `_mcp_registry.execute()` 로 실행됩니다.
- 각 도구는 실패 시 안전한 폴백 값을 반환합니다 (graceful degradation).

### 도구 호출 의사결정 흐름

```
Oracle Agent 실행
  │
  ├── 1) get_weather("Seoul") → 날씨 데이터 수집
  │     └── 실패 시: {"weather": "정보 없음", "temp": 0}
  │
  ├── 2) search_trends("강아지 트렌드 {breed}") → 트렌드 검색
  │     └── 실패 시: "검색 결과 없음"
  │
  ├── 3) lookup_breed_info(breed) → 견종 RAG 검색
  │     └── 실패 시: "정보를 찾지 못했습니다"
  │
  └── 4) 수집 데이터 → 프롬프트에 주입 → LLM 호출 → HoroscopeResult
```

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

---

## 9. 관찰가능성 (Observability)

### 구조화 로깅 (`backend/logger.py`)

모든 로그는 JSON 형태로 구조화되며 다음 필드를 포함합니다:

| 필드 | 설명 | 예시 |
|---|---|---|
| `request_id` | 요청 고유 ID (UUID) | `"a1b2c3d4-..."` |
| `user_id` | 사용자 ID | `"user123"` |
| `agent_name` | Agent 이름 | `"oracle"` |
| `tool_name` | MCP 도구 이름 | `"get_weather"` |
| `duration_ms` | 처리 시간 (ms) | `1234` |
| `rag_hit` | RAG 검색 결과 존재 여부 | `true` |
| `rag_source_count` | RAG 반환 문서 수 | `3` |
| `llm_model` | 사용된 LLM 모델 | `"gemini-2.0-flash"` |
| `status_code` | HTTP 상태 코드 | `200` |

### 운영 체크리스트

- `logs/all.log`: 전체 로그 (10MB 로테이션, 5개 백업)
- `logs/error.log`: 에러 로그만 분리
- `logs/agent.log`: Agent 실행 로그 (도구 호출, RAG 검색, LLM 생성)
- `X-Request-ID` 헤더: 모든 응답에 포함, 로그 추적용
