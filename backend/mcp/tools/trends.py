"""
Trends Search Tool - MCP Standard Implementation
Tavily API를 통한 최신 트렌드/뉴스 검색
"""
import os
from typing import Any
from dotenv import load_dotenv

load_dotenv()


class TrendsTool:
    """트렌드 검색 도구 (MCP 표준)"""

    NAME = "search_trends"
    VERSION = "1.0.0"
    CATEGORY = "external_api"
    DESCRIPTION = "Tavily API를 사용하여 최신 트렌드 및 뉴스를 검색합니다."

    PARAMETERS = {
        "query": {
            "type": "string",
            "description": "검색 쿼리 (예: '강아지 트렌드 2026')",
            "required": True,
        },
        "max_results": {
            "type": "integer",
            "description": "최대 검색 결과 수 (기본값: 3)",
            "default": 3,
            "required": False,
        },
    }

    RETURNS = {
        "type": "string",
        "description": "검색 결과 요약 텍스트 (여러 결과를 ---로 구분)",
    }

    @staticmethod
    def execute(query: str, max_results: int = 3) -> str:
        """트렌드 검색 실행

        Args:
            query: 검색 쿼리
            max_results: 최대 결과 수 (기본값: 3)

        Returns:
            검색 결과 요약 텍스트
        """
        api_key = os.getenv("TAVILY_API_KEY")
        if not api_key:
            return "트렌드 검색 API 키가 설정되지 않았습니다."

        try:
            from tavily import TavilyClient

            client = TavilyClient(api_key=api_key)
            result = client.search(query, max_results=max_results)

            summaries = []
            for r in result.get("results", []):
                content = r.get("content", "")
                if content:
                    summaries.append(content[:200])

            return "\n---\n".join(summaries) if summaries else "검색 결과가 없습니다."

        except ImportError:
            return "Tavily 라이브러리가 설치되지 않았습니다. 'pip install tavily-python' 실행 필요."
        except Exception as e:
            return f"트렌드 검색 오류: {str(e)}"
