"""
Apify를 통한 SNS 데이터 수집 모듈
Instagram 해시태그 기반 강아지 밈/트렌드 데이터를 수집하여
ChromaDB RAG 파이프라인에 활용합니다.
"""
import os
import json
from apify_client import ApifyClient
from dotenv import load_dotenv

load_dotenv()

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "raw")


def fetch_instagram_memes(tag="강아지밈", max_items=10):
    """Instagram 해시태그 기반으로 강아지 관련 콘텐츠를 수집합니다."""
    api_key = os.getenv("APIFY_API_KEY")
    if not api_key:
        print("APIFY_API_KEY가 설정되지 않았습니다.")
        return []

    client = ApifyClient(api_key)

    run_input = {
        "hashtags": [tag],
        "resultsLimit": max_items,
    }

    print(f"Apify: #{tag} 데이터 수집 중... (최대 {max_items}건)")
    try:
        run = client.actor("apify/instagram-hashtag-scraper").call(run_input=run_input)

        results = []
        for item in client.dataset(run["defaultDatasetId"]).iterate_items():
            caption = item.get("caption", "")
            if caption and len(caption) > 10:
                results.append({
                    "caption": caption[:500],
                    "url": item.get("url", ""),
                    "timestamp": item.get("timestamp", ""),
                    "likes": item.get("likesCount", 0),
                    "source": "instagram",
                })

        print(f"Apify: {len(results)}건 수집 완료")
        return results
    except Exception as e:
        print(f"Apify 수집 오류: {e}")
        return []


def fetch_multiple_tags(tags=None, max_per_tag=5):
    """여러 해시태그에서 데이터를 수집합니다."""
    if tags is None:
        tags = ["강아지밈", "강아지일상", "멍스타그램", "반려견"]

    all_results = []
    for tag in tags:
        results = fetch_instagram_memes(tag=tag, max_items=max_per_tag)
        all_results.extend(results)

    return all_results


def save_sns_data(data, filename="sns_memes.json"):
    """수집된 데이터를 JSON 파일로 저장합니다."""
    os.makedirs(DATA_DIR, exist_ok=True)
    filepath = os.path.join(DATA_DIR, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"저장 완료: {filepath} ({len(data)}건)")
    return filepath


if __name__ == "__main__":
    try:
        data = fetch_multiple_tags()
        if data:
            save_sns_data(data)
        else:
            print("수집된 데이터가 없습니다. 폴백 데이터를 생성합니다.")
            fallback = [
                {"caption": "우리 집 강아지가 또 간식 훔쳐먹다 걸림 ㅋㅋㅋ #강아지밈 #멍뭉이", "url": "", "timestamp": "", "likes": 0, "source": "fallback"},
                {"caption": "산책 나가자고 했더니 현관에서 360도 회전하는 댕댕이 #멍스타그램", "url": "", "timestamp": "", "likes": 0, "source": "fallback"},
                {"caption": "간식 줄 때: 세상에서 가장 착한 강아지 / 안 줄 때: 왜 나를 버린 거야 눈빛 #강아지일상", "url": "", "timestamp": "", "likes": 0, "source": "fallback"},
                {"caption": "비 오는 날 산책 거부하고 이불 위에서 죽은 척하는 포메 #반려견 #강아지밈", "url": "", "timestamp": "", "likes": 0, "source": "fallback"},
                {"caption": "목욕 후 미친 듯이 뛰어다니는 건 만국 공통인 듯 #강아지일상 #댕댕이", "url": "", "timestamp": "", "likes": 0, "source": "fallback"},
            ]
            save_sns_data(fallback)
    except Exception as e:
        print(f"실행 오류: {e}")
