# RAG 평가 시나리오 (Evaluation & Regression Test)

> 대표 쿼리 20개 + 기대 답변/근거를 정의합니다.
> CI에서 `python -m backend.rag_pipeline`으로 smoke test를 실행할 수 있습니다.

---

## 평가 기준

| 지표 | 설명 | 합격 기준 |
|---|---|---|
| **Relevance** | 쿼리와 반환 문서의 관련성 | 상위 2개 문서 중 1개 이상 관련 |
| **Source Accuracy** | source_filter에 맞는 문서만 반환 | 100% (다른 소스 혼입 없음) |
| **Coverage** | 기대 키워드가 결과에 포함되는지 | 기대 키워드 중 50% 이상 포함 |

---

## 견종 건강 정보 (source: breeds)

### Q01: 푸들 건강 주의사항
```
쿼리: "푸들 건강 주의 질환"
source_filter: breeds
기대 결과: 슬개골 탈구, 눈 질환, 피부병 중 1개 이상 언급
```

### Q02: 불독 더위 주의
```
쿼리: "불독 더위 여름 주의"
source_filter: breeds
기대 결과: 열사병, 호흡기, 단두종 관련 정보
```

### Q03: 말티즈 케어팁
```
쿼리: "말티즈 건강 관리 케어"
source_filter: breeds
기대 결과: 눈물자국, 슬개골, 치석 관련 정보
```

### Q04: 골든리트리버 유전 질환
```
쿼리: "골든리트리버 유전 질환 주의"
source_filter: breeds
기대 결과: 고관절 이형성, 피부 알러지, 암 관련 정보
```

### Q05: 믹스견 일반 건강
```
쿼리: "믹스견 건강 관리"
source_filter: breeds
기대 결과: 일반적 건강 관리 정보 (빈 결과도 허용)
```

---

## 밈/SNS 데이터 (source: memes, sns)

### Q06: 행복한 강아지 밈
```
쿼리: "신남 강아지 행복"
source_filter: memes
기대 결과: 긍정적 톤의 밈 텍스트 반환
```

### Q07: 우울한 강아지 밈
```
쿼리: "우울 슬픈 강아지"
source_filter: memes
기대 결과: 감성적/위로 톤의 밈 텍스트 반환
```

### Q08: SNS 트렌드 콘텐츠
```
쿼리: "강아지 SNS 트렌드"
source_filter: sns
기대 결과: SNS 콘텐츠 캡션 반환 (빈 결과도 허용 — 데이터 의존)
```

### Q09: 식사 관련 밈
```
쿼리: "밥 먹는 강아지 간식"
source_filter: memes
기대 결과: 음식 관련 밈 텍스트 반환
```

### Q10: 산책 관련 밈
```
쿼리: "산책 나가자 공원"
source_filter: memes
기대 결과: 산책/야외 활동 관련 밈 텍스트 반환
```

---

## 질병 QA 데이터 (source: disease_qa)

### Q11: 설사 증상 QA
```
쿼리: "강아지 설사 원인 치료"
source_filter: disease_qa
기대 결과: 소화기 관련 질병 정보, 진료과 포함
```

### Q12: 구토 증상 QA
```
쿼리: "강아지 구토 반복"
source_filter: disease_qa
기대 결과: 구토 관련 질병, 진료과, 원인 분석 포함
```

### Q13: 피부 질환 QA
```
쿼리: "강아지 피부 가려움 탈모"
source_filter: disease_qa
기대 결과: 피부 질환 관련 QA (알러지, 아토피 등)
```

### Q14: 식욕 감소 QA
```
쿼리: "강아지 밥 안먹음 식욕"
source_filter: disease_qa
기대 결과: 식욕 감소 원인, 관련 질환 정보
```

### Q15: 눈 질환 QA
```
쿼리: "강아지 눈 충혈 눈물"
source_filter: disease_qa
기대 결과: 안과 질환 관련 정보
```

---

## KISTI 질병 분류 (source: kisti_disease)

### Q16: 소화기 질환 분류
```
쿼리: "소화기 위장 질환"
source_filter: kisti_disease
기대 결과: KISTI 질병 코드, 소화기 카테고리 포함
```

### Q17: 호흡기 질환 분류
```
쿼리: "호흡기 기침 폐렴"
source_filter: kisti_disease
기대 결과: 호흡기 카테고리의 질병 코드/증상
```

### Q18: 근골격 질환 분류
```
쿼리: "관절 골절 슬개골"
source_filter: kisti_disease
기대 결과: 근골격계 카테고리의 질병 분류
```

### Q19: 피부 질환 분류
```
쿼리: "피부 습진 진드기"
source_filter: kisti_disease
기대 결과: 피부 카테고리의 질병 분류
```

### Q20: 신경계 질환 분류
```
쿼리: "경련 발작 신경"
source_filter: kisti_disease
기대 결과: 신경계 카테고리의 질병 코드/증상
```

---

## 교차 소스 격리 테스트

### Q-ISO-01: 밈이 건강 분석에 혼입되지 않음
```
쿼리: "강아지 건강 분석"
source_filter: breeds
검증: 반환 문서에 meme/SNS 소스 문서가 포함되면 실패
```

### Q-ISO-02: 건강 데이터가 밈에 혼입되지 않음
```
쿼리: "재미있는 강아지"
source_filter: memes
검증: 반환 문서에 breeds/disease 소스 문서가 포함되면 실패
```

---

## Smoke Test 실행 방법

```bash
# 벡터 DB 구축 + 검색 테스트
python -m backend.rag_pipeline

# 고급 RAG 테스트 (Hybrid Search)
python -m backend.rag_advanced
```

### CI 통합 예시

```yaml
# .github/workflows/ci-cd.yml
- name: RAG Smoke Test
  run: |
    python -m backend.rag_pipeline 2>&1 | grep -q "벡터 DB 구축 완료" || exit 1
```
