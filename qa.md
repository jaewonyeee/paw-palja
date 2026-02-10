# Paw-Palja QA Report

**검증일:** 2026-02-10
**검증 범위:** Backend (Python/FastAPI) + Frontend (React/Vite) 전체 코드
**총 발견 이슈:** 95건 (Critical 13 / High 21 / Medium 38 / Low 23)

---

## 1. Critical Issues (즉시 수정 필요)

### SEC-001. 인증/인가 시스템 미구현
- **범위:** 전체 API 엔드포인트
- **설명:** JWT/세션 기반 인증이 없음. 모든 엔드포인트가 `user_id`만으로 접근 가능
- **영향:** 타 사용자 일기 조회/수정/삭제, 어드민 API 무단 접근 가능
- **재현:**
  ```bash
  curl http://localhost:8000/diary/list/admin
  curl -X DELETE http://localhost:8000/diary/admin/entry123
  curl http://localhost:8000/admin/stats
  ```
- **권장:** JWT 토큰 기반 인증 + 미들웨어 적용

### SEC-002. 정적 파일 서빙 Path Traversal
- **파일:** `backend/main.py:75-80`
- **설명:** `serve_spa(full_path)` 에서 경로 검증 없이 `os.path.join` 사용
- **영향:** `../../.env`, `../../backend/user_store.py` 등 서버 파일 읽기 가능
- **재현:** `GET /../../.env`
- **권장:** `pathlib.Path.resolve()` 후 `is_relative_to()` 검증 추가

### SEC-003. 취약한 비밀번호 해싱
- **파일:** `backend/user_store.py:19-20`
- **설명:** SHA-256 단순 해싱 (salt 없음, stretching 없음)
- **영향:** Rainbow table 공격으로 전체 비밀번호 노출 가능
- **권장:** `bcrypt` 또는 `argon2` 로 교체

### SEC-004. 하드코딩된 관리자 계정
- **파일:** `backend/main.py:51-53`
- **설명:** 관리자 ID `admin`, PW `admin!`가 소스코드에 노출
- **권장:** 환경변수로 관리하거나 최초 설정 워크플로우 구현

### SEC-005. CORS 전체 허용
- **파일:** `backend/main.py:35-40`
- **설명:** `allow_origins=["*"]` 설정으로 모든 도메인에서 API 접근 가능
- **영향:** CSRF 공격 가능
- **권장:** 프로덕션에서 특정 도메인만 허용

### DATA-001. 파일 I/O 레이스 컨디션
- **파일:** `backend/user_store.py` (전체 CRUD 함수)
- **설명:** JSON 파일 읽기-수정-쓰기 간 동시 요청 시 데이터 손실
- **영향:** 동시 일기 저장 시 한 쪽 데이터 유실
- **권장:** 파일 잠금(`fcntl.flock`) 적용 또는 DB 전환

### MEM-001. EventSource 메모리 누수
- **파일:** `frontend/src/pages/DiaryDetail.jsx`
- **설명:** 페이지 전환 시 EventSource가 정리되지 않는 경우 존재
- **영향:** 다중 SSE 연결 누적, 중복 댓글 수신
- **권장:** cleanup 함수에서 ESRef 확실히 close, 새 ES 시작 전 기존 close

### VAL-001. 이미지 업로드 검증 부재
- **파일 (FE):** `frontend/src/pages/NewDiary.jsx`
- **파일 (BE):** `backend/schemas.py`
- **설명:** 클라이언트 3MB 제한만 존재, 서버측 검증 없음. SVG XSS 가능
- **영향:** 100MB+ 페이로드 전송, 악성 SVG로 XSS 공격
- **권장:** 서버측 파일 크기/MIME 타입 검증 추가

### PERF-001. 동기 I/O가 비동기 엔드포인트 차단
- **파일:** 전체 라우터
- **설명:** `async def` 함수 내에서 동기 파일 I/O(`user_store.*`) 호출
- **영향:** 한 요청의 파일 I/O가 전체 이벤트 루프 차단
- **권장:** `aiofiles` 사용 또는 `run_in_executor`로 감싸기

### PERF-002. LLM 호출이 이벤트 루프 차단
- **파일:** `backend/routes/diary.py:45`
- **설명:** `agent_graph.invoke()`가 동기 호출 (5-30초 소요)
- **영향:** 일기 생성 중 서버 전체 응답 불가
- **권장:** `asyncio.to_thread()` 또는 백그라운드 태스크로 전환

### SEC-006. localStorage 사용자 데이터 미검증
- **파일:** `frontend/src/App.jsx:19-26`
- **설명:** localStorage의 JSON을 파싱 후 스키마 검증 없이 사용
- **영향:** DevTools로 조작된 데이터로 권한 상승 가능
- **권장:** 필수 필드 검증, 서버 세션과 동기화

