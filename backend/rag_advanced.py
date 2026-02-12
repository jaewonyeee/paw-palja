"""
Advanced RAG Pipeline
Re-ranking, Hybrid Search, Context Compression 기능 추가
"""
import os
from typing import List, Optional
from langchain_core.documents import Document
from langchain_chroma import Chroma
from langchain.retrievers import ContextualCompressionRetriever
from langchain.retrievers.document_compressors import LLMChainExtractor
from langchain_community.retrievers import BM25Retriever
from dotenv import load_dotenv
from backend.llm_provider import get_embeddings, get_llm
import logging

load_dotenv()
logger = logging.getLogger("pawpalja.rag_advanced")

BASE_DIR = os.path.dirname(os.path.dirname(__file__))


def get_vector_store():
    """ChromaDB 벡터 스토어 인스턴스 반환"""
    embeddings = get_embeddings()
    persist_directory = os.getenv("CHROMA_PATH", os.path.join(BASE_DIR, "data", "chroma"))

    vector_db = Chroma(
        persist_directory=persist_directory,
        embedding_function=embeddings,
        collection_name="pawpalja_collection",
    )
    return vector_db


def hybrid_search(
    query: str,
    k: int = 5,
    vector_weight: float = 0.7,
    source_filter: Optional[str] = None
) -> List[Document]:
    """하이브리드 검색 (Vector + BM25 결합)

    Args:
        query: 검색 쿼리
        k: 반환할 문서 개수
        vector_weight: 벡터 검색 가중치 (0.0~1.0, 기본값: 0.7)
        source_filter: 메타데이터 소스 필터

    Returns:
        검색 결과 문서 리스트
    """
    try:
        # 1. Vector Search
        vector_db = get_vector_store()

        where_filter = {"source": source_filter} if source_filter else None
        vector_results = vector_db.similarity_search_with_score(query, k=k * 2, filter=where_filter)

        # 2. BM25 Search (키워드 기반)
        try:
            # BM25는 모든 문서를 메모리에 로드해야 하므로, 소스 필터가 있으면 해당 문서만 로드
            if source_filter:
                all_docs = vector_db.get(where={"source": source_filter})["documents"]
                all_docs = [Document(page_content=doc) for doc in all_docs]
            else:
                # 전체 문서 로드 (메모리 사용 주의)
                all_docs_data = vector_db.get()
                all_docs = [
                    Document(page_content=content, metadata=meta)
                    for content, meta in zip(all_docs_data["documents"], all_docs_data["metadatas"])
                ]

            if not all_docs:
                logger.warning("BM25용 문서가 없음. Vector 검색 결과만 반환")
                return [doc for doc, score in vector_results[:k]]

            bm25_retriever = BM25Retriever.from_documents(all_docs)
            bm25_retriever.k = k * 2
            bm25_results = bm25_retriever.get_relevant_documents(query)

        except Exception as e:
            logger.warning(f"BM25 검색 실패: {e}. Vector 검색 결과만 사용")
            return [doc for doc, score in vector_results[:k]]

        # 3. 하이브리드 스코어 계산 및 결합
        doc_scores = {}

        # Vector 검색 스코어 (거리 기반, 낮을수록 유사)
        max_vector_score = max([score for _, score in vector_results]) if vector_results else 1.0
        for doc, score in vector_results:
            # 거리를 유사도로 변환 (낮은 거리 = 높은 유사도)
            normalized_score = 1.0 - (score / max_vector_score) if max_vector_score > 0 else 0.0
            doc_key = doc.page_content[:100]  # 문서 식별용 키
            doc_scores[doc_key] = {
                "doc": doc,
                "vector_score": normalized_score * vector_weight,
                "bm25_score": 0.0
            }

        # BM25 검색 스코어 (순위 기반)
        bm25_weight = 1.0 - vector_weight
        for idx, doc in enumerate(bm25_results):
            # 순위 기반 스코어 (상위 순위 = 높은 스코어)
            rank_score = (len(bm25_results) - idx) / len(bm25_results)
            doc_key = doc.page_content[:100]

            if doc_key in doc_scores:
                doc_scores[doc_key]["bm25_score"] = rank_score * bm25_weight
            else:
                doc_scores[doc_key] = {
                    "doc": doc,
                    "vector_score": 0.0,
                    "bm25_score": rank_score * bm25_weight
                }

        # 4. 최종 스코어 계산 및 정렬
        ranked_docs = []
        for doc_key, scores in doc_scores.items():
            total_score = scores["vector_score"] + scores["bm25_score"]
            ranked_docs.append((scores["doc"], total_score))

        # 스코어 기준 내림차순 정렬
        ranked_docs.sort(key=lambda x: x[1], reverse=True)

        # 상위 k개 반환
        return [doc for doc, score in ranked_docs[:k]]

    except Exception as e:
        logger.error(f"하이브리드 검색 오류: {e}")
        # 폴백: 기본 Vector 검색
        from backend.rag_pipeline import query_rag_with_filter, query_rag
        if source_filter:
            return query_rag_with_filter(query, source_filter=source_filter, k=k)
        else:
            return query_rag(query, k=k)


