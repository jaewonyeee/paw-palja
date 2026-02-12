"""
Advanced RAG Tools - MCP Standard Implementation
하이브리드 검색, Re-ranking, Context Compression
"""
from typing import Dict, Any, Optional, List


class AdvancedRAGTool:
    """고급 RAG 검색 도구 (MCP 표준)"""

    NAME = "advanced_rag_search"
    VERSION = "1.0.0"
    CATEGORY = "rag"
    DESCRIPTION = "하이브리드 검색, Re-ranking, Context Compression을 적용한 고급 RAG 검색"

    PARAMETERS = {
        "query": {
            "type": "string",
            "description": "검색 쿼리",
            "required": True,
        },
        "k": {
            "type": "integer",
            "description": "검색 결과 개수 (기본값: 5)",
            "default": 5,
            "required": False,
        },
        "source_filter": {
            "type": "string",
            "description": "데이터 소스 필터 (None이면 전체 검색)",
            "required": False,
        },
        "use_hybrid": {
            "type": "boolean",
            "description": "하이브리드 검색 사용 여부 (기본값: True)",
            "default": True,
            "required": False,
        },
        "use_rerank": {
            "type": "boolean",
            "description": "Re-ranking 사용 여부 (기본값: False)",
            "default": False,
            "required": False,
        },
        "use_compression": {
            "type": "boolean",
            "description": "Context Compression 사용 여부 (기본값: False)",
            "default": False,
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
    def execute(
        query: str,
        k: int = 5,
        source_filter: Optional[str] = None,
        use_hybrid: bool = True,
        use_rerank: bool = False,
        use_compression: bool = False
    ) -> List[Dict[str, Any]]:
        """고급 RAG 검색 실행

        Args:
            query: 검색 쿼리
            k: 검색 결과 개수
            source_filter: 데이터 소스 필터
            use_hybrid: 하이브리드 검색 사용
            use_rerank: Re-ranking 사용
            use_compression: Context Compression 사용

        Returns:
            검색 결과 리스트
        """
        try:
            from backend.rag_advanced import advanced_rag_search

            results = advanced_rag_search(
                query=query,
                k=k,
                source_filter=source_filter,
                use_hybrid=use_hybrid,
                use_rerank=use_rerank,
                use_compression=use_compression
            )

            return [
                {
                    "content": doc.page_content,
                    "metadata": doc.metadata,
                }
                for doc in results
            ]

        except Exception as e:
            return [{"error": f"고급 RAG 검색 오류: {str(e)}", "content": "", "metadata": {}}]
