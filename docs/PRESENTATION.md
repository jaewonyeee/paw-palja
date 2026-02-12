# Paw-Palja (포팔자) – 반려견 운세 기반 육아일기 & 건강 관리 AI Agent

## 1. 프로젝트 개요 – 기획 배경 및 핵심 내용

### 1.1 프로젝트 기획 배경

**어떤 문제를 해결하고자 하는가?**

반려견 보호자들은 매일 강아지의 컨디션(기분, 식사, 산책, 배변)을 관찰하지만, 이를 체계적으로 기록하고 건강 이상 징후를 조기에 파악하기가 어렵다. 또한 반려견 육아일기를 작성하고 싶어도 바쁜 일상 속에서 매일 글을 쓰는 것은 큰 부담이다. 단순 기록 앱은 지루하고, 수의학적 분석을 제공하는 서비스는 딱딱하여 지속적인 사용이 이루어지지 않는다.

**기존 방식의 한계는 무엇인가?**

* 기존 반려견 일기 앱은 단순 텍스트 입력 + 사진 첨부에 그쳐 보호자의 꾸준한 동기 부여가 어렵다.

* 반려견 건강 관리 앱은 수치와 데이터 중심이라 감성적 연결이 부족하다.

* 운세/재미 요소를 제공하는 앱은 실질적인 건강 관리 기능이 없다.

* 견종별 유전적 건강 리스크를 실시간으로 반영하는 서비스가 거의 없다.

* 기록 → 분석 → 조언이 분절되어 있어 보호자가 여러 앱을 오가야 한다.

**Agent 서비스로 해결할 수 있는 Pain Point는 무엇인가?**

* LangGraph 멀티 에이전트가 간단한 일일 기록(기분, 식사, 산책, 배변)만 입력하면 운세·일기·건강분석 3가지 콘텐츠를 자동 생성하여 기록 부담을 제거한다.

* Agent 간 A2A 프로토콜로 컨텍스트를 공유하여 날씨·트렌드를 반영한 운세, 밈을 활용한 감성 일기, 견종별 CoT 기반 건강 분석이 유기적으로 연결된다.

* 5명의 AI 댓글 캐릭터가 SSE 실시간 스트리밍으로 SNS처럼 반응하여 "혼자 기록하는 느낌"을 없애고 소셜 경험을 제공한다.

**이 프로젝트를 시작하게 된 동기는 무엇인가?**

반려견을 키우며 매일 컨디션을 체크하지만 이를 기록으로 남기기가 귀찮았고, 뒤늦게 건강 이상을 발견한 경험이 있었다. LangGraph 멀티 에이전트 시스템의 A2A 협업 구조를 실전에 적용해보고 싶었고, "재미(운세) + 감성(일기) + 실용(건강)"이라는 세 가지 가치를 하나의 AI Agent 파이프라인으로 통합하면 반려견 보호자에게 지속적인 사용 동기를 부여할 수 있겠다고 판단하여 프로젝트를 시작하게 되었다.

### 1.2 핵심 아이디어 및 가치 제안(Value Proposition)

**서비스가 제공하는 핵심 기능은 무엇인가?**

1. **3-Agent 파이프라인 일기 자동 생성**: Oracle(운세) → Journalist(일기) → Vet(건강) 순서로 연쇄 실행되어 하루 기록을 3가지 관점에서 자동 생성

2. **A2A 메모 교환 기반 컨텍스트 공유**: Agent 간 실시간 메모 전달로 일관성 있는 분석 (예: 날씨 정보가 운세뿐 아니라 건강 조언에도 반영)

3. **5명의 AI 댓글 캐릭터 SSE 스트리밍**: 뽀삐언니, 츄르대장, 할배멍, 멍스타그램, Dr.왕왕이 일기에 실시간 댓글

4. **RAG 기반 견종별 건강 리스크 분석**: ChromaDB 벡터DB에 66종 견종 데이터를 적재하고, 질병 QA·KISTI 질병 분류 데이터를 추가 적재할 수 있는 확장 구조를 갖추어 맞춤형 건강 분석 제공

5. **한국어/영어 동시 생성(Bilingual)**: 모든 Agent 출력이 Pydantic Structured Output으로 양쪽 언어 동시 생성

6. **소셜 피드 & 공유**: 일기 공개 공유, 소셜 피드, 공개 프로필 기능

**사용자에게 제공되는 가치와 기대효과는 무엇인가?**

* 하루 1분 입력으로 운세·일기·건강분석 3종 콘텐츠 자동 생성 → 기록 부담 극소화

* 견종별 유전적 리스크를 CoT 4단계 추론으로 분석 → 건강 이상 징후 조기 발견

