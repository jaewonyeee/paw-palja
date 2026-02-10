"""
Function Calling 도구 정의
Oracle Agent가 호출하는 외부 API 도구들입니다.
"""
import os
import requests
from langchain_core.tools import tool
from dotenv import load_dotenv

load_dotenv()


@tool
def get_weather(city: str = "Seoul") -> dict:
    """지정된 도시의 현재 날씨 정보를 가져옵니다.

    Args:
        city: 도시명 (기본값: Seoul)

    Returns:
        날씨 상태, 온도, 습도, 체감온도 정보
    """
    api_key = os.getenv("OPENWEATHER_API_KEY")
    if not api_key:
        return {"error": "OPENWEATHER_API_KEY not set", "weather": "정보 없음", "temp": 0}

    try:
        url = "http://api.openweathermap.org/data/2.5/weather"
        params = {"q": city, "appid": api_key, "units": "metric", "lang": "kr"}
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        return {
            "weather": data["weather"][0]["description"],
            "temp": data["main"]["temp"],
            "feels_like": data["main"]["feels_like"],
            "humidity": data["main"]["humidity"],
            "city": city,
        }
    except Exception as e:
        return {"error": str(e), "weather": "조회 실패", "temp": 0, "city": city}


@tool
def search_trends(query: str) -> str:
    """Tavily를 사용하여 최신 트렌드/뉴스를 검색합니다.

    Args:
        query: 검색 쿼리 (예: "강아지 트렌드 2025")

    Returns:
        검색 결과 요약 텍스트
    """
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        return "트렌드 검색 API 키가 설정되지 않았습니다."

    try:
        from tavily import TavilyClient
        client = TavilyClient(api_key=api_key)
        result = client.search(query, max_results=3)
        summaries = []
        for r in result.get("results", []):
            summaries.append(r.get("content", "")[:200])
        return "\n---\n".join(summaries) if summaries else "검색 결과가 없습니다."
    except Exception as e:
        return f"트렌드 검색 오류: {str(e)}"


@tool
def lookup_breed_info(breed: str) -> str:
    """RAG 벡터DB에서 견종 관련 정보를 검색합니다.

    Args:
        breed: 견종명 (예: "푸들")

    Returns:
        견종 특성, 건강 이슈, 케어 팁
    """
    try:
        from backend.rag_pipeline import query_rag
        results = query_rag(f"{breed} 특성 건강 케어", k=3)
        if results:
            return "\n\n".join([doc.page_content for doc in results])
        return f"{breed}에 대한 정보를 찾지 못했습니다."
    except Exception as e:
        return f"견종 정보 검색 오류: {str(e)}"


# 도구 목록
oracle_tools = [get_weather, search_trends, lookup_breed_info]
