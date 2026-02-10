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

    return documents


def build_vector_db():
    """데이터를 로드하고 ChromaDB 벡터 DB를 구축합니다."""
    print("데이터 로드 중...")
    docs = load_data()
    if not docs:
        print("인덱싱할 데이터가 없습니다.")
        return None

    print(f"{len(docs)}개 문서를 ChromaDB에 인덱싱 중...")
    embeddings = get_embeddings()
    persist_directory = os.getenv("CHROMA_PATH", os.path.join(BASE_DIR, "data", "chroma"))

    vector_db = Chroma.from_documents(
        documents=docs,
        embedding=embeddings,
        persist_directory=persist_directory,
        collection_name="pawpalja_collection",
    )

    print(f"벡터 DB 구축 완료: {persist_directory} ({len(docs)}개 문서)")
    return vector_db


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
    """메타데이터 필터를 적용한 검색을 수행합니다."""
    embeddings = get_embeddings()
    persist_directory = os.getenv("CHROMA_PATH", os.path.join(BASE_DIR, "data", "chroma"))

    vector_db = Chroma(
        persist_directory=persist_directory,
        embedding_function=embeddings,
        collection_name="pawpalja_collection",
    )

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