* MZ세대 밈·젠지 슬랭을 활용한 1인칭 강아지 시점 일기 → 감성적 즐거움과 공유 욕구

* AI 댓글 캐릭터의 실시간 반응 → 커뮤니티 소속감과 지속 사용 동기

* Web Push 알림으로 매일 일기 작성 리마인더 → 습관 형성

**기존 서비스 대비 차별성은 무엇인가?**

| 기존 서비스          | Paw-Palja 차별점                     |
| --------------- | --------------------------------- |
| 단순 기록 앱 (펫노트 등) | 3-Agent 자동 콘텐츠 생성 + A2A 컨텍스트 공유   |
| 반려견 건강앱         | CoT 4단계 추론 + RAG 견종별 맞춤 분석        |
| 운세/재미 앱         | 실시간 날씨·트렌드 MCP Tool 기반 개인화 운세 |
| SNS (인스타 등)     | 5명의 AI 캐릭터가 SSE로 실시간 댓글 생성        |
| 영어 전용 서비스       | 한국어/영어 Bilingual 동시 생성            |

### 1.3 대상 사용자 및 기대 사용자 경험(UX)

**주요 타겟**

* **1차 타겟**: 20~40대 반려견 보호자 (MZ세대) — SNS에 반려견 일상을 공유하고 싶지만 직접 글을 쓰기 부담스러운 사용자

* **2차 타겟**: 반려견 건강에 관심이 높은 보호자 — 견종별 건강 리스크를 알고 싶지만 매번 수의사에게 상담하기 어려운 사용자

* **3차 타겟**: 반려견 커뮤니티 활동을 즐기는 사용자 — 다른 보호자들과 일기를 공유하고 소통하고 싶은 사용자

**사용자에게 어떤 흐름과 경험을 제공할 것인가?**

1. **온보딩**: 반려견 프로필 등록 (이름, 견종 66종 선택, MBTI) → 간단한 가입 후 바로 시작

2. **일일 기록**: 오늘의 기분·식사·산책시간·배변 상태를 간단히 선택/입력 (1분 이내)

3. **AI 콘텐츠 생성**: 로딩 애니메이션과 함께 3-Agent 파이프라인이 운세→일기→건강분석 순차 생성 (7~17초)

4. **결과 확인**: 탭 형태로 운세/일기/건강 각각 확인, 사진 첨부 가능

5. **AI 댓글 수신**: SSE 스트리밍으로 3명의 AI 캐릭터 댓글이 3~45초 랜덤 딜레이로 도착 (SNS 느낌)

6. **일기 수정 & 반응**: 일기 수정 시 AI 캐릭터들이 수정 사항에 위트 있게 반응

7. **소셜 공유**: 일기를 공개 링크로 공유, 소셜 피드에서 다른 사용자의 일기 열람

8. **건강 리마인더**: 설정한 시간에 Web Push 알림으로 일기 작성 독려

**사용자가 서비스에서 얻는 구체적 Benefit**

* 매일 간단한 입력만으로 반려견의 하루가 재미있는 콘텐츠로 변환되는 즐거움

* 견종 특성을 고려한 AI 수의사의 건강 분석으로 이상 징후 조기 인지

* AI 캐릭터들의 댓글로 "나만의 반려견 SNS" 경험

* 한국어/영어 동시 생성으로 해외 친구·가족과 일기 공유 가능

* 장기 기록 축적을 통한 반려견 건강 패턴 파악

## 2. 기술 구성 – 서비스에 적용할 기술 스택

### 2.1 Prompt Engineering 전략

**역할 기반 프롬프트**

각 Agent에 명확한 역할과 성격을 부여하여 일관된 출력을 보장한다:

* **Oracle Agent**: "You are 'Oracle', a bilingual mystical dog fortune teller" — 신비로운 점술가 역할, temperature 0.8로 창의적 운세 생성

* **Journalist Agent**: "You are 'Journalist', a bilingual first-person dog narrator" — 1인칭 강아지 시점의 기자 역할, temperature 0.9로 감성적 일기 작성

* **Vet Agent**: "You are 'Vet', a bilingual analytical veterinarian" — 분석적 수의사 역할, temperature 0.3으로 정확한 건강 분석

* **Comment Agents (5종)**: 뽀삐언니(텐션 높은 칭찬), 츄르대장(시크한 고양이), 할배멍(따뜻한 어르신), 멍스타그램(SNS 인플루언서), Dr.왕왕(수의학 전문가) — 각각 고유한 말투와 성격, temperature 0.95

**CoT/Few-Shot 등 고품질 응답 전략**