### RACE-001. DiaryDetail 데이터 정합성
- **파일:** `frontend/src/pages/DiaryDetail.jsx`
- **설명:** fresh fetch 완료 전에 SSE가 시작되어 stale 데이터 기반 댓글 생성
- **권장:** fresh fetch 완료 후 SSE 시작하도록 순서 보장

### SEC-007. 어드민 엔드포인트 인가 미구현
- **파일:** `backend/routes/admin.py`
- **설명:** `/admin/stats`, `/admin/system` 엔드포인트에 권한 확인 없음
- **영향:** 일반 사용자가 모든 사용자 정보 조회 가능

---

## 2. High Issues (프로덕션 전 수정 필요)

| ID | 분류 | 파일 | 설명 |
|---|---|---|---|
| SEC-008 | Security | `user_store.py` | user_id 경로 순회 가능성 (IDOR) |
| SEC-009 | Security | `routes/agents.py` | 에러 응답에 시스템 정보 노출 (`str(e)`) |
| SEC-010 | Security | API 전체 | Rate limiting 미구현 (브루트포스 취약) |
| SEC-011 | Security | `routes/admin.py:46` | LLM_PROVIDER 환경변수 값 외부 노출 |
| DATA-002 | Data | `user_store.py:132` | entry_id가 UUID 앞 8자리 (충돌 가능성) |
| DATA-003 | Data | `routes/diary.py:79-95` | 일기 수정 시 댓글 삭제~반환 간 원자성 미보장 |
| DATA-004 | Data | `routes/comments.py:36-50` | SSE 스트림 중 파일 I/O 실패 시 복구 불가 |
| VAL-002 | Validation | `schemas.py` | 문자열 필드 길이 제한 없음 (DoS 가능) |
| VAL-003 | Validation | `routes/diary.py:67` | `limit` 파라미터 상한 없음 |
| VAL-004 | Validation | `routes/agents.py:103` | RAG 검색 `k` 파라미터 무제한 |
| UX-001 | Frontend | `pages/Home.jsx` | 네트워크 오류와 빈 목록 구분 불가 |
| UX-002 | Frontend | `pages/DiaryDetail.jsx` | `alert()` 사용 (blocking UX) |
| UX-003 | Frontend | `pages/NewDiary.jsx` | API 오류 시 입력 데이터 전체 유실 |
| UX-004 | Frontend | `pages/Signup.jsx` | ID 중복 확인 debounce 미적용 (경쟁 상태) |
| PERF-003 | Performance | `routes/admin.py` | 전체 사용자 파일 메모리 로드 (페이지네이션 없음) |
| PERF-004 | Performance | `user_store.py:149` | `get_diary_by_id`가 전체 파일 순회 |
| PERF-005 | Performance | Frontend | 코드 스플리팅 미적용 (단일 번들 591KB) |
| A11Y-001 | Accessibility | `pages/DiaryDetail.jsx` | 모달/드롭다운 키보드 네비게이션 불가 |
| A11Y-002 | Accessibility | `pages/Signup.jsx` | 견종 드롭다운 `role="combobox"` 미적용 |
| ERR-001 | Error | `comment_agents.py` | LLM 실패 시 silent fallback (디버깅 불가) |
| ERR-002 | Error | Frontend 전체 | ErrorBoundary 미적용 (화이트스크린 위험) |

---

## 3. Medium Issues (다음 스프린트 수정 권장)

| ID | 분류 | 설명 |
|---|---|---|
| VAL-005 | Validation | `diary_time` 형식(HH:MM) 미검증 |
| VAL-006 | Validation | 닉네임 길이/특수문자 미검증 |
| VAL-007 | Validation | 비밀번호 복잡도 요구사항 없음 |
| DATA-005 | Data | 사용자 삭제 시 일기 파일 고아 가능성 |
| DATA-006 | Data | `save_diary_entry` 날짜를 항상 오늘로 강제 |
| API-001 | API | 일기 목록 offset/cursor 페이지네이션 미구현 |
| API-002 | API | 에러 응답 포맷 불일치 (`{"error":...}` vs HTTPException) |
| API-003 | API | 헬스체크 엔드포인트(`/health`) 없음 |
| CODE-001 | Code | `_get_agent_graph()` + `_prepare_state()` 라우터 간 중복 |
| CODE-002 | Code | `agents.py:47` 연도 "2025" 하드코딩 |
| CODE-003 | Code | 구조화된 로깅 시스템 없음 |
| CODE-004 | Code | 환경변수 유효성 검증 (시작 시 미실행) |
| UX-005 | Frontend | Profile 페이지에서 정보 수정 불가 |
| UX-006 | Frontend | 위치 권한 거부 시 병원 리스트에 에러 표시 |
| UX-007 | Frontend | html2canvas 처리 중 시각적 피드백 부족 |
| UX-008 | Frontend | `todayString()` 타임존 이슈 (서버와 불일치 가능) |
| UX-009 | Frontend | 로그인 실패 후 오류 메시지 잔존 |
| UX-010 | Frontend | 이미지 로드 실패 시 broken 이미지 표시 |
| UX-011 | Frontend | 일기 생성 진행률 메시지가 API 실제 상태와 무관 |
| A11Y-003 | Accessibility | 포커스 표시 스타일 미적용 |
| A11Y-004 | Accessibility | Skip link 미구현 |
| A11Y-005 | Accessibility | `aria-modal`, `role="dialog"` 미적용 |
| PERF-006 | Performance | 66개 견종 배열 코드에 인라인 |
| PERF-007 | Performance | Photo base64 클라이언트 압축 미적용 |
| SEC-012 | Security | 세션 만료/타임아웃 미구현 |
| SEC-013 | Security | CSRF 토큰 미적용 |
| TOOL-001 | Tools | `get_weather` 동기 호출 (이벤트 루프 차단) |
| TOOL-002 | Tools | Agent 도구 실패 결과를 LLM에 그대로 전달 |