def query_with_compression(
    query: str,
    k: int = 5,
    source_filter: Optional[str] = None,
    use_hybrid: bool = True
) -> List[Document]:
    """Context Compression을 적용한 검색

    Args:
        query: 검색 쿼리
        k: 반환할 문서 개수
        source_filter: 메타데이터 소스 필터
        use_hybrid: 하이브리드 검색 사용 여부 (기본값: True)

    Returns:
        압축된 검색 결과 문서 리스트
    """
    try:
        # 1. Base Retriever 선택
        if use_hybrid:
            # 하이브리드 검색 결과를 직접 사용
            base_results = hybrid_search(query, k=k * 2, source_filter=source_filter)
        else:
            # Vector 검색만 사용
            vector_db = get_vector_store()
            where_filter = {"source": source_filter} if source_filter else None
            base_results = vector_db.similarity_search(query, k=k * 2, filter=where_filter)

        if not base_results:
            return []

        # 2. LLM Chain Extractor로 컨텍스트 압축
        llm = get_llm(temperature=0.0)  # 압축 작업은 일관성 중요
        compressor = LLMChainExtractor.from_llm(llm)

        # 압축 수행 (쿼리와 관련된 부분만 추출)
        compressed_docs = compressor.compress_documents(base_results, query)

        # 상위 k개 반환
        return compressed_docs[:k]

    except Exception as e:
        logger.error(f"Context Compression 오류: {e}")
        # 폴백: 압축 없이 기본 검색 결과 반환
        if use_hybrid:
            return hybrid_search(query, k=k, source_filter=source_filter)
        else:
            from backend.rag_pipeline import query_rag_with_filter, query_rag
            if source_filter:
                return query_rag_with_filter(query, source_filter=source_filter, k=k)
            else:
                return query_rag(query, k=k)


def rerank_documents(
    query: str,
    documents: List[Document],
    top_k: int = 5,
    model: str = "cross-encoder"
) -> List[Document]:
    """문서 Re-ranking (Cross-Encoder 기반)

    Args:
        query: 검색 쿼리
        documents: 재순위화할 문서 리스트
        top_k: 반환할 상위 문서 개수
        model: 모델 타입 ("cross-encoder" 또는 "llm")

    Returns:
        재순위화된 문서 리스트
    """
    if not documents:
        return []

    try:
        if model == "cross-encoder":
            # Cross-Encoder 모델 사용 (더 정확하지만 느림)
            try:
                from sentence_transformers import CrossEncoder

                cross_encoder = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

                # 쿼리-문서 쌍 생성
                pairs = [[query, doc.page_content] for doc in documents]

                # 스코어 계산
                scores = cross_encoder.predict(pairs)

                # 스코어 기준 정렬
                doc_scores = list(zip(documents, scores))
                doc_scores.sort(key=lambda x: x[1], reverse=True)

                return [doc for doc, score in doc_scores[:top_k]]

            except ImportError:
                logger.warning("sentence-transformers 미설치. LLM 기반 reranking 사용")
                model = "llm"

        if model == "llm":
            # LLM 기반 Re-ranking (Cross-Encoder 대안)
            llm = get_llm(temperature=0.0)

            # 각 문서의 관련성 점수 계산
            doc_scores = []
            for doc in documents:
                prompt = f"""다음 문서가 주어진 쿼리와 얼마나 관련이 있는지 0-10 점수로 평가하세요.

쿼리: {query}

문서:
{doc.page_content[:500]}

점수 (0-10):"""

                try:
                    response = llm.invoke(prompt)
                    score_text = response.content.strip()
                    # 숫자만 추출
                    score = float(''.join(filter(str.isdigit, score_text[:2])))
                except Exception:
                    score = 5.0  # 기본 점수

                doc_scores.append((doc, score))

            # 스코어 기준 정렬
            doc_scores.sort(key=lambda x: x[1], reverse=True)
            return [doc for doc, score in doc_scores[:top_k]]

    except Exception as e:
        logger.error(f"Re-ranking 오류: {e}")
        # 폴백: 원본 순서 유지
        return documents[:top_k]


def advanced_rag_search(
    query: str,
    k: int = 5,
    source_filter: Optional[str] = None,
    use_hybrid: bool = True,
    use_rerank: bool = False,
    use_compression: bool = False
) -> List[Document]:
    """고급 RAG 검색 (모든 기능 통합)

    Args:
        query: 검색 쿼리
        k: 반환할 문서 개수
        source_filter: 메타데이터 소스 필터
        use_hybrid: 하이브리드 검색 사용 여부
        use_rerank: Re-ranking 사용 여부
        use_compression: Context Compression 사용 여부

    Returns:
        검색 결과 문서 리스트
    """
    logger.info(f"고급 RAG 검색: hybrid={use_hybrid}, rerank={use_rerank}, compression={use_compression}")

    # 1. 초기 검색 (더 많은 문서 검색)
    initial_k = k * 3 if use_rerank or use_compression else k

    if use_hybrid:
        results = hybrid_search(query, k=initial_k, source_filter=source_filter)
    else:
        from backend.rag_pipeline import query_rag_with_filter, query_rag
        if source_filter:
            results = query_rag_with_filter(query, source_filter=source_filter, k=initial_k)
        else:
            results = query_rag(query, k=initial_k)

    # 2. Re-ranking (선택적)
    if use_rerank and results:
        results = rerank_documents(query, results, top_k=k * 2 if use_compression else k)

    # 3. Context Compression (선택적)
    if use_compression and results:
        llm = get_llm(temperature=0.0)
        compressor = LLMChainExtractor.from_llm(llm)
        results = compressor.compress_documents(results, query)[:k]

    return results[:k]


if __name__ == "__main__":
    # 테스트
    print("=== Hybrid Search 테스트 ===")
    results = hybrid_search("푸들 건강", k=3)
    for i, doc in enumerate(results):
        print(f"[{i+1}] {doc.page_content[:100]}...")

    print("\n=== Advanced RAG 테스트 (모든 기능) ===")
    results = advanced_rag_search(
        "강아지 밈 말투",
        k=3,
        use_hybrid=True,
        use_rerank=True,
        use_compression=True
    )
    for i, doc in enumerate(results):
        print(f"[{i+1}] {doc.page_content[:100]}...")