* **Few-Shot Prompting**: Oracle과 Journalist Agent에 한국어/영어 예시를 제공하여 출력 스타일을 가이드

  * Oracle: 한국어 3개 + 영어 3개 예시 (기분별·날씨별·견종별 운세 — `prompt_engineering.py`)

  * Journalist: 한국어 2개 + 영어 2개 예시 + 페르소나 스타일 예시 (인라인 Few-Shot — `agents.py`)

* **Chain-of-Thought (CoT)**: Vet Agent에 4단계 사고 과정을 명시적으로 지시

  * Step 1: 증상 분석 (Symptom Analysis)

  * Step 2: 기간/빈도 맥락 (Duration Context)

  * Step 3: 견종 특성 기반 분석 (Breed Context)

  * Step 4: 최종 결론 및 위험도 판정 (Conclusion)

* **Self-Consistency**: `self_consistency_generate()` 함수를 구현하여 동일 프롬프트로 n번 생성 후 가장 일관된 결과를 투표(Majority Vote) 방식으로 선택하는 기법 제공 (`prompt_engineering.py`)

**출력 구조화 템플릿 정의**

모든 Agent 출력은 Pydantic 모델로 스키마를 강제하여 파싱 에러를 방지한다:

* `HoroscopeResult`: summary_ko/en, content_ko/en, lucky_item_ko/en, interaction_hint_ko/en, weather_context_ko/en, trend_reference_ko/en

* `DiaryResult`: title_ko/en, content_ko/en, mood_icon, meme_reference_ko/en

* `HealthAnalysis`: risk_level(Enum: Low/Medium/High/Critical), symptom_analysis_ko/en, duration_context_ko/en, breed_context_ko/en, conclusion_ko/en, advice_ko/en, rag_sources

* `CommentResult`: author, emoji, text_ko, text_en

LLM 호출 시 `llm.with_structured_output(PydanticModel)` 패턴으로 JSON 파싱 오류를 원천 차단한다.

**사용자 유형/상황별 프롬프트 분기**

* **페르소나 자동 믹싱**: 강아지의 기분·활동·메모를 분석하여 최적의 페르소나 조합을 자동 추천 (사고뭉치, 공주병, 늙은이, 철학자 등 — `enhanced_persona_system.py`)

* **수동 선택 모드**: 보호자가 직접 페르소나를 지정할 수 있는 옵션 제공 (`auto_persona_mixing` 플래그)

* **언어별 문화 맥락 반영**: 한국어는 MZ 밈 말투, 영어는 Gen-Z slang을 각각 적용

* **건강 위험도 분기**: Vet Agent 결과가 High/Critical이면 A2A 메모로 Oracle에 경고 전달

### 2.2 LangChain / LangGraph 기반 Agent 구조

**Multi-Agent 설계 개념**

LangGraph StateGraph를 활용하여 3개의 주요 Agent를 순차 파이프라인으로 연결하고, A2A(Agent-to-Agent) 프로토콜을 통해 Agent 간 메모(Memo)를 교환하는 협업 구조를 설계하였다.

```text
Oracle Agent (운세) → Journalist Agent (일기) → Vet Agent (건강)
 ↓ memo                 ↓ memo                      ↓ memo
날씨+트렌드 참조          감성+밈 참조 일기            증상 분석+조언
```

**각 Agent의 역할(Role) 정의**

| Agent               | 역할     | Temperature | 핵심 기능                                       |
| ------------------- | ------ | ----------- | ------------------------------------------- |
| Oracle              | 점술가    | 0.8         | MCP Registry를 통한 날씨·트렌드·견종정보 수집 → 운세 생성       |
| Journalist          | 기자견    | 0.9         | RAG 밈/SNS 데이터 검색 + Few-Shot + 페르소나 기반 일기 작성 |
| Vet                 | 수의사    | 0.3         | RAG 견종 건강 데이터 + CoT 4단계 추론 → 위험도 평가 및 조언    |
| Comment Agents (5종) | 댓글 캐릭터 | 0.95        | 각 페르소나별 성격으로 일기에 감성 댓글 생성                   |

**MCP Tool Calling, Memory, A2A 활용**

* **MCP Tool Calling**: Oracle Agent가 MCP Registry(`backend/mcp/registry.py`)를 통해 `get_weather`, `search_trends`, `lookup_breed_info` 3개 도구를 `_mcp_registry.execute()` 형태로 호출하여 실시간 데이터 수집. 도구들은 `backend/tools.py`에 LangChain `@tool` 데코레이터로 정의되고, `backend/mcp/bootstrap.py`에서 MCP 레지스트리에 자동 등록됨.

