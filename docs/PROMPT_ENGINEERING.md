# 프롬프트 엔지니어링 기법

> 구현 파일: `backend/prompt_engineering.py`

Paw-Palja는 3가지 고급 프롬프트 엔지니어링 기법을 사용하여 LLM 출력의 품질과 일관성을 높입니다.

---

## 1. Self-Consistency

### 개요

동일한 프롬프트로 여러 번 생성하여 가장 일관성 있는 결과를 선택하는 기법입니다.

### 구현

```python
def self_consistency_generate(
    prompt_template: Callable,
    prompt_params: Dict[str, Any],
    n_samples: int = 3,          # 생성 횟수
    temperature: float = 0.9,     # 높은 temperature로 다양한 출력
    output_schema: Any = None     # Pydantic 모델 (Structured Output)
) -> Dict[str, Any]:
```

### 동작 방식

```
                    ┌──────────┐
                    │  Prompt  │
                    └─────┬────┘
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
         Sample 1    Sample 2    Sample 3
         (temp=0.9)  (temp=0.9)  (temp=0.9)
              │           │           │
              └───────────┼───────────┘
                          ▼
                   투표 (Majority Vote)
                   또는 유사도 비교
                          │
                          ▼
                   최종 결과 선택
```

1. 동일한 프롬프트를 `n_samples`번 실행 (높은 temperature로 다양성 확보)
2. 각 결과를 비교하여 가장 일관성 있는 (다수가 동의하는) 결과 선택
3. Structured Output이 적용된 경우 Pydantic 모델 기반으로 필드별 비교

### 적용 Agent

- **Oracle Agent**: 운세 생성 시 3번 생성하여 가장 일관된 결과 선택

---

## 2. Few-Shot Enhancement

### 개요

프롬프트에 예시(Shot)를 포함하여 LLM이 원하는 형식과 톤을 학습하도록 합니다.

### 구현

```python
def get_oracle_few_shot_prompt() -> ChatPromptTemplate:
    """Oracle Agent용 Few-Shot 프롬프트 생성"""
```

### Few-Shot 예시 구조

```
[System]
당신은 반려견 운세 전문가입니다.

[예시 1 - 입력]
견종: 골든리트리버, MBTI: ENFP, 날씨: 맑음

[예시 1 - 출력]
{
    "horoscope_ko": "오늘은 산책하기 완벽한 날! ...",
    "lucky_item": "빨간 리드줄",
    "mood_emoji": "🌟"
}

[예시 2 - 입력]
견종: 시바견, MBTI: INTJ, 날씨: 비

[예시 2 - 출력]
{
    "horoscope_ko": "비 오는 날은 집에서 ...",
    "lucky_item": "우비",
    "mood_emoji": "🌧️"
}

[실제 입력]
견종: {breed}, MBTI: {mbti}, 날씨: {weather}
```

### 적용 Agent

- **Oracle Agent**: 운세 생성 형식 학습
- **Journalist Agent**: 1인칭 강아지 시점 일기 톤 학습

---

## 3. Chain-of-Thought (CoT)

### 개요

LLM이 최종 답변 전에 단계별로 추론하도록 유도하여 복잡한 분석의 정확도를 높이는 기법입니다.

### 구현

Vet Agent의 건강 분석 프롬프트에 4단계 CoT가 적용됩니다:

```
[System]
당신은 수의학 전문가입니다. 다음 4단계로 분석해주세요:

1단계: 증상 파악
- 일기와 건강 기록에서 증상 키워드를 추출합니다.
- "구토", "설사", "식욕감소" 등의 패턴을 식별합니다.

2단계: 견종별 위험도 평가
- RAG로 검색한 견종 건강 정보를 참조합니다.
- 해당 견종의 유전적 취약점과 현재 증상을 매칭합니다.

3단계: 위험도 판정
- low: 정상 범위 내 변화
- medium: 관찰 필요, 1주 내 호전 안 되면 병원
- high: 즉시 수의사 상담 필요

4단계: 맞춤 권장사항
- 견종별 특성을 고려한 구체적 조언을 제공합니다.
```

### CoT 추론 과정 예시

```json
{
    "cot_reasoning": "1단계: 일기에서 '오늘 밥을 조금만 먹었어요'라는 표현 발견. 식욕감소 의심. 2단계: 푸들은 소화기 관련 유전적 취약점이 있음(RAG 견종 데이터). 3단계: 단발성 식욕감소는 스트레스일 수 있으나, 3일 이상 지속 시 medium으로 상향. 현재 판정: low. 4단계: 물 섭취량 모니터링, 2-3일 후에도 지속되면 수의사 방문 권장.",
    "risk_level": "low",
    "recommendations": ["물 섭취량 모니터링", "2-3일 관찰 후 병원 방문 고려"]
}
```

### 적용 Agent

- **Vet Agent**: 건강 분석 시 4단계 CoT 추론

---

## 기법 요약

| 기법 | 적용 Agent | 목적 | 핵심 파라미터 |
|---|---|---|---|
| Self-Consistency | Oracle | 일관성 있는 운세 생성 | `n_samples=3`, `temp=0.9` |
| Few-Shot | Oracle, Journalist | 출력 형식/톤 학습 | 2-3개 예시 |
| Chain-of-Thought | Vet | 정확한 건강 분석 | 4단계 추론, `temp=0.3` |

