# Paw-Palja (포팔자)

반려견 운세 기반 육아일기 & 건강 관리 AI Agent 앱

LangGraph 멀티 에이전트 시스템이 반려견의 하루를 운세, 일기, 건강 분석 3가지 관점에서 자동 생성하고, 5명의 AI 댓글 캐릭터가 SNS처럼 실시간 반응합니다.

---

## Tech Stack

| Layer | Technology |
|---|---|
| LLM | Google Gemini 2.0 Flash / Azure OpenAI (전환 가능) |
| Agent Framework | LangGraph + LangChain |
| Vector DB | ChromaDB (RAG 임베딩) |
| Backend | Python 3.14 + FastAPI |
| Frontend | React 19 + Vite |
| Animation | Motion.dev |
| Storage | JSON file-based + ChromaDB |
| Container | Docker |

---

## Architecture

### Multi-Agent Pipeline (A2A Protocol)

```
Oracle Agent (운세) → Journalist Agent (일기) → Vet Agent (건강)
     ↓ memo                ↓ memo                ↓ memo
  날씨+트렌드 참조      감성+밈 참조 일기        증상 분석+조언
```

- **Oracle** (temp 0.8) : 날씨, 트렌드, 견종 정보를 Tool Calling으로 수집 → 오늘의 운세 생성
- **Journalist** (temp 0.9) : RAG로 밈/SNS 트렌드 검색 → 강아지 1인칭 육아일기 작성
- **Vet** (temp 0.3) : CoT 4단계 추론 → 견종별 건강 리스크 분석 및 조언

### 5 Comment Agents (SSE 실시간 스트리밍)

| Persona | Emoji | 성격 |
|---|---|---|
| 뽀삐언니 | 🐩 | 에너지 넘치는 옆집 강아지 |
| 츄르대장 | 🐱 | 쿨한 고양이, 은근 관심 |
| 할배멍 | 🦮 | 따뜻한 어르신 멍멍이 |
| 멍스타그램 | 📸 | SNS 인플루언서 |
| Dr.왕왕 | 🩺 | 수의학 전문 멍멍이 |

---

## Project Structure

```
pawpalja/
├── backend/
│   ├── main.py              # FastAPI 앱 (라우터 등록, 정적파일 서빙)
│   ├── routes/              # API 라우터 모듈
│   │   ├── auth.py          # 인증 (로그인/회원가입/사용자)
│   │   ├── diary.py         # 다이어리 CRUD
│   │   ├── comments.py      # 댓글 생성/SSE 스트리밍
│   │   ├── agents.py        # 에이전트 단독 실행/RAG/SNS
│   │   ├── admin.py         # 어드민 대시보드
│   │   └── hospitals.py     # 위치 기반 동물병원 검색
│   ├── agents.py            # LangGraph 멀티 에이전트 (Oracle/Journalist/Vet)
│   ├── comment_agents.py    # 5 댓글 캐릭터 에이전트
│   ├── schemas.py           # Pydantic 모델 (Structured Output)
│   ├── user_store.py        # JSON 파일 기반 사용자/일기 저장소
│   ├── llm_provider.py      # Google/Azure LLM 스위칭
│   ├── rag_pipeline.py      # ChromaDB RAG 파이프라인
│   ├── tools.py             # Agent 도구 정의
│   ├── a2a_protocol.py      # Agent 간 통신 프로토콜
│   ├── chroma_compat.py     # ChromaDB pydantic.v1 호환 패치
│   ├── fetch_sns_data.py    # Apify SNS 데이터 수집
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # 루트 라우팅 + ErrorBoundary
│   │   ├── api.js           # API 클라이언트
│   │   ├── components/
│   │   │   └── DiaryCard.jsx
│   │   ├── utils/
│   │   │   └── date.js      # 날짜 유틸
│   │   └── pages/
│   │       ├── Home.jsx         # 홈 (오늘 일기 + 목록)
│   │       ├── NewDiary.jsx     # 일기 생성 (단계별 입력)
│   │       ├── DiaryDetail.jsx  # 일기 상세 (운세/일기/건강 탭)
│   │       ├── Onboarding.jsx   # 온보딩
│   │       ├── Login.jsx        # 로그인
│   │       ├── Signup.jsx       # 회원가입 (66종 견종)
│   │       ├── Profile.jsx      # 프로필/설정
│   │       └── Admin.jsx        # 어드민 대시보드
│   ├── vite.config.js       # Vite 설정 (프록시, 빌드 경로)
│   └── package.json
├── data/
│   ├── raw/                 # 견종/밈/SNS 원본 데이터
│   └── users/               # 사용자/일기 JSON 파일
├── docker-compose.yml
├── requirements.txt
└── .env.template
```

---

## Getting Started

### Prerequisites

- Python 3.11+ (권장: 3.14)
- Node.js 18+
- Google Gemini API Key (또는 Azure OpenAI)

### 1. 환경 설정

```bash
# 저장소 클론
git clone <repo-url>
cd pawpalja

# Python 가상환경
python3 -m venv venv
source venv/bin/activate

# 의존성 설치
pip install -r requirements.txt

# 환경변수 설정
cp .env.template .env
# .env 파일을 열어 API 키를 입력하세요
```

### 2. 프론트엔드 빌드

```bash
cd frontend
npm install
npm run build    # → dist/ 에 빌드 결과물 생성
```

### 3. 서버 실행

