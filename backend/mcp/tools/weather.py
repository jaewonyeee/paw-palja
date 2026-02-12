"""
Weather Tool - MCP Standard Implementation
OpenWeatherMap API를 통한 날씨 정보 조회
"""
import os
import requests
from typing import Dict, Any
from dotenv import load_dotenv

load_dotenv()


class WeatherTool:
    """날씨 정보 조회 도구 (MCP 표준)"""

    NAME = "get_weather"
    VERSION = "1.0.0"
    CATEGORY = "external_api"
    DESCRIPTION = "지정된 도시의 현재 날씨 정보를 OpenWeatherMap API를 통해 조회합니다."

    PARAMETERS = {
        "city": {
            "type": "string",
            "description": "도시명 (기본값: Seoul)",
            "default": "Seoul",
            "required": False,
        }
    }

    RETURNS = {
        "type": "object",
        "properties": {
            "weather": {"type": "string", "description": "날씨 상태"},
            "temp": {"type": "number", "description": "온도 (섭씨)"},
            "feels_like": {"type": "number", "description": "체감 온도"},
            "humidity": {"type": "number", "description": "습도 (%)"},
            "city": {"type": "string", "description": "도시명"},
        },
    }

    @staticmethod
    def execute(city: str = "Seoul") -> Dict[str, Any]:
        """날씨 정보 조회 실행

        Args:
            city: 도시명 (기본값: Seoul)

        Returns:
            날씨 정보 딕셔너리
        """
        api_key = os.getenv("OPENWEATHER_API_KEY")
        if not api_key:
            return {
                "error": "OPENWEATHER_API_KEY not set",
                "weather": "정보 없음",
                "temp": 0,
                "feels_like": 0,
                "humidity": 0,
                "city": city,
            }

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
        except requests.exceptions.RequestException as e:
            return {
                "error": f"API 요청 오류: {str(e)}",
                "weather": "조회 실패",
                "temp": 0,
                "feels_like": 0,
                "humidity": 0,
                "city": city,
            }
        except Exception as e:
            return {
                "error": str(e),
                "weather": "조회 실패",
                "temp": 0,
                "feels_like": 0,
                "humidity": 0,
                "city": city,
            }
