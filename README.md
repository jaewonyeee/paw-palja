# Paw-Palja (포팔자)

> **반려견 운세 기반 육아일기 & 건강 관리 AI Agent 앱**
>
> LangGraph Multi-Agent 시스템이 반려견의 하루를 운세·일기·건강 3가지 관점에서 자동 생성하고,
> 5명의 AI 댓글 캐릭터가 SNS처럼 실시간 반응합니다.

---

## 평가항목 매핑

| 평가항목 | 구현 위치 | 설명 |
|---|---|---|
| **Multi-Agent** | `backend/agents.py` | LangGraph StateGraph 기반 Oracle→Journalist→Vet 3-Agent 파이프라인 |
| **A2A Protocol** | `backend/a2a_protocol.py` | Agent 간 메모(Memo) 교환을 통한 컨텍스트 공유 |
| **MCP (Model Context Protocol)** | `backend/mcp/` | Tool Registry + Server + 5개 도구 (날씨, 트렌드, RAG 등) |
| **RAG** | `backend/rag_pipeline.py`, `rag_advanced.py` | ChromaDB 벡터 검색 + Hybrid Search + Re-ranking + Context Compression |
| **Prompt Engineering** | `backend/prompt_engineering.py` | Self-Consistency, Few-Shot Enhancement, Chain-of-Thought |
| **Function Calling** | `backend/tools.py` | Oracle Agent의 외부 API 호출 (날씨, 트렌드, 견종 정보) |
| **Structured Output** | `backend/schemas.py` | Pydantic 모델로 모든 Agent 출력 스키마 강제 |
| **LLM 활용** | `backend/llm_provider.py` | Google Gemini / Azure OpenAI 전환 지원 |

---

## 아키텍처 개요

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
│  │                                                    │   │
│  │  ┌──────────┐   A2A    ┌────────────┐   A2A      │   │
│  │  │  Oracle   │──memo──▶│ Journalist  │──memo──▶   │   │
│  │  │ (운세)    │         │  (일기)     │            │   │
│  │  └─────┬─────┘         └─────┬──────┘            │   │
│  │        │                      │         ┌────────┐│   │
│  │   Tool Calling           Few-Shot+RAG   │  Vet   ││   │
│  │   (MCP Tools)            (밈/SNS)       │ (건강) ││   │
│  │                                         │ CoT+RAG││   │
│  │                                         └────────┘│   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  MCP Server  │  │ RAG Pipeline│  │ 5 Comment Agents│ │
│  │  (Tool Reg.) │  │ (ChromaDB)  │  │ (SSE Streaming) │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────┘
         │                    │
    ┌────▼────┐         ┌────▼────┐
    │ External│         │ChromaDB │
    │  APIs   │         │Vector DB│
    │날씨/트렌드│         │견종/밈/SNS│
    └─────────┘         └─────────┘
```

---

## 빠른 시작 (Docker)

```bash
# 1. 저장소 클론
git clone <repo-url>
cd pawpalja

# 2. 환경변수 설정
cp .env.example .env
# .env 파일을 열어 최소한 다음 값을 설정:
#   LLM_PROVIDER=google
#   GOOGLE_API_KEY=your_key_here

# 3. Docker로 실행 (한 번에)
docker compose up --build

# 4. 브라우저에서 접속
# http://localhost:8000
```

> 상세한 설정 가이드는 [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md)를 참고하세요.

---

## 빠른 시작 (로컬 개발)

```bash
# Python 가상환경
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 프론트엔드 빌드
cd frontend && npm install && npm run build && cd ..

# 환경변수
cp .env.example .env
# .env 편집하여 API 키 입력

# 서버 실행
uvicorn backend.main:app --port 8000

