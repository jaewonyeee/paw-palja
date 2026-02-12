"""
RAG Tool - MCP Standard Implementation
ChromaDB 벡터 검색을 통한 RAG 도구
"""
from typing import Dict, Any, Optional, List


class RAGTool:
    """RAG 벡터 검색 도구 (MCP 표준)"""

    NAME = "lookup_breed_info"
    VERSION = "1.0.0"
    CATEGORY = "rag"
    DESCRIPTION = "ChromaDB 벡터 DB에서 견종 관련 정보를 검색합니다."

    PARAMETERS = {
        "breed": {
            "type": "string",
            "description": "견종명 (예: '푸들', '말티즈')",
            "required": True,
        },
        "k": {
            "type": "integer",
            "description": "검색 결과 개수 (기본값: 3)",
            "default": 3,
            "required": False,
        },
    }

    RETURNS = {
        "type": "string",
        "description": "견종 특성, 건강 이슈, 케어 팁 정보",
    }

    @staticmethod
    def execute(breed: str, k: int = 3) -> str:
        """RAG 검색 실행

        Args:
            breed: 견종명
            k: 검색 결과 개수 (기본값: 3)

        Returns:
            검색 결과 텍스트
        """
        try:
            from backend.rag_pipeline import query_rag

            results = query_rag(f"{breed} 특성 건강 케어", k=k)
            if results:
                return "\n\n".join([doc.page_content for doc in results])
            return f"{breed}에 대한 정보를 찾지 못했습니다."

        except Exception as e:
            return f"견종 정보 검색 오류: {str(e)}"


class RAGSearchTool:
    """범용 RAG 검색 도구 (MCP 표준)"""

    NAME = "rag_search"
    VERSION = "1.0.0"
    CATEGORY = "rag"
    DESCRIPTION = "ChromaDB에서 메타데이터 필터를 적용한 유사도 검색을 수행합니다."

    PARAMETERS = {
        "query": {
            "type": "string",
            "description": "검색 쿼리",
            "required": True,
        },
        "source_filter": {
            "type": "string",
            "description": "데이터 소스 필터 (breeds, memes, sns, personas, disease_qa, kisti_disease 중 하나, None이면 전체 검색)",
            "required": False,
        },
        "k": {
            "type": "integer",
            "description": "검색 결과 개수 (기본값: 3)",
            "default": 3,
            "required": False,
        },
    }

    RETURNS = {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "content": {"type": "string"},
                "metadata": {"type": "object"},
            },
        },
        "description": "검색 결과 문서 리스트",
    }

    @staticmethod
    def execute(query: str, source_filter: Optional[str] = None, k: int = 3) -> List[Dict[str, Any]]:
        """RAG 검색 실행

        Args:
            query: 검색 쿼리
            source_filter: 데이터 소스 필터 (None이면 전체 검색)
            k: 검색 결과 개수

        Returns:
            검색 결과 리스트
        """
        try:
            from backend.rag_pipeline import query_rag_with_filter, query_rag

            if source_filter:
                results = query_rag_with_filter(query, source_filter=source_filter, k=k)
            else:
                results = query_rag(query, k=k)

            return [
                {
                    "content": doc.page_content,
                    "metadata": doc.metadata,
                }
                for doc in results
            ]

        except Exception as e:
            return [{"error": f"RAG 검색 오류: {str(e)}", "content": "", "metadata": {}}]