---

## 4. Low Issues (기술 부채)

| ID | 설명 |
|---|---|
| A11Y-006 | 색상 대비 WCAG AA 미충족 가능성 |
| A11Y-007 | 시간 선택 버튼 `aria-label` 미적용 |
| I18N-001 | 한국어 문자열 하드코딩 (다국어 불가) |
| CODE-005 | 모니터링/메트릭 시스템 없음 |
| CODE-006 | 요청 ID 추적 없음 |
| CODE-007 | LLM 호출 타임아웃 미설정 |
| CODE-008 | Circuit breaker 미적용 |
| CODE-009 | JSON 파일 백업 전략 없음 |
| CODE-010 | 통합/E2E 테스트 없음 |
| PERF-008 | Onboarding 무한 애니메이션 배터리 소모 |
| PERF-009 | RAG 파이프라인 데이터 전체 메모리 로드 |
| UX-012 | DiaryCard 긴 제목 overflow 처리 없음 |
| UX-013 | 댓글 아바타 key={index} 사용 |

---

## 5. 프로덕션 체크리스트

### P0: 필수 (배포 차단)
- [ ] JWT/세션 인증 구현
- [ ] Path traversal 방어
- [ ] bcrypt 비밀번호 해싱
- [ ] 파일 I/O 동시성 제어
- [ ] 서버측 입력값 검증 (이미지 크기, 문자열 길이)
- [ ] 어드민 엔드포인트 인가
- [ ] CORS 도메인 제한

### P1: 높음 (베타 전 수정)
- [ ] 비동기 I/O 전환 (aiofiles / run_in_executor)
- [ ] Rate limiting 적용
- [ ] 에러 메시지 정제 (스택트레이스 제거)
- [ ] EventSource 메모리 누수 수정
- [ ] ErrorBoundary 추가
- [ ] 환경변수 시작 시 검증

### P2: 중간 (스케일 전 수정)
- [ ] 페이지네이션 전체 적용
- [ ] 구조화된 로깅 도입
- [ ] 헬스체크 엔드포인트
- [ ] 코드 스플리팅 (React.lazy)
- [ ] 이미지 클라이언트 압축
- [ ] 접근성 (WCAG AA) 준수

### P3: 기술 부채
- [ ] 파일 기반 → DB 전환 (PostgreSQL/MongoDB)
- [ ] 통합 테스트 작성
- [ ] CI/CD 파이프라인
- [ ] 모니터링/알림 시스템
- [ ] 다국어 지원 구조

---

## 6. 수동 테스트 시나리오

### 보안 테스트
- [ ] localStorage `pawpalja_user` 조작 후 어드민 접근 시도
- [ ] 타 사용자 ID로 일기 삭제 API 직접 호출
- [ ] `GET /../../.env` 경로 순회 시도
- [ ] 10MB+ 이미지 업로드 시도
- [ ] SVG `<script>` 태그 포함 이미지 업로드

### 동시성 테스트
- [ ] 동일 사용자 일기 동시 생성 (2개 탭)
- [ ] 일기 수정 중 다른 탭에서 삭제
- [ ] SSE 스트리밍 중 페이지 이동 후 재진입

### Edge Case 테스트
- [ ] 100자 이상 제목으로 일기 생성
- [ ] 특수문자 포함 닉네임 회원가입
- [ ] 오프라인 상태에서 일기 생성 시도
- [ ] 동일 날짜 일기 2번 생성 (중복 방지 확인)
- [ ] 타임존이 다른 환경에서 "오늘의 일기" 표시 확인

---

**프로덕션 준비도 점수: 3/10**

> Critical 이슈 13건 중 인증/인가 미구현이 가장 큰 보안 위험. 파일 기반 저장소의 동시성 문제와 동기 I/O 차단 문제가 안정성을 저해함. MVP/데모 수준에서는 동작하나 외부 공개 서비스로는 부적합.