# → http://localhost:8000
```

---

## 기술 스택

| 레이어 | 기술 |
|---|---|
| LLM | Google Gemini 2.0 Flash / Azure OpenAI GPT-4o (전환 가능) |
| Agent Framework | LangGraph + LangChain |
| Vector DB | ChromaDB (RAG 임베딩) |
| Backend | Python 3.11+ · FastAPI |
| Frontend | React 19 · Vite · PWA · Motion.dev |
| Database | PostgreSQL (프로덕션) / SQLite (개발) |
| Container | Docker · Docker Compose |
| i18n | 한국어, 영어, 일본어, 중국어, 스페인어 |

---

## 프로젝트 구조

```
pawpalja/
├── backend/
│   ├── main.py                 # FastAPI 앱 진입점
│   ├── agents.py               # LangGraph Multi-Agent (Oracle/Journalist/Vet)
│   ├── comment_agents.py       # 5 Persona 댓글 에이전트 (SSE 스트리밍)
│   ├── rag_pipeline.py         # ChromaDB RAG 파이프라인
│   ├── rag_advanced.py         # Advanced RAG (Hybrid Search, Re-ranking)
│   ├── prompt_engineering.py   # Self-Consistency, Few-Shot, CoT
│   ├── a2a_protocol.py         # A2A Agent 간 통신 프로토콜
│   ├── tools.py                # Function Calling 도구
│   ├── schemas.py              # Structured Output (Pydantic)
│   ├── llm_provider.py         # Google/Azure LLM 스위칭
│   ├── mcp/                    # MCP (Model Context Protocol) 구현
│   │   ├── bootstrap.py        # 도구 자동 등록 및 초기화
│   │   ├── registry.py         # Tool Registry (메타데이터, 버전, 실행)
│   │   ├── server.py           # MCP 서버 구현
│   │   └── tools/              # MCP 도구들 (날씨, 트렌드, RAG)
│   └── routes/                 # API 라우터 모듈
├── frontend/                   # React 19 + Vite 프론트엔드
├── data/raw/                   # RAG 소스 데이터 (견종, 밈)
├── docs/                       # 상세 문서
│   ├── ARCHITECTURE.md         # 아키텍처 상세
│   ├── PROMPT_ENGINEERING.md   # 프롬프트 엔지니어링 기법
│   └── SETUP_GUIDE.md          # 설치 가이드
├── docker-compose.yml          # Docker 실행 (한 번에)
├── .env.example                # 환경변수 템플릿
└── requirements.txt            # Python 의존성
```

---

## 상세 문서

- [아키텍처 상세](docs/ARCHITECTURE.md) — Multi-Agent, RAG, MCP, A2A 구조
- [프롬프트 엔지니어링](docs/PROMPT_ENGINEERING.md) — Self-Consistency, Few-Shot, CoT 기법
- [설치 가이드](docs/SETUP_GUIDE.md) — 처음부터 실행까지 단계별 가이드

---

## 환경변수

`.env.example`을 복사하여 `.env`로 만든 후 값을 설정합니다.

| 변수 | 필수 | 설명 |
|---|---|---|
| `LLM_PROVIDER` | O | `google` 또는 `azure` |
| `GOOGLE_API_KEY` | O* | Google Gemini API 키 |
| `AOAI_API_KEY` | O* | Azure OpenAI API 키 |
| `TAVILY_API_KEY` | - | 트렌드 검색 (MCP Tool) |
| `OPENWEATHER_API_KEY` | - | 날씨 정보 (MCP Tool) |
| `JWT_SECRET` | 자동 | 미설정 시 자동 생성 (재시작마다 세션 초기화) |

\* `LLM_PROVIDER`에 따라 Google 또는 Azure 키 중 하나 필수

---

## API 엔드포인트

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/v1/diary/generate/{user_id}` | 오늘의 일기 생성 (3 Agent 파이프라인) |
| GET | `/api/v1/comments/stream/{user_id}/{entry_id}` | SSE 실시간 댓글 스트리밍 |
| POST | `/api/v1/auth/signup` | 회원가입 (66종 견종 선택) |
| POST | `/api/v1/auth/login` | 로그인 |
| GET | `/api/v1/diary/list/{user_id}` | 일기 목록 |
| GET | `/health` | 헬스체크 |

---

## 보안

- **비밀번호 해싱**: bcrypt (SHA-256 레거시 해시 자동 마이그레이션)
- **Path Traversal 방어**: `pathlib.resolve()` + `is_relative_to()` 검증
- **CORS**: 환경변수로 허용 도메인 제한 (`ALLOWED_ORIGINS`)
- **입력값 검증**: Pydantic `Field` 제약 (길이 제한, 이미지 5MB, 정규식 패턴)
- **JWT 인증**: Access Token + Refresh Token, 자동 갱신
- **Rate Limiting**: SlowAPI 기반 엔드포인트별 제한

---

## License

MIT