* **Memory**: LangGraph `MemorySaver` Checkpointer를 사용하여 세션별 대화 상태를 유지 (thread_id 기반)

* **A2A 프로토콜**: `AgentMemo` Pydantic 모델로 Agent 간 메시지 규격을 정의하고, sender/receiver/memo_type/priority 필드로 구조화된 컨텍스트 전달

  * Oracle → all: "오늘 날씨: 맑음, 25°C. 운세 키워드: 산책 최적. 트렌드: ..." (memo_type: `context`)

  * Journalist → vet: "강아지 기분: 신남. 일기 무드: sparkles" (memo_type: `insight`)

  * Vet → oracle: "건강 위험 감지! 위험도: High" (memo_type: `alert`, priority: `high` — 위험도가 High/Critical일 때만)

### 2.3 RAG 구성

**데이터 수집/전처리 파이프라인**

6종의 데이터 소스를 지원하는 RAG 파이프라인을 구현하였다. 현재 리포지토리에는 3종이 포함되어 있으며, 나머지 3종은 외부 데이터 수집 후 `data/raw/`에 추가하면 자동으로 적재된다:

| 데이터 소스                | 설명                                 | 상태 | 수집 방식                                                                                                                                                      |
| --------------------- | ---------------------------------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dog_breeds.json`     | 66종 견종 정보 (성격, 주의질환, MBTI 매칭, 케어팁) | **포함** | 정적 데이터                                                                                                                                                     |
| `dog_memes.json`      | 강아지 밈 데이터 (타입, 말투, 텍스트)            | **포함** | 정적 데이터                                                                                                                                                     |
| `sns_memes.json`      | Instagram/X(Twitter) 밈 데이터         | **포함** | Apify API 자동 수집 (매일 07:00 스케줄러)                                                                                                                            |
| `dog_personas.json`   | 4가지 강아지 성격 타입 (사고뭉치, 공주병 등)        | 확장용 | AI-Hub 제공 페르소나 대화 직접 수집                                                                                                                                    |
| `dog_disease_qa.json` | 반려견 질병 QA (질병, 진료과, 생애주기, 질문/답변)   | 확장용 | AI-Hub 제공 반려견 성장 및 질병관련 말뭉치 데이터 활용 직접 수집 + 연구활용된 AI-Hub 제공 반려동물(개, 고양이) 건강 정보 데이터셋을 문서형태로 변환된 데이터 활용 (<https://github.com/eunchanj/DataON_2024/tree/main>) |
| `kisti_diseases.json` | KISTI 256개 질병 분류 (질병코드, 카테고리, 증상)  | 확장용 | 연구활용된 한국과학기술정보연구원(KISTI) 제공 동물 질병 텍스트 데이터 활용 (<https://github.com/eunchanj/DataON_2024/tree/main>)                                                         |

전처리: 각 데이터를 `Document` 객체로 변환 시 `page_content`에 핵심 텍스트를 조합하고, `metadata`에 `source` 필터 키를 부여하여 검색 시 데이터 소스별 필터링이 가능하도록 구성하였다. 파일이 존재하지 않는 경우 해당 소스는 자동으로 건너뛴다 (`os.path.exists()` 체크).

**임베딩 모델 및 Vector DB 선택**

* **임베딩 모델**: Google `models/gemini-embedding-001` (LLM_PROVIDER=google 시) 또는 Azure `text-embedding-ada-002` (LLM_PROVIDER=azure 시) — `llm_provider.py`에서 환경변수 기반 자동 전환

* **Vector DB**: ChromaDB — `persist_directory` 기반 로컬 영속 저장, `pawpalja_collection` 단일 컬렉션에 전체 데이터 적재

* **Python 3.14 호환**: `chroma_compat.py`에서 pydantic.v1 호환 monkey-patch 적용

**검색 로직과 응답 생성 방식**

* **일반 검색**: `query_rag(query, k)` — 유사도 기반 top-k 검색

* **필터 검색**: `query_rag_with_filter(query, source_filter, k)` — metadata의 `source` 필드로 데이터 소스별 필터링

  * Oracle: `source_filter="breeds"` 견종 정보 검색 (MCP `lookup_breed_info` 도구를 통해 호출)

  * Journalist: `source_filter="memes"` + `source_filter="sns"` 밈 데이터 검색, `source_filter="personas"` 페르소나 검색

  * Vet: `source_filter="breeds"` + `source_filter="disease_qa"` + `source_filter="kisti_disease"` 건강 데이터 검색

* **Advanced RAG** (`rag_advanced.py`):
  * `hybrid_search()`: Vector 검색 + BM25 키워드 검색 결합 (가중치 기반 스코어 병합)
  * `rerank_documents()`: Cross-Encoder 또는 LLM 기반 검색 결과 재순위화
  * `query_with_compression()`: LLMChainExtractor로 쿼리 관련 문맥만 추출

* **응답 생성**: RAG 검색 결과를 Agent 프롬프트의 컨텍스트 섹션에 삽입 → LLM이 검색된 정보를 참조하여 Structured Output 생성

### 2.4 서비스 개발 및 패키징 계획

**UI 개발 방식**

* **React 19 + Vite**: SPA(Single Page Application) 구조, React Router로 페이지 라우팅

* **Motion.dev**: 온보딩 등 인터랙션 애니메이션 적용

* **주요 페이지**: Onboarding → Login/Signup → Home(일기 목록) → NewDiary(일기 생성) → DiaryDetail(상세 보기, 운세/일기/건강 탭) → Profile(설정) → Admin(관리자 대시보드)

* **ErrorBoundary**: 프론트엔드 전역 에러 캐치 및 복구 UI 적용

**BE(API) 및 배포 전략**

* **FastAPI**: 비동기 API 서버, API v1 prefix (`/api/v1/`)로 버전 관리

* **인증**: JWT (Access Token 5분 + Refresh Token 7일 + Rotation with Reuse Detection)

* **데이터베이스**: PostgreSQL (프로덕션) / SQLite (개발) — SQLAlchemy async ORM, Alembic 마이그레이션

* **캐싱**: Redis — 사용자 정보, 일기 목록, 어드민 통계 캐싱 + Horoscope LLM 결과 캐싱 (1시간 TTL)

* **태스크 큐**: ARQ (Redis 기반) — LLM 호출을 백그라운드 워커로 오프로드 (USE_TASK_QUEUE 플래그로 on/off)

* **Rate Limiting**: slowapi — 엔드포인트별 요청 제한 (JWT user_id 기반)

* **Docker**: Multi-stage build (frontend build → backend stage), docker-compose.yml (PostgreSQL + Backend)

* **Nginx**: 리버스 프록시, gzip 압축, 정적 파일 서빙, rate limiting zone, SSE 버퍼링 비활성화, 보안 헤더

**설정/환경 관리 계획**

* `.env.example`으로 환경변수 템플릿 제공 (LLM_PROVIDER, API 키, JWT_SECRET, DATABASE_URL 등)

* LLM Provider 전환: `LLM_PROVIDER=google|azure` 환경변수 하나로 Google Gemini ↔ Azure OpenAI 즉시 전환

* 클라우드 배포: `docker-compose.prod.yml` (PostgreSQL + Redis + Backend + Worker + Nginx)

* CI/CD: GitHub Actions + SSH 기반 배포 스크립트

### 2.5 선택적 확장 기능

**LLM Fundamentals 기반 Structured Output / Function Calling**

* **Structured Output**: 모든 Agent 출력을 Pydantic 모델로 강제 (`llm.with_structured_output(PydanticModel)`)하여 JSON 파싱 실패를 원천 차단. 한국어/영어 동시 생성을 위해 `_ko`/`_en` 접미사 필드를 스키마에 명시적으로 정의.

* **Function Calling**: Oracle Agent가 MCP Registry를 통해 `get_weather` (OpenWeather API), `search_trends` (Tavily API), `lookup_breed_info` (RAG 검색) 3개 Tool을 호출. 도구는 LangChain `@tool` 데코레이터로 정의(`backend/tools.py`)되고, MCP Bootstrap(`backend/mcp/bootstrap.py`)에서 레지스트리에 등록된 후 `_mcp_registry.execute(tool_name, **kwargs)` 형태로 실행됨.

**MCP 기반 파일·시스템·API 연동**

* MCP(Model Context Protocol) 레지스트리(`backend/mcp/registry.py`)를 통해 도구 실행을 추상화. `_mcp_registry.execute("get_weather", city="Seoul")` 형태로 Agent 코드에서 도구를 호출하며, MCP 부트스트래핑(`backend/mcp/bootstrap.py`)에서 사용 가능한 도구(WeatherTool, TrendsTool, RAGTool, RAGSearchTool, AdvancedRAGTool)를 자동 등록. 도구별 사용량·에러 카운트를 자동 추적하고, 런타임에 도구를 활성화/비활성화할 수 있음.

**A2A 기반 Agent 협업 구조**

* `AgentMemo` Pydantic 모델로 Agent 간 통신 규격을 정의:

  * `sender` / `receiver`: Agent ID ("oracle", "journalist", "vet", "all")

  * `memo_type`: "context" (배경정보), "alert" (긴급경고), "insight" (분석결과)

  * `priority`: "low", "medium", "high"

* `AgentCard`: 각 Agent의 능력 카드 (A2A 식별용) — agent_id, name, description, capabilities 필드

* `create_memo()`, `filter_memos_for()` 헬퍼 함수로 메모 생성/필터링을 간편하게 처리

* **실제 A2A 메모 흐름**:
  * Oracle → all: `context` 메모 — 날씨·트렌드·운세 키워드 전달
  * Journalist → vet: `insight` 메모 — 강아지 기분·일기 무드 전달
  * Vet → oracle: `alert` 메모 — 위험도 High/Critical일 때만 경고 (priority: high)

## 3. 주요 기능 및 동작 시나리오

### 3.1 사용자 시나리오(Use Case Scenario)

**시나리오 1: 신규 사용자 — 첫 일기 생성**

| 단계 | 사용자 행동                           | 시스템 동작                                           |
| -- | -------------------------------- | ------------------------------------------------ |
| 1  | 앱 접속, 온보딩 화면 확인                  | 앱 소개 애니메이션 표시                                    |
| 2  | 회원가입 (ID, 닉네임, 비밀번호 입력)          | user_id 패턴 검증 (`^[a-zA-Z0-9]{3,30}$`), bcrypt 해싱 |
| 3  | 반려견 프로필 등록 (이름, 66종 견종 선택, MBTI) | DogProfile 저장, JWT 토큰 발급                         |
| 4  | 홈 화면에서 "오늘의 일기 쓰기" 클릭            | NewDiary 페이지로 이동                                 |
| 5  | 오늘의 기분/식사/산책/배변 선택, 메모 입력        | DailyLog 스키마 검증                                  |
| 6  | "생성" 버튼 클릭                       | 3-Agent 파이프라인 실행 (7~17초)                         |
| 7  | 로딩 애니메이션 확인                      | Oracle→Journalist→Vet 순차 실행, A2A 메모 교환           |
| 8  | 결과 화면에서 운세/일기/건강 탭 확인            | DiaryEntry 저장, 탭 UI 렌더링                          |
| 9  | SSE 스트리밍으로 AI 댓글 수신              | Comment Agents가 3개 댓글을 3~45초 랜덤 딜레이로 순차 생성    |
| 10 | 일기 공유 버튼 클릭                      | share_token 생성, 공개 링크 제공                         |

**시나리오 2: 기존 사용자 — 일기 수정 및 건강 모니터링**

| 단계 | 사용자 행동                  | 시스템 동작                       |
| -- | ----------------------- | ---------------------------- |
| 1  | Push 알림으로 일기 작성 리마인더 수신 | 설정된 diary_time에 Web Push 발송  |
| 2  | 이전 일기의 건강분석 탭에서 위험도 확인  | CoT 4단계 분석 결과 표시             |
| 3  | 일기 내용 수정                | 기존 댓글 삭제 → 수정 반응 댓글 SSE 스트리밍 (2명, 5~60초 딜레이) |
| 4  | 근처 동물병원 검색 (건강 탭에서)     | Kakao Maps API로 위치 기반 병원 검색  |
| 5  | 소셜 피드에서 다른 사용자 일기 열람    | 공개 일기 목록 페이지네이션 조회           |

### 3.2 시스템 구조도 / Multi-Agent 다이어그램

**시스템 전체 구조도**

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React 19 + Vite)            │
│              PWA · i18n (5개 언어) · Motion 애니메이션     │
└───────────────────────┬─────────────────────────────────┘
                        │ REST API + SSE
┌───────────────────────▼─────────────────────────────────┐
│                  Backend (FastAPI)                        │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │         LangGraph Multi-Agent Pipeline            │   │
│  │           (StateGraph + MemorySaver)               │   │
│  │                                                    │   │
│  │  ┌──────────┐  A2A ctx  ┌────────────┐  A2A ins  │   │
│  │  │  Oracle   │──memo───▶│ Journalist  │──memo───▶ │   │
│  │  │ (운세)    │          │  (일기)     │           │   │
│  │  └─────┬─────┘          └─────┬──────┘           │   │
│  │        │                       │        ┌────────┐│   │
│  │  MCP Registry             Few-Shot+RAG  │  Vet   ││   │
│  │  execute()                (밈/SNS)      │ (건강) ││   │
│  │  ├ get_weather                          │ CoT+RAG││   │
│  │  ├ search_trends                        └───┬────┘│   │
│  │  └ lookup_breed_info            A2A alert ◀─┘     │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  MCP Server  │  │ RAG Pipeline│  │ 5 Comment Agents│ │
│  │  (Tool Reg.) │  │ (ChromaDB)  │  │ (SSE Streaming) │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Multi-Agent State 구조 (`AgentState`)**

```python
class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    dog_profile: dict     # name, breed, mbti, persona_type, language
    daily_logs: dict      # mood, food, walk, poop, notes
    agent_memos: list[dict]  # A2A 메모 리스트
    horoscope: dict | None
    diary: dict | None
    health: dict | None