```bash
# 프로젝트 루트에서
uvicorn backend.main:app --port 8000
```

`http://localhost:8000` 으로 접속하면 앱이 실행됩니다.

### 4. 개발 모드 (Frontend HMR)

프론트엔드를 수정하면서 개발할 때:

```bash
# 터미널 1: 백엔드
uvicorn backend.main:app --port 8000 --reload

# 터미널 2: 프론트엔드 (HMR)
cd frontend
npm run dev      # → http://localhost:3000 (API는 :8000으로 프록시)
```

### 5. Docker 실행

```bash
docker compose up --build
```

---

## Environment Variables

`.env.template`을 복사하여 `.env`로 만든 후 값을 채우세요.

| 변수 | 필수 | 설명 |
|---|---|---|
| `LLM_PROVIDER` | O | `google` 또는 `azure` |
| `GOOGLE_API_KEY` | O* | Google Gemini API 키 |
| `AOAI_API_KEY` | O* | Azure OpenAI API 키 |
| `AOAI_ENDPOINT` | - | Azure OpenAI 엔드포인트 |
| `TAVILY_API_KEY` | - | Tavily 검색 도구 |
| `OPENWEATHER_API_KEY` | - | 날씨 정보 도구 |
| `APIFY_API_KEY` | - | SNS 데이터 수집 |
| `KAKAO_REST_API_KEY` | - | 카카오 지도 (동물병원 검색) |
| `ADMIN_PASSWORD` | - | 관리자 비밀번호 (기본: `admin!`) |
| `ALLOWED_ORIGINS` | - | CORS 허용 도메인 (기본: `localhost`) |
| `CHROMA_PATH` | - | ChromaDB 경로 (기본: `./data/chroma`) |

\* LLM_PROVIDER에 따라 Google 또는 Azure 키 중 하나 필수

---

## API Endpoints

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/auth/signup` | 회원가입 |
| POST | `/auth/login` | 로그인 |
| GET | `/auth/check-id/{user_id}` | 아이디 중복 확인 |
| GET | `/user/{user_id}` | 사용자 정보 조회 |
| PUT | `/user/{user_id}` | 사용자 정보 수정 |

### Diary
| Method | Path | Description |
|---|---|---|
| POST | `/diary/generate/{user_id}` | 오늘의 일기 생성 (3 Agent 파이프라인) |
| GET | `/diary/list/{user_id}` | 일기 목록 조회 |
| GET | `/diary/entry/{user_id}/{entry_id}` | 일기 상세 조회 |
| PUT | `/diary/edit/{user_id}/{entry_id}` | 일기 수정 |
| DELETE | `/diary/{user_id}/{entry_id}` | 일기 삭제 |

### Comments
| Method | Path | Description |
|---|---|---|
| POST | `/comments/generate` | 댓글 생성 (batch) |
| GET | `/comments/stream/{user_id}/{entry_id}?mode=new\|edit` | SSE 실시간 댓글 스트리밍 |

### Analysis (Agent 단독 실행)
| Method | Path | Description |
|---|---|---|
| POST | `/analyze` | 전체 분석 (Oracle+Journalist+Vet) |
| POST | `/horoscope` | Oracle Agent 단독 |
| POST | `/diary` | Journalist Agent 단독 |
| POST | `/health` | Vet Agent 단독 |

### Other
| Method | Path | Description |
|---|---|---|
| GET | `/health` | 서버 헬스체크 |
| GET | `/hospitals/nearby?lat=&lng=` | 위치 기반 동물병원 검색 |
| POST | `/rag/ingest` | RAG 데이터 재적재 |
| GET | `/rag/search?q=&k=` | RAG 벡터 검색 (k: 1~20) |
| GET | `/admin/stats` | 어드민 통계 (인가 필요) |
| GET | `/admin/system` | 시스템 정보 (인가 필요) |

---

## Security

- **비밀번호 해싱**: bcrypt (SHA-256 레거시 해시 자동 마이그레이션)
- **Path Traversal 방어**: `pathlib.resolve()` + `is_relative_to()` 검증
- **CORS**: 환경변수로 허용 도메인 제한 (`ALLOWED_ORIGINS`)
- **입력값 검증**: Pydantic `Field` 제약 (길이 제한, 이미지 5MB, 정규식 패턴)
- **user_id 검증**: `^[a-zA-Z0-9]{3,30}$` 정규식으로 경로 조작 방지
- **에러 메시지 정제**: 내부 예외를 클라이언트에 노출하지 않음
- **어드민 인가**: `x-user-id` 헤더 기반 접근 제어
- **파일 잠금**: `fcntl` Advisory Lock으로 동시 쓰기 경합 방지
- **ErrorBoundary**: 프론트엔드 전역 에러 캐치 및 복구 UI

---

## Key Technical Notes

- **Python 3.14 + ChromaDB**: `chroma_compat.py`에서 pydantic.v1 호환 monkey-patch 적용
- **Embedding 모델**: `models/gemini-embedding-001` 사용 (`models/embedding-001`이 아님)
- **Dual API Key**: `GOOGLE_API_KEY`와 `GEMINI_API_KEY`가 동시에 설정되면 `GEMINI_API_KEY`를 자동 제거
- **Structured Output**: 모든 Agent 출력은 Pydantic 모델로 스키마 강제 (파싱 오류 방지)
- **Admin 계정**: 서버 시작 시 자동 생성 (비밀번호는 `ADMIN_PASSWORD` 환경변수로 설정)
