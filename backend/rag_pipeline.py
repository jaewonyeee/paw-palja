"""
RAG (Retrieval-Augmented Generation) 파이프라인
ChromaDB를 활용한 벡터 검색 및 Apify SNS 데이터 통합
"""
import os
import json
import backend.chroma_compat  # noqa: F401 - Python 3.14 호환 패치
from langchain_chroma import Chroma
from langchain_core.documents import Document
from dotenv import load_dotenv
from backend.llm_provider import get_embeddings

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data", "raw")


def load_data():
    """모든 데이터 소스에서 Document 객체를 로드합니다."""
    documents = []

    # 1. 견종 데이터
    breed_path = os.path.join(DATA_DIR, "dog_breeds.json")
    if os.path.exists(breed_path):
        with open(breed_path, "r", encoding="utf-8") as f:
            breeds = json.load(f)
            for b in breeds:
                content = (
                    f"견종: {b['breed']}\n"
                    f"성격: {b['personality']}\n"
                    f"주의질환: {', '.join(b['health_issues'])}\n"
                    f"MBTI 매칭: {b.get('mbti_match', 'N/A')}\n"
                    f"케어팁: {b['care_tips']}"
                )
                documents.append(Document(
                    page_content=content,
                    metadata={"source": "breeds", "breed": b['breed']}
                ))

    # 2. 밈 데이터
    meme_path = os.path.join(DATA_DIR, "dog_memes.json")
    if os.path.exists(meme_path):
        with open(meme_path, "r", encoding="utf-8") as f:
            memes = json.load(f)
            for m in memes:
                content = (
                    f"밈 타입: {m['meme_type']}\n"
                    f"말투: {m['tone']}\n"
                    f"내용: {m['text']}"
                )
                documents.append(Document(
                    page_content=content,
                    metadata={"source": "memes", "type": m['meme_type']}
                ))

    # 3. SNS 데이터 (Apify 수집분)
    sns_path = os.path.join(DATA_DIR, "sns_memes.json")
    if os.path.exists(sns_path):
        with open(sns_path, "r", encoding="utf-8") as f:
            sns_data = json.load(f)
            for s in sns_data:
                caption = s.get("caption", "")
                if caption and len(caption) > 5:
                    documents.append(Document(
                        page_content=f"SNS 콘텐츠: {caption}",
                        metadata={
                            "source": "sns",
                            "url": s.get("url", ""),
                            "likes": s.get("likes", 0),
                        }
                    ))

    # 4. 페르소나 데이터 (4가지 강아지 성격 타입)
    persona_path = os.path.join(DATA_DIR, "dog_personas.json")
    if os.path.exists(persona_path):
        with open(persona_path, "r", encoding="utf-8") as f:
            personas = json.load(f)
            for p in personas:
                content = (
                    f"페르소나: {p['persona_type']}\n"
                    f"말투: {p['tone']}\n"
                    f"키워드: {', '.join(p['keywords'])}\n"
                    f"설명: {p['description']}\n"
                    f"대화 예시: {p['example_dialogues'][0] if p['example_dialogues'] else 'N/A'}"
                )
                documents.append(Document(
                    page_content=content,
                    metadata={"source": "personas", "persona_type": p['persona_type']}
                ))

    # 5. 질병 QA 데이터 (반려견 건강 전문가 답변)
    disease_qa_path = os.path.join(DATA_DIR, "dog_disease_qa.json")
    if os.path.exists(disease_qa_path):
        with open(disease_qa_path, "r", encoding="utf-8") as f:
            disease_qa = json.load(f)
            for qa in disease_qa:
                content = (
                    f"질병: {qa['disease']}\n"
                    f"진료과: {qa['department']}\n"
                    f"생애주기: {qa['life_cycle']}\n"
                    f"질문: {qa['question'][:200]}\n"
                    f"답변: {qa['answer'][:300]}"
                )
                documents.append(Document(
                    page_content=content,
                    metadata={
                        "source": "disease_qa",
                        "disease": qa['disease'],
                        "department": qa['department']
                    }
                ))

    # 6. KISTI 질병 데이터 (256개 질병 분류 및 증상)
    kisti_path = os.path.join(DATA_DIR, "kisti_diseases.json")
    if os.path.exists(kisti_path):
        with open(kisti_path, "r", encoding="utf-8") as f:
            kisti_diseases = json.load(f)
            for disease in kisti_diseases:
                content = (
                    f"질병 코드: {disease['disease_code']}\n"
                    f"분류: {disease['category_ko']} ({disease['category_en']})\n"
                    f"증상: {disease['symptoms']}"
                )
                documents.append(Document(
                    page_content=content,
                    metadata={
                        "source": "kisti_disease",
                        "category": disease['category_ko'],
                        "disease_code": disease['disease_code']
                    }
                ))

    return documents


# --- 컬렉션 전략 설정 ---
# CHROMA_MULTI_COLLECTION=true 설정 시 소스별 컬렉션 분리 (확장성 향상)
_USE_MULTI_COLLECTION = os.getenv("CHROMA_MULTI_COLLECTION", "false").lower() in ("true", "1", "yes")

