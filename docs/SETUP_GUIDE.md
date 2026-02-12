# 설치 가이드

처음부터 Paw-Palja를 실행하기 위한 단계별 가이드입니다.

---

## 방법 1: Docker (권장)

가장 빠르게 실행하는 방법입니다. PostgreSQL, ChromaDB가 자동으로 설정됩니다.

### 사전 요구사항

- Docker Desktop 설치 (Docker Engine 24+, Docker Compose V2)
- LLM API 키 (아래 중 하나):
  - Google Gemini API Key → [Google AI Studio](https://aistudio.google.com/) 에서 발급
  - Azure OpenAI API Key → Azure Portal에서 발급

### 단계

```bash
# 1. 저장소 클론
git clone <repo-url>
cd pawpalja

# 2. 환경변수 설정
cp .env.example .env
```

`.env` 파일을 편집하여 최소한 다음 값을 설정합니다:

```env
# LLM Provider 선택 (google 또는 azure)
LLM_PROVIDER=google

# Google Gemini 사용 시
GOOGLE_API_KEY=your_google_api_key_here

# Azure OpenAI 사용 시 (LLM_PROVIDER=azure로 변경)
# AOAI_API_KEY=your_azure_key
# AOAI_ENDPOINT=https://your-resource.openai.azure.com/

# PostgreSQL 비밀번호 (Docker에서 자동 생성)
DB_PASSWORD=change_this_db_password
```

```bash
# 3. Docker Compose로 실행
docker compose up --build

# 첫 실행 시 빌드에 3~5분 소요됩니다.
# "Application startup complete" 메시지가 나오면 준비 완료!
```

```bash
# 4. 브라우저에서 접속
open http://localhost:8000
```

### Docker 구성

`docker compose up --build` 명령으로 다음이 자동으로 실행됩니다:

| 서비스 | 설명 | 포트 |
|---|---|---|
| **db** | PostgreSQL 16 데이터베이스 | 5432 (내부) |
| **backend** | FastAPI + 프론트엔드 (빌드 포함) | 8000 |

- PostgreSQL은 자동으로 `pawpalja` 데이터베이스를 생성합니다.
- ChromaDB는 컨테이너 내 `data/chroma/` 디렉토리에 자동 초기화됩니다.
- RAG 데이터(`data/raw/`)는 이미지 빌드 시 자동으로 포함됩니다.
- 프론트엔드는 멀티스테이지 빌드로 자동 빌드되어 백엔드에서 서빙됩니다.

### Docker 중지 & 데이터 초기화

```bash
# 중지
docker compose down

# 중지 + 데이터 삭제 (PostgreSQL 데이터 포함)
docker compose down -v
```

---

## 방법 2: 로컬 개발 환경

Docker 없이 직접 실행하는 방법입니다.

### 사전 요구사항

- Python 3.11 이상
- Node.js 18 이상
- LLM API 키 (Google Gemini 또는 Azure OpenAI)

### 단계

```bash
# 1. 저장소 클론
git clone <repo-url>
cd pawpalja

# 2. Python 가상환경 설정
python3 -m venv venv
source venv/bin/activate    # macOS/Linux
# venv\Scripts\activate     # Windows

# 3. Python 의존성 설치
pip install -r requirements.txt

# 4. 프론트엔드 빌드
cd frontend
npm install
npm run build
cd ..

# 5. 환경변수 설정
cp .env.example .env
# .env 파일을 편집하여 API 키 입력

# 6. 서버 실행
uvicorn backend.main:app --port 8000

# 7. 브라우저에서 접속
# http://localhost:8000
```

### 로컬 개발 모드 (Hot Reload)

프론트엔드를 수정하면서 개발할 때:

```bash
# 터미널 1: 백엔드 (자동 리로드)
uvicorn backend.main:app --port 8000 --reload

# 터미널 2: 프론트엔드 (HMR)
cd frontend
npm run dev
# → http://localhost:3000 (API는 :8000으로 자동 프록시)
```

### 로컬 데이터베이스

- 로컬에서는 SQLite가 자동으로 사용됩니다 (`data/pawpalja.db`).
- PostgreSQL을 사용하려면 `.env`에서 `DATABASE_URL`을 설정하세요.

---

## 환경변수 상세

### 필수 설정

| 변수 | 값 예시 | 설명 |
|---|---|---|
| `LLM_PROVIDER` | `google` | `google` 또는 `azure` 중 택 1 |
| `GOOGLE_API_KEY` | `AIza...` | Google Gemini API 키 (LLM_PROVIDER=google일 때) |
| `AOAI_API_KEY` | `abc...` | Azure OpenAI API 키 (LLM_PROVIDER=azure일 때) |
| `AOAI_ENDPOINT` | `https://...openai.azure.com/` | Azure OpenAI 엔드포인트 (azure일 때) |

### 선택 설정 (외부 도구)

| 변수 | 용도 | 미설정 시 |
|---|---|---|
| `TAVILY_API_KEY` | 트렌드 검색 (Oracle Agent) | 트렌드 데이터 없이 운세 생성 |
| `OPENWEATHER_API_KEY` | 날씨 정보 (Oracle Agent) | 날씨 데이터 없이 운세 생성 |
| `APIFY_API_KEY` | SNS 데이터 수집 | 기존 로컬 데이터만 사용 |
| `KAKAO_REST_API_KEY` | 동물병원 검색 | 병원 검색 비활성화 |

### 보안 설정

| 변수 | 기본값 | 설명 |
|---|---|---|
| `JWT_SECRET` | (자동 생성) | 미설정 시 임시 키 자동 생성 (재시작마다 세션 초기화) |
| `ADMIN_PASSWORD` | `change_this_admin_password` | 관리자 비밀번호 |
| `ALLOWED_ORIGINS` | `http://localhost:3000,...` | CORS 허용 도메인 |
| `DB_PASSWORD` | `change_this_db_password` | PostgreSQL 비밀번호 (Docker용) |

---

## 사용 방법

### 1. 회원가입

1. 브라우저에서 `http://localhost:8000` 접속
2. "회원가입" 클릭
3. 아이디, 비밀번호, 반려견 이름, 견종(66종 중 선택), MBTI 입력
4. 회원가입 완료 후 온보딩 진행

### 2. 일기 생성

1. 홈 화면에서 "오늘의 일기 생성" 버튼 클릭
2. 반려견의 기분, 건강 상태, 오늘의 활동을 입력
3. 3개의 AI Agent가 순차적으로 실행:
   - Oracle: 오늘의 운세 생성
   - Journalist: 1인칭 강아지 시점 일기 작성
   - Vet: 건강 분석 및 조언
4. 생성 완료 후 운세/일기/건강 탭으로 결과 확인

### 3. 댓글 확인

- 일기 생성 후 자동으로 5명의 AI 캐릭터가 댓글을 작성합니다.
- SSE 스트리밍으로 실시간으로 댓글이 도착하는 것을 볼 수 있습니다.

### 4. 관리자 대시보드

- 로그인 후 프로필 > 관리자 대시보드 접속
- 사용자 통계, 시스템 상태, Agent 성능 모니터링

---

## 문제 해결

### Docker 빌드 실패

```bash
# Docker 캐시 초기화 후 재빌드
docker compose down -v
docker compose build --no-cache
docker compose up
```

### ChromaDB 초기화 에러

```bash
# ChromaDB 데이터 초기화
rm -rf data/chroma/
# 서버 재시작 시 자동으로 재생성됩니다
```

### LLM API 에러

- `.env` 파일에서 API 키가 올바르게 설정되었는지 확인
- `LLM_PROVIDER`와 API 키가 일치하는지 확인 (google→GOOGLE_API_KEY, azure→AOAI_API_KEY)
- API 키에 사용량 제한이 걸려있지 않은지 확인

### 포트 충돌

```bash
# 8000번 포트가 이미 사용 중인 경우
lsof -i :8000
# 해당 프로세스를 종료하거나, 다른 포트로 실행
uvicorn backend.main:app --port 8001
```