```

### 3.3 서비스 플로우

```
[사용자 입력]                    [3-Agent Pipeline]                    [결과]
기분/식사/산책/배변  ──▶  Oracle ──▶ Journalist ──▶ Vet  ──▶  운세/일기/건강
      │                    │           │           │              │
      │               MCP Tools    RAG 밈/SNS    RAG 건강         │
      │              (날씨,트렌드)  + Few-Shot    + CoT 4단계      │
      │                    │           │           │              │
      │                    └───── A2A Memos ──────┘              │
      │                                                           │
      └──────────────────▶  Comment Agents (SSE)  ──▶  3개 AI 댓글
                            뽀삐언니/츄르대장/할배멍/
                            멍스타그램/Dr.왕왕 중 랜덤 3명
```

## 4. 실행 결과

**서비스 실행 결과**

서비스를 실행하면 다음과 같은 흐름으로 동작한다:

1. **서버 시작**: `docker compose up --build` 또는 `uvicorn backend.main:app --port 8000` 실행 시 FastAPI 서버가 시작되며, DB 테이블 초기화, Redis 연결, Admin 계정 자동 생성, APScheduler(SNS 수집 07:00 + Push 알림 매분) 시작이 순차적으로 이루어진다.

2. **회원가입/로그인**: POST `/api/v1/auth/signup` 호출 시 user_id 패턴 검증, bcrypt 해싱, JWT Access+Refresh 토큰 발급이 완료되며,
   `{"access_token": "eyJ...", "refresh_token": "eyJ...", "user": {"user_id": "testuser", "nickname": "테스터", "dog": {"name": "초코", "breed": "푸들", "mbti": "ENFP"}}}` 형태의 응답을 반환한다.

3. **일기 생성**: POST `/api/v1/diary/generate/{user_id}` 호출 시 Oracle → Journalist → Vet 순서로 Agent가 실행된다:

   * Oracle: MCP Registry를 통해 OpenWeather API로 서울 날씨 조회, Tavily로 강아지 트렌드 검색, ChromaDB에서 견종 정보 RAG 검색 후 한국어/영어 운세 동시 생성

   * Journalist: ChromaDB에서 밈/SNS/페르소나 데이터 검색, Oracle A2A 메모(context) 참조, 1인칭 강아지 시점 일기 생성

   * Vet: ChromaDB에서 견종 건강/질병 QA/KISTI 데이터 검색, Journalist A2A 메모(insight) 참조, CoT 4단계 분석 후 위험도 평가

4. **댓글 SSE 스트리밍**: GET `/api/v1/comments/stream/{user_id}/{entry_id}?mode=new&token=...` 호출 시 3명의 AI 캐릭터가 3~45초 랜덤 딜레이로 순차적으로 댓글을 생성하며 `data: {"author": "뽀삐언니", "emoji": "🐩", "text_ko": "초코야 오늘도 완전 열일했구나! 대박! 🎉", "text_en": "Choco you totally killed it today! Amazing! 🎉"}` 형태로 실시간 스트리밍된다.

5. **건강 분석 결과 예시**:

```text
위험도: Low
Step 1 (증상분석): 오늘 기분 '신남', 식사 '완식', 배변 '정상'으로 특이 증상 없음
Step 2 (기간맥락): 단일 기록이므로 장기 패턴 분석 불가, 현재 상태는 양호
Step 3 (견종특성): 푸들은 슬개골 탈구, 진행성 망막위축(PRA)에 취약하나 현재 관련 증상 미관찰
Step 4 (결론): 전반적으로 건강한 상태. 30분 산책은 푸들 체중 관리에 적절
조언: 슬개골 건강을 위해 미끄러운 바닥은 피하고, 정기적인 안과 검진을 권장합니다
```

## 5. 추가 아이디어

**데이터 품질 개선**

* 현재 정적 JSON 기반의 견종/질병 데이터를 실시간 수의학 논문 DB(PubMed Vet)와 연동하여 RAG 데이터 품질을 고도화

* SNS 데이터 수집 시 감성 분석 필터를 추가하여 저품질 콘텐츠를 자동 제거

* 사용자의 축적된 일기 데이터로 개인화된 건강 패턴 분석 모델 구축

* 현재 확장용으로 준비된 3종의 데이터(dog_personas, dog_disease_qa, kisti_diseases)를 수집·적재하여 RAG 검색 품질 고도화

**성능 최적화**

* Oracle Agent의 Horoscope 캐싱 전략을 확장하여 Journalist/Vet Agent에도 부분 캐싱 적용

* LLM 호출 병렬화: Oracle과 Journalist의 RAG 검색을 사전에 병렬 실행하여 전체 파이프라인 속도 개선

* 프론트엔드 코드 스플리팅(React.lazy)과 이미지 클라이언트 압축 적용

**알림 채널 확대**

* 현재 Web Push만 지원하는 알림을 카카오톡 알림톡, SMS, 이메일로 확대

* 건강 위험도가 High/Critical일 때 즉시 보호자에게 긴급 알림 발송

**UX 개선**

* 일기 생성 시 실제 Agent 진행 상태를 SSE로 실시간 표시 (Oracle 완료 → Journalist 진행 중 → ...)

* 월간/주간 건강 리포트 자동 생성 기능

* 강아지 사진 기반 AI 이미지 분석 (피부병, 눈 상태 등) 연동

* 다국어 확장: 일본어(ja), 중국어(zh), 스페인어(es) 추가 (i18n 인프라는 이미 5개 언어 지원 중)

**커뮤니티 기능 확장**

* 소셜 피드에 좋아요/댓글 기능 추가

* 같은 견종 보호자 매칭 기능

* 동물병원 리뷰 및 예약 연동

## 6. 프로젝트 수행 소감 / 피드백

**LangGraph 멀티 에이전트 설계에서 배운 점**

LangGraph의 StateGraph를 활용하여 3개의 Agent를 순차 파이프라인으로 연결하는 과정에서 Agent 간 상태(State) 관리의 중요성을 체감했다. 특히 A2A 프로토콜을 설계하며 Agent 간 전달할 정보의 형식과 우선순위를 구조화하는 것이 단순히 프롬프트를 잘 작성하는 것만큼 중요하다는 것을 배웠다. Oracle이 수집한 날씨·트렌드 정보가 Journalist의 일기 톤과 Vet의 건강 조언에 자연스럽게 반영되는 것을 확인하며 멀티 에이전트 협업의 실질적 가치를 느꼈다.

**Structured Output의 실전적 가치**

초기에는 LLM의 자유 텍스트 출력을 파싱하다가 빈번한 JSON 파싱 에러를 경험했다. Pydantic 모델로 Structured Output을 강제한 이후 파싱 에러가 완전히 사라졌고, 한국어/영어 동시 생성도 `_ko`/`_en` 필드를 스키마에 정의하는 것만으로 안정적으로 동작했다. 특히 Vet Agent의 CoT 4단계 분석을 각각의 필드로 분리하여 구조화한 것이 프론트엔드에서 단계별로 표시하기에 매우 유용했다.

**RAG 파이프라인 구축 경험**

다양한 데이터 소스(견종 정보, 밈, SNS, 페르소나, 질병 QA, KISTI 질병 분류)를 하나의 ChromaDB 컬렉션에 통합하면서 metadata 기반 필터링의 중요성을 깨달았다. `source_filter` 없이 전체 검색하면 밈 데이터가 건강 분석에 혼입되는 문제가 발생했고, 데이터 소스별 필터를 적용한 후 검색 품질이 크게 향상되었다.

**프로덕션 수준의 보안 구현**

QA 리포트에서 발견된 95건의 이슈(Critical 13건 포함)를 하나씩 해결하며 JWT 인증, Refresh Token Rotation with Reuse Detection, bcrypt 해싱, Path Traversal 방어, Rate Limiting 등 실전 보안의 깊이를 체험했다. 특히 Refresh Token 탈취 시나리오에 대비한 Token Family 기반 핵 폐기(Nuclear Revocation) 로직을 구현하며 보안 설계의 복잡성과 중요성을 실감했다.

**전반적 소감**

단순한 "챗봇" 수준을 넘어 MCP Tool Calling, RAG, A2A 협업, Structured Output, SSE 스트리밍, 비동기 태스크 큐까지 현대적인 AI Agent 시스템의 전체 스택을 경험할 수 있었다. 특히 "재미(운세) + 감성(일기) + 실용(건강)"이라는 세 가지 서로 다른 가치를 하나의 멀티 에이전트 파이프라인으로 통합하는 것이 기술적으로도, 사용자 경험 측면에서도 가장 도전적이면서 보람 있는 작업이었다.