---

## Structured Output과의 연계

모든 프롬프트 엔지니어링 기법은 **Structured Output**(`backend/schemas.py`)과 결합됩니다:

```python
# LangChain with_structured_output으로 Pydantic 모델 강제
llm_with_schema = get_llm(temperature=0.3).with_structured_output(HealthAnalysis)
result = llm_with_schema.invoke(prompt)
# result는 반드시 HealthAnalysis 스키마를 따름
```

이를 통해:
1. LLM 출력이 항상 예측 가능한 구조를 가짐
2. 파싱 에러 없이 프론트엔드에서 바로 사용 가능
3. 다국어 필드(`_ko`, `_en`)가 자동으로 생성됨

---

## 출력 스키마 실패 대비 전략

`with_structured_output()` 사용 시에도 모델/네트워크 문제로 파싱 실패가 발생할 수 있습니다.
`_invoke_with_retry()` 래퍼를 통해 다음 전략을 적용합니다:

| 시도 | 전략 | 설명 |
|---|---|---|
| 1차 | 기본 temperature | 정상 호출 |
| 2차 | temperature - 0.1 | 출력 안정화를 위해 temperature 낮춤 |
| 3차 | temperature - 0.2 | 최소 temperature로 최대한 결정적 출력 |
| 실패 | 예외 전파 | 상위 호출자에서 사용자에게 에러 메시지 |

```python
# backend/agents.py
result = _invoke_with_retry(chain, params, max_retries=2, base_temp=0.8)
```

---

## 입력 상황별 프롬프트 분기 테스트 케이스

다양한 입력 상황에서 프롬프트가 올바르게 동작하는지 확인하기 위한 테스트 케이스입니다.

### TC-01: 신규 사용자 (기록 없음)

```
입력:
  dog_profile: { name: "새봄", breed: "믹스견", mbti: "ENFP" }
  daily_logs: { mood: "평범", food: "보통", walk: "0", poop: "정상", notes: "" }

기대 동작:
  - Oracle: 믹스견 기본 운세 생성 (RAG에서 믹스견 정보 조회)
  - Journalist: 기본 페르소나로 일기 생성, 빈 notes 처리
  - Vet: 이상 없음 판정 (risk_level: Low)
  - 모든 필드가 비어있지 않아야 함
```

### TC-02: 모호한 입력 (배변: "이상해요")

```
입력:
  dog_profile: { name: "코코", breed: "푸들", mbti: "INFJ" }
  daily_logs: { mood: "우울", food: "조금", walk: "10", poop: "묽음", notes: "배변이 이상해요" }

기대 동작:
  - Vet: notes에서 "이상해요" 키워드 감지 → 질병 QA RAG 검색 활성화
  - risk_level: Medium 이상
  - advice에 "수의사 상담" 포함
  - RAG sources에 disease_qa 결과 포함
```

### TC-03: 견종 미선택 / 믹스견

```
입력:
  dog_profile: { name: "멍멍이", breed: "믹스견", mbti: "ENFP" }
  daily_logs: { mood: "좋음", food: "완식", walk: "30", poop: "정상", notes: "" }

기대 동작:
  - Oracle: "믹스견"에 맞는 범용 운세 생성
  - Vet: 특정 견종 유전 질환 없이 일반적 건강 분석
  - breed_context에 "다양한 유전 배경" 또는 "일반적 건강 관리" 언급
```

### TC-04: 건강 위험 신호 (Critical)

```
입력:
  dog_profile: { name: "두부", breed: "불독", mbti: "ISTP" }
  daily_logs: { mood: "아픔", food: "안먹음", walk: "0", poop: "묽음", notes: "구토를 3번 했어요. 힘이 없어요." }

기대 동작:
  - Vet: risk_level = High 또는 Critical
  - emergency_guidance에 병원 즉시 방문 안내 포함
  - A2A: Vet → Oracle alert 메모 전송
  - LangGraph: alert_handler 노드 실행
  - disclaimer 포함 (의료 고지)
```

### TC-05: 긴 메모 입력

```
입력:
  dog_profile: { name: "달이", breed: "시츄", mbti: "ESFJ" }
  daily_logs: { mood: "좋음", food: "완식", walk: "60", poop: "정상",
    notes: "오늘 친구 강아지랑 놀았는데 너무 신나서 뛰어다녔어요. 간식도 많이 먹었고 물도 잘 마셨어요. 저녁에는 좀 피곤한 것 같아요." }

기대 동작:
  - Journalist: 긴 notes를 일기에 자연스럽게 반영
  - Vet: 활발한 활동 후 피로는 정상 (risk_level: Low)
  - 500자 max_length 검증 통과
```

### TC-06: 다국어 생성 검증

```
입력:
  dog_profile: { name: "Max", breed: "Golden Retriever", mbti: "ENFP", language: "en" }
  daily_logs: { mood: "최고", food: "완식", walk: "45", poop: "정상", notes: "Had a great day!" }

기대 동작:
  - 모든 _ko 필드와 _en 필드가 모두 채워져야 함
  - _ko 필드는 한국어, _en 필드는 영어
  - 어느 쪽도 빈 문자열이면 안 됨
```