# 소스별 컬렉션 매핑 (다중 컬렉션 모드)
_SOURCE_COLLECTION_MAP = {
    "breeds": "pawpalja_breeds",
    "memes": "pawpalja_memes",
    "sns": "pawpalja_memes",         # memes와 같은 컬렉션
    "personas": "pawpalja_memes",    # memes와 같은 컬렉션
    "disease_qa": "pawpalja_disease",
    "kisti_disease": "pawpalja_disease",
}


def _get_collection_name(source_filter: str | None = None) -> str:
    """소스 필터에 따른 컬렉션 이름을 반환합니다."""
    if not _USE_MULTI_COLLECTION or not source_filter:
        return "pawpalja_collection"
    return _SOURCE_COLLECTION_MAP.get(source_filter, "pawpalja_collection")


def build_vector_db():
    """데이터를 로드하고 ChromaDB 벡터 DB를 구축합니다.

    CHROMA_MULTI_COLLECTION=true 설정 시 소스별 컬렉션으로 분리합니다.
    """
    print("데이터 로드 중...")
    docs = load_data()
    if not docs:
        print("인덱싱할 데이터가 없습니다.")
        return None

    embeddings = get_embeddings()
    persist_directory = os.getenv("CHROMA_PATH", os.path.join(BASE_DIR, "data", "chroma"))

    if _USE_MULTI_COLLECTION:
        # 다중 컬렉션 모드: 소스별로 분리 인덱싱
        from collections import defaultdict
        docs_by_collection = defaultdict(list)
        for doc in docs:
            source = doc.metadata.get("source", "")
            collection = _SOURCE_COLLECTION_MAP.get(source, "pawpalja_collection")
            docs_by_collection[collection].append(doc)

        for collection_name, collection_docs in docs_by_collection.items():
            print(f"  {collection_name}: {len(collection_docs)}개 문서 인덱싱 중...")
            Chroma.from_documents(
                documents=collection_docs,
                embedding=embeddings,
                persist_directory=persist_directory,
                collection_name=collection_name,
            )
        print(f"다중 컬렉션 벡터 DB 구축 완료: {len(docs_by_collection)}개 컬렉션, 총 {len(docs)}개 문서")
    else:
        # 단일 컬렉션 모드 (기본)
        print(f"{len(docs)}개 문서를 ChromaDB에 인덱싱 중...")
        Chroma.from_documents(
            documents=docs,
            embedding=embeddings,
            persist_directory=persist_directory,
            collection_name="pawpalja_collection",
        )
        print(f"벡터 DB 구축 완료: {persist_directory} ({len(docs)}개 문서)")


def query_rag(query, k=2):
    """ChromaDB에서 유사도 검색을 수행합니다."""
    embeddings = get_embeddings()
    persist_directory = os.getenv("CHROMA_PATH", os.path.join(BASE_DIR, "data", "chroma"))

    vector_db = Chroma(
        persist_directory=persist_directory,
        embedding_function=embeddings,
        collection_name="pawpalja_collection",
    )
    results = vector_db.similarity_search(query, k=k)
    return results


def query_rag_with_filter(query, source_filter=None, k=2):
    """메타데이터 필터를 적용한 검색을 수행합니다.

    다중 컬렉션 모드에서는 소스별 전용 컬렉션에서 검색합니다.
    단일 컬렉션 모드에서는 metadata 필터로 검색합니다.
    """
    embeddings = get_embeddings()
    persist_directory = os.getenv("CHROMA_PATH", os.path.join(BASE_DIR, "data", "chroma"))
    collection_name = _get_collection_name(source_filter)

    vector_db = Chroma(
        persist_directory=persist_directory,
        embedding_function=embeddings,
        collection_name=collection_name,
    )

    # 다중 컬렉션 모드에서는 이미 소스별 분리되므로 필터 불필요
    if _USE_MULTI_COLLECTION and source_filter:
        results = vector_db.similarity_search(query, k=k)
    else:
        where_filter = {"source": source_filter} if source_filter else None
        results = vector_db.similarity_search(query, k=k, filter=where_filter)
    return results


if __name__ == "__main__":
    try:
        # SNS 데이터 수집 시도
        print("=== SNS 데이터 수집 시도 ===")
        try:
            from backend.fetch_sns_data import fetch_multiple_tags, save_sns_data
            sns_data = fetch_multiple_tags(max_per_tag=3)
            if sns_data:
                save_sns_data(sns_data)
            else:
                print("Apify에서 데이터 수집 실패. 폴백 데이터 사용.")
        except Exception as e:
            print(f"SNS 수집 건너뜀: {e}")

        # 벡터 DB 구축
        print("\n=== 벡터 DB 구축 ===")
        build_vector_db()

        # 검색 테스트
        print("\n=== RAG 검색 테스트 ===")
        test_queries = [
            ("말티즈 건강 주의사항", None),
            ("강아지 밈", "memes"),
        ]
        for query, source in test_queries:
            print(f"\n쿼리: '{query}' (source: {source or 'all'})")
            if source:
                results = query_rag_with_filter(query, source_filter=source, k=2)
            else:
                results = query_rag(query, k=2)
            for i, r in enumerate(results):
                print(f"  [{i+1}] {r.page_content[:100]}...")

    except Exception as e:
        print(f"RAG 파이프라인 오류: {e}")
