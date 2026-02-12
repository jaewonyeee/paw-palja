"""
ref/datasets 폴더의 데이터를 처리하여 ChromaDB용 JSON으로 변환하는 스크립트
1. 페르소나 대화 데이터
2. 반려견 질병 말뭉치 데이터
3. KISTI 동물 질병 텍스트 데이터
"""
import os
import json
import csv
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
REF_DIR = BASE_DIR / "ref" / "datasets"
OUTPUT_DIR = BASE_DIR / "data" / "raw"


def process_persona_data():
    """페르소나 대화 데이터 처리 - 4가지 강아지 페르소나별 말투 학습용"""
    print("\n=== 페르소나 대화 데이터 처리 ===")
    persona_dir = REF_DIR / "044.페르소나 대화" / "01-1.정식개방데이터" / "Training" / "02.라벨링데이터" / "TL_가족"

    if not persona_dir.exists():
        print(f"페르소나 데이터 디렉토리가 없습니다: {persona_dir}")
        return []

    personas = []
    files = list(persona_dir.glob("Personas_*.json"))[:100]  # 샘플 100개만

    for file_path in files:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

                # 페르소나 프로필 추출
                persona_info = data.get("info", {}).get("personas", [])

                for persona in persona_info:
                    profiles = persona.get("persona", [])
                    conversation = persona.get("conversation", [])

                    # 프로필 정보 추출
                    profile_dict = {}
                    for p in profiles:
                        profile_dict[p.get("profile_major", "")] = p.get("profile", "")

                    # 대화 스타일 추출
                    dialogue_samples = []
                    for turn in conversation[:5]:  # 처음 5턴만
                        text = turn.get("text", "")
                        if text and len(text) > 10:
                            dialogue_samples.append(text)

                    if dialogue_samples:
                        personas.append({
                            "profile": profile_dict,
                            "dialogue_samples": dialogue_samples,
                            "source_file": file_path.name
                        })
        except Exception as e:
            print(f"파일 처리 오류 {file_path.name}: {e}")
            continue

    # 4가지 페르소나 타입으로 분류
    persona_types = {
        "왕자님": {"keywords": ["자신감", "당당", "리더", "지배적"], "tone": "고급스럽고 당당한"},
        "겁쟁이": {"keywords": ["걱정", "불안", "신중", "조심"], "tone": "소심하고 걱정 많은"},
        "사고뭉치": {"keywords": ["활발", "장난", "호기심", "적극"], "tone": "장난스럽고 에너지 넘치는"},
        "철학자": {"keywords": ["사색", "조용", "지적", "관찰"], "tone": "사색적이고 철학적인"}
    }

    output = []
    for ptype, config in persona_types.items():
        output.append({
            "persona_type": ptype,
            "tone": config["tone"],
            "keywords": config["keywords"],
            "example_dialogues": [p["dialogue_samples"][0] for p in personas[:3] if p["dialogue_samples"]],
            "description": f"{ptype} 페르소나는 {config['tone']} 말투를 사용합니다."
        })

    output_path = OUTPUT_DIR / "dog_personas.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"페르소나 데이터 저장 완료: {output_path} ({len(output)}개 페르소나)")
    return output


def process_disease_corpus():
    """반려견 질병 말뭉치 데이터 처리 - Vet 에이전트용"""
    print("\n=== 반려견 질병 말뭉치 데이터 처리 ===")
    disease_dir = REF_DIR / "59.반려견 성장 및 질병 관련 말뭉치 데이터" / "3.개방데이터" / "1.데이터" / "Training" / "02.라벨링데이터"

    if not disease_dir.exists():
        print(f"질병 데이터 디렉토리가 없습니다: {disease_dir}")
        return []

    disease_qa = []

    # TL_질의응답데이터_내과 폴더 처리
    for subdir in disease_dir.iterdir():
        if subdir.is_dir() and "질의응답" in subdir.name:
            files = list(subdir.glob("*.json"))[:50]  # 폴더당 50개 샘플

            for file_path in files:
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        meta = data.get("meta", {})
                        qa = data.get("qa", {})

                        disease_qa.append({
                            "life_cycle": meta.get("lifeCycle", ""),
                            "department": meta.get("department", ""),
                            "disease": meta.get("disease", ""),
                            "question": qa.get("input", ""),
                            "answer": qa.get("output", "")[:500],  # 답변 길이 제한
                        })
                except Exception as e:
                    print(f"파일 처리 오류 {file_path.name}: {e}")
                    continue

    output_path = OUTPUT_DIR / "dog_disease_qa.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(disease_qa, f, ensure_ascii=False, indent=2)

    print(f"질병 QA 데이터 저장 완료: {output_path} ({len(disease_qa)}개 문서)")
    return disease_qa


def process_kisti_disease():
    """KISTI 동물 질병 텍스트 데이터 처리 - 256개 질병 정보"""
    print("\n=== KISTI 동물 질병 데이터 처리 ===")
    kisti_path = REF_DIR / "한국과학기술정보연구원_동물질병 증상분류_20200924.csv"

    if not kisti_path.exists():
        print(f"KISTI 데이터 파일이 없습니다: {kisti_path}")
        return []

    diseases = []

    try:
        with open(kisti_path, "r", encoding="cp949") as f:
            reader = csv.DictReader(f)
            for row in reader:
                diseases.append({
                    "category_code": row.get("분류코드", ""),
                    "category_ko": row.get("분류명 한글", ""),
                    "category_en": row.get("분류명 영문", ""),
                    "disease_code": row.get("질병코드", ""),
                    "symptoms": row.get("증상명", "")
                })
    except Exception as e:
        print(f"KISTI CSV 파일 읽기 오류: {e}")
        try:
            # UTF-8으로 재시도
            with open(kisti_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    diseases.append({
                        "category_code": row.get("분류코드", ""),
                        "category_ko": row.get("분류명 한글", ""),
                        "category_en": row.get("분류명 영문", ""),
                        "disease_code": row.get("질병코드", ""),
                        "symptoms": row.get("증상명", "")
                    })
        except Exception as e2:
            print(f"UTF-8 재시도도 실패: {e2}")
            return []

    output_path = OUTPUT_DIR / "kisti_diseases.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(diseases, f, ensure_ascii=False, indent=2)

    print(f"KISTI 질병 데이터 저장 완료: {output_path} ({len(diseases)}개 질병)")
    return diseases


if __name__ == "__main__":
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("ref/datasets 데이터 처리 시작")
    print("=" * 60)

    # 1. 페르소나 데이터 처리
    personas = process_persona_data()

    # 2. 질병 말뭉치 처리
    disease_qa = process_disease_corpus()

    # 3. KISTI 데이터 처리
    kisti = process_kisti_disease()

    print("\n" + "=" * 60)
    print(f"전체 처리 완료:")
    print(f"  - 페르소나: {len(personas)}개")
    print(f"  - 질병 QA: {len(disease_qa)}개")
    print(f"  - KISTI 질병: {len(kisti)}개")
    print("=" * 60)
