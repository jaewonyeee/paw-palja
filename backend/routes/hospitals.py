"""
위치 기반 동물병원 검색 API 라우터
"""
import os
from fastapi import APIRouter

router = APIRouter()


@router.get("/hospitals/nearby")
async def nearby_hospitals(lat: float, lng: float, radius: int = 3000):
    """위치 기반 근처 동물병원 검색 (Kakao Maps API or fallback)"""
    import httpx

    kakao_key = os.getenv("KAKAO_REST_API_KEY", "")
    hospitals = []

    if kakao_key:
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(
                    "https://dapi.kakao.com/v2/local/search/keyword.json",
                    params={"query": "동물병원", "x": str(lng), "y": str(lat), "radius": radius, "sort": "distance"},
                    headers={"Authorization": f"KakaoAK {kakao_key}"},
                )
                data = res.json()
                for doc in data.get("documents", [])[:5]:
                    hospitals.append({
                        "name": doc["place_name"],
                        "address": doc.get("road_address_name") or doc.get("address_name", ""),
                        "phone": doc.get("phone", ""),
                        "distance": doc.get("distance", ""),
                        "url": doc.get("place_url", ""),
                        "lat": float(doc.get("y", 0)),
                        "lng": float(doc.get("x", 0)),
                    })
        except Exception:
            pass

    if not hospitals:
        hospitals = [
            {"name": "주변 동물병원을 검색해보세요", "address": "카카오맵에서 '동물병원'을 검색하세요", "phone": "", "distance": "", "url": "", "lat": lat, "lng": lng},
        ]

    return {"hospitals": hospitals, "count": len(hospitals)}
