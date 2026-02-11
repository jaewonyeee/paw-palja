"""
Apify를 통한 SNS 데이터 수집 모듈
Instagram, X(Twitter), TikTok 등 다양한 플랫폼에서
강아지 밈 + MZ/젠지 세대 밈 말투 데이터를 수집하여
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


def fetch_multiple_tags(tags=None, max_per_tag=5, language="ko"):
    """
    여러 해시태그에서 데이터를 수집합니다.

    Args:
        tags: 해시태그 리스트 (None이면 언어별 기본값 사용)
        max_per_tag: 태그당 최대 수집 개수
        language: 언어 코드 ("ko" 또는 "en")
    """
    if tags is None:
        # 언어별 기본 해시태그
        if language == "en":
            tags = [
                "dogsofinstagram",
                "dogmemes",
                "dogsbeingbasic",
                "dramaticdogs"
            ]
        else:  # 한국어
            tags = ["강아지밈", "강아지일상", "멍스타그램", "반려견"]

    all_results = []
    for tag in tags:
        results = fetch_instagram_memes(tag=tag, max_items=max_per_tag)
        # 언어 메타데이터 추가
        for result in results:
            result["language"] = language
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


def fetch_twitter_memes(query="dog memes", max_items=10, language="en"):
    """
    X(Twitter)에서 밈 데이터를 수집합니다.
    Apify의 Twitter Scraper Actor 사용
    """
    api_key = os.getenv("APIFY_API_KEY")
    if not api_key:
        print("APIFY_API_KEY가 설정되지 않았습니다.")
        return []

    client = ApifyClient(api_key)

    run_input = {
        "searchTerms": [query],
        "maxTweets": max_items,
        "languageCode": language if language == "en" else "ko",
    }

    print(f"Apify X(Twitter): '{query}' 데이터 수집 중... (최대 {max_items}건)")
    try:
        # Twitter Scraper Actor 사용
        run = client.actor("apify/twitter-scraper").call(run_input=run_input)

        results = []
        for item in client.dataset(run["defaultDatasetId"]).iterate_items():
            text = item.get("text", "")
            if text and len(text) > 10:
                results.append({
                    "caption": text[:500],
                    "url": item.get("url", ""),
                    "timestamp": item.get("createdAt", ""),
                    "likes": item.get("likeCount", 0),
                    "source": "twitter",
                    "language": language,
                })

        print(f"Apify X: {len(results)}건 수집 완료")
        return results
    except Exception as e:
        print(f"Apify X 수집 오류: {e}")
        return []


def fetch_multilingual_data():
    """
    다국어 + 다플랫폼 SNS 데이터를 수집합니다.
    - Instagram: 강아지 밈
    - X(Twitter): 강아지 + MZ/젠지 밈
    """
    all_data = []

    # === 한국어 데이터 수집 ===
    print("\n=== 한국어 데이터 수집 ===")

    # Instagram 강아지 밈
    print("[Instagram KO]")
    ko_insta_data = fetch_multiple_tags(max_per_tag=2, language="ko")
    all_data.extend(ko_insta_data)

    # X(Twitter) 강아지 + MZ 밈
    print("[Twitter KO]")
    ko_twitter_dogs = fetch_twitter_memes("강아지 밈", max_items=3, language="ko")
    all_data.extend(ko_twitter_dogs)

    ko_twitter_mz = fetch_twitter_memes("MZ세대 밈", max_items=3, language="ko")
    all_data.extend(ko_twitter_mz)

    # === 영어 데이터 수집 ===
    print("\n=== 영어 데이터 수집 ===")

    # Instagram 강아지 밈
    print("[Instagram EN]")
    en_insta_data = fetch_multiple_tags(max_per_tag=2, language="en")
    all_data.extend(en_insta_data)

    # X(Twitter) 강아지 + 젠지 밈
    print("[Twitter EN]")
    en_twitter_dogs = fetch_twitter_memes("dog memes", max_items=3, language="en")
    all_data.extend(en_twitter_dogs)

    en_twitter_genz = fetch_twitter_memes("gen z memes", max_items=3, language="en")
    all_data.extend(en_twitter_genz)

    en_twitter_slang = fetch_twitter_memes("gen z slang no cap fr", max_items=3, language="en")
    all_data.extend(en_twitter_slang)

    return all_data


if __name__ == "__main__":
    try:
        # 다국어 데이터 수집
        data = fetch_multilingual_data()

        if data:
            save_sns_data(data)
        else:
            print("수집된 데이터가 없습니다. 폴백 데이터를 생성합니다.")
            fallback = [
                # 한국어 폴백 - 강아지 밈
                {"caption": "우리 집 강아지가 또 간식 훔쳐먹다 걸림 ㅋㅋㅋ #강아지밈 #멍뭉이", "url": "", "timestamp": "", "likes": 0, "source": "fallback", "language": "ko"},
                {"caption": "산책 나가자고 했더니 현관에서 360도 회전하는 댕댕이 #멍스타그램", "url": "", "timestamp": "", "likes": 0, "source": "fallback", "language": "ko"},
                {"caption": "간식 줄 때: 세상에서 가장 착한 강아지 / 안 줄 때: 왜 나를 버린 거야 눈빛 #강아지일상", "url": "", "timestamp": "", "likes": 0, "source": "fallback", "language": "ko"},
                # 한국어 폴백 - MZ 밈 말투
                {"caption": "오늘도 갓생 살았다 인정? ㅇㅈ? 그럼 간식 주세요 제발 ㅋㅋㅋ", "url": "", "timestamp": "", "likes": 0, "source": "fallback", "language": "ko"},
                {"caption": "집사가 나 보고 뭐라는데 솔직히 1도 안 들림 ㅋㅋ 선택적 귀머거리 발동", "url": "", "timestamp": "", "likes": 0, "source": "fallback", "language": "ko"},
                {"caption": "밥그릇 비었는데 리필 안 해줌... 이게 맞아? 이게 나라야? 극혐", "url": "", "timestamp": "", "likes": 0, "source": "fallback", "language": "ko"},
                {"caption": "산책 안 가고 싶어서 드러누웠더니 집사가 포기함 ㅋㅋㅋ 정신승리 완료", "url": "", "timestamp": "", "likes": 0, "source": "fallback", "language": "ko"},
                # 영어 폴백 - 강아지 Sassy/Dramatic
                {"caption": "My human DARED to give me a veggie. A VEGGIE. Do I look like a rabbit? #dogsofinstagram #dramatic", "url": "", "timestamp": "", "likes": 0, "source": "fallback", "language": "en"},
                {"caption": "Caught the neighbor's cat staring at me through the window. The AUDACITY. #sassydog #drama", "url": "", "timestamp": "", "likes": 0, "source": "fallback", "language": "en"},
                {"caption": "Refused to walk in the rain. Made human carry me. I'm FANCY like that. #dogsbeingbasic #queen", "url": "", "timestamp": "", "likes": 0, "source": "fallback", "language": "en"},
                # 영어 폴백 - 젠지 슬랭
                {"caption": "My vibe is immaculate today no cap fr fr. Periodt. 💅", "url": "", "timestamp": "", "likes": 0, "source": "fallback", "language": "en"},
                {"caption": "That moment when human says 'no treats' and I'm like bestie??? make it make sense???", "url": "", "timestamp": "", "likes": 0, "source": "fallback", "language": "en"},
                {"caption": "Living my best life rn. Main character energy. Slay. 🐕✨", "url": "", "timestamp": "", "likes": 0, "source": "fallback", "language": "en"},
                {"caption": "Destroyed the couch but I'm baby so it's fine actually. No consequences for me fr.", "url": "", "timestamp": "", "likes": 0, "source": "fallback", "language": "en"},
                {"caption": "Human left for 5 minutes. I cried. We're in our dramatic era. 😭", "url": "", "timestamp": "", "likes": 0, "source": "fallback", "language": "en"},
            ]
            save_sns_data(fallback)
    except Exception as e:
        print(f"실행 오류: {e}")
