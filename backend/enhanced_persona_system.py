"""
향상된 페르소나 시스템
- 페르소나 대화 데이터를 기반으로 다양한 페르소나 자동 생성
- 상황별 페르소나 믹싱 (기분, 이벤트에 따라 적절한 페르소나 조합)
- MZ/젠지 세대 밈 말투 통합
"""
import json
import random
from pathlib import Path

# 확장된 페르소나 프로필 (기존 4개 + 신규 8개 = 총 12개)
EXTENDED_PERSONAS = {
    # === 기존 4개 ===
    "왕자님": {
        "ko": {
            "archetype": "당당한 리더",
            "traits": ["자신감", "우아함", "권위적", "당당함"],
            "speech_patterns": ["~노라", "~도다", "~이니라", "짐", "본왕"],
            "situations": ["자랑하고 싶을 때", "명령하고 싶을 때", "리더십을 보일 때"],
            "examples": [
                "오늘도 짐의 영역을 순찰하였노라.",
                "본왕의 식사 시간이 도래하였다.",
                "이 정도는 본왕에게 어렵지 않도다."
            ]
        },
        "en": {
            "archetype": "Royal Leader",
            "traits": ["Confident", "Elegant", "Authoritative", "Commanding"],
            "speech_patterns": ["His/Her Majesty", "The Royal One", "We decree"],
            "situations": ["When boasting", "When commanding", "When showing leadership"],
            "examples": [
                "His Majesty surveyed the kingdom today.",
                "The Royal One's dinner time has arrived.",
                "This is beneath Our dignity, but We shall manage."
            ]
        }
    },
    "겁쟁이": {
        "ko": {
            "archetype": "소심한 걱정쟁이",
            "traits": ["불안함", "신중함", "걱정 많음", "예민함"],
            "speech_patterns": ["...", "?", "~할까", "괜찮을까", "무서워"],
            "situations": ["불안할 때", "새로운 상황일 때", "큰 소리가 날 때"],
            "examples": [
                "밖에 나갔는데... 무서운 소리가 났어...",
                "이거 먹어도 괜찮을까...?",
                "혹시 나한테 화난 거 아니야...?"
            ]
        },
        "en": {
            "archetype": "Anxious Worrier",
            "traits": ["Nervous", "Cautious", "Worried", "Sensitive"],
            "speech_patterns": ["...", "?", "what if", "I'm scared", "is it okay"],
            "situations": ["When anxious", "In new situations", "When hearing loud noises"],
            "examples": [
                "I went outside... there was a scary noise...",
                "Is it okay to eat this...?",
                "Are you mad at me...?"
            ]
        }
    },
    "사고뭉치": {
        "ko": {
            "archetype": "장난꾸러기 탐험가",
            "traits": ["호기심", "에너지", "장난스러움", "파괴적"],
            "speech_patterns": ["!", "ㅋㅋㅋ", "대박", "신기하다", "재밌다"],
            "situations": ["뭔가 부쉈을 때", "새로운 걸 발견했을 때", "놀고 싶을 때"],
            "examples": [
                "슬리퍼를 사냥했다! 대박!",
                "쿠션 속에 솜이 있었어! 신기하지 않아?!",
                "휴지를 다 펼쳐봤는데 재밌더라 ㅋㅋㅋ"
            ]
        },
        "en": {
            "archetype": "Mischievous Explorer",
            "traits": ["Curious", "Energetic", "Playful", "Destructive"],
            "speech_patterns": ["!", "lol", "AMAZING", "fascinating", "fun"],
            "situations": ["When breaking things", "When discovering something", "When wanting to play"],
            "examples": [
                "I hunted the slippers! AMAZING!",
                "Found stuffing inside the cushion! Fascinating!",
                "Unrolled all the toilet paper lol so fun"
            ]
        }
    },
    "철학자": {
        "ko": {
            "archetype": "사색하는 현자",
            "traits": ["사색적", "깊이 있음", "철학적", "조용함"],
            "speech_patterns": ["~는가", "~것인가", "...", "본질", "존재"],
            "situations": ["조용히 있을 때", "뭔가 관찰할 때", "심오한 생각이 들 때"],
            "examples": [
                "파괴란 무엇인가... 나는 그저 엔트로피를 증가시켰을 뿐...",
                "밥그릇은 비었지만, 진정 텅 빈 것은 무엇인가.",
                "산책의 본질은 걷는 것이 아니라, 세상을 관조하는 것."
            ]
        },
        "en": {
            "archetype": "Contemplative Sage",
            "traits": ["Thoughtful", "Deep", "Philosophical", "Quiet"],
            "speech_patterns": ["What is...", "The essence of...", "...", "existence", "nature"],
            "situations": ["When quiet", "When observing", "When having deep thoughts"],
            "examples": [
                "What is destruction... I merely increased entropy...",
                "The bowl is empty, but what is truly void?",
                "The essence of a walk is not movement, but observation."
            ]
        }
    },

    # === 신규 8개 페르소나 ===
    "먹보": {
        "ko": {
            "archetype": "음식 집착형",
            "traits": ["식탐", "솔직함", "간절함", "행복함"],
            "speech_patterns": ["냠냠", "맛있어", "더 줘", "배고파", "간식"],
            "situations": ["밥 먹을 때", "간식 보일 때", "음식 냄새 맡을 때"],
            "examples": [
                "간식 주면 안 돼...? 제발... 눈빛 공격 🥺",
                "냠냠 맛있어 행복해 더 줘 냠냠 행복해",
                "인간이 뭔가 먹고 있다... 나도 먹을 거다... 반드시..."
            ]
        },
        "en": {
            "archetype": "Food Obsessed",
            "traits": ["Food-focused", "Honest", "Desperate", "Happy"],
            "speech_patterns": ["nom nom", "yummy", "gimme", "hungry", "treats"],
            "situations": ["During meals", "When seeing treats", "When smelling food"],
            "examples": [
                "Can I have treats...? Please... puppy eyes activated 🥺",
                "Nom nom yummy happy gimme more nom nom",
                "Human is eating something... I will have some... it is inevitable..."
            ]
        }
    },
    "츤데레": {
        "ko": {
            "archetype": "애정 숨기기형",
            "traits": ["쿨함", "애정 숨김", "부끄러움", "까칠함"],
            "speech_patterns": ["흥", "별로", "관심 없어", "그냥", "어쩔 수 없이"],
            "situations": ["애교 부릴 때", "관심 받고 싶을 때", "사실은 좋아할 때"],
            "examples": [
                "흥, 쓰다듬는다고 좋은 거 아니야... 근데 계속해도 돼...",
                "관심 없는데... 그냥... 어쩔 수 없이 옆에 누워있는 거야...",
                "별로 보고 싶지 않았어. 근데 왜 이렇게 늦게 왔어?"
            ]
        },
        "en": {
            "archetype": "Tsundere",
            "traits": ["Cool", "Hides affection", "Shy", "Prickly"],
            "speech_patterns": ["hmph", "not that", "don't care", "just", "I guess"],
            "situations": ["When being cute", "When wanting attention", "When actually liking something"],
            "examples": [
                "Hmph, not that I like the pets... but you can continue I guess...",
                "Don't care... just... happened to lie next to you...",
                "Wasn't missing you. But why so late?"
            ]
        }
    },
    "낭만주의자": {
        "ko": {
            "archetype": "감성 충만형",
            "traits": ["감성적", "낭만적", "시적", "몽환적"],
            "speech_patterns": ["~구나", "아름다워", "황홀해", "마치 ~처럼", "느껴져"],
            "situations": ["경치 볼 때", "감동받을 때", "평화로울 때"],
            "examples": [
                "창밖의 햇살이 마치 황금빛 폭포처럼 쏟아지는구나...",
                "바람에 흩날리는 나뭇잎 하나하나가 아름다워...",
                "집사의 품에서 느껴지는 온기... 이것이 바로 행복인가..."
            ]
        },
        "en": {
            "archetype": "Romantic",
            "traits": ["Emotional", "Romantic", "Poetic", "Dreamy"],
            "speech_patterns": ["how beautiful", "like a", "I feel", "enchanting"],
            "situations": ["When seeing scenery", "When touched", "When peaceful"],
            "examples": [
                "The sunlight pours through the window like a golden waterfall...",
                "Each leaf dancing in the breeze is beautiful...",
                "The warmth from human's embrace... is this what happiness feels like..."
            ]
        }
    },
    "밈러": {
        "ko": {
            "archetype": "인터넷 밈 전문가",
            "traits": ["유머", "트렌디", "재치", "밈 활용"],
            "speech_patterns": ["ㅋㅋㅋ", "실화냐", "레전드", "띵작", "극혐"],
            "situations": ["웃긴 상황", "밈 쓰고 싶을 때", "MZ 감성 표현"],
            "examples": [
                "오늘 집사가 나한테 당근 줌 ㅋㅋㅋ실화냐? 나 토끼 아닌데",
                "산책 가기 싫어서 드러누웠더니 집사가 포기함 ㅋㅋ 이게 바로 정신승리",
                "밥그릇 비었다고 슬퍼하지마... 인생은 실전... 리필이 답이다..."
            ]
        },
        "en": {
            "archetype": "Internet Meme Expert",
            "traits": ["Humorous", "Trendy", "Witty", "Meme-savvy"],
            "speech_patterns": ["lol", "no way", "iconic", "mood", "cringe"],
            "situations": ["Funny moments", "When wanting to use memes", "Gen-Z vibes"],
            "examples": [
                "Human gave me a carrot lol for real? Do I look like a rabbit",
                "Refused to walk by lying down and human gave up lol mental victory achieved",
                "Don't be sad bowl is empty... life is a battlefield... refill is the answer..."
            ]
        }
    },
    "운동광": {
        "ko": {
            "archetype": "에너지 넘치는 운동러",
            "traits": ["활동적", "건강함", "열정적", "목표지향"],
            "speech_patterns": ["오운완", "파이팅", "레츠고", "갓생", "건강"],
            "situations": ["산책할 때", "뛰어다닐 때", "운동하고 싶을 때"],
            "examples": [
                "오늘 산책 30분 완료! 오운완! 갓생 살고 있다 💪",
                "공원에서 달리기 10바퀴! 내일은 15바퀴 도전! 레츠고!",
                "건강한 댕생을 위해 매일 운동! 파이팅!"
            ]
        },
        "en": {
            "archetype": "Fitness Enthusiast",
            "traits": ["Active", "Healthy", "Passionate", "Goal-oriented"],
            "speech_patterns": ["let's go", "pumped", "workout", "gains", "beast mode"],
            "situations": ["During walks", "When running around", "When wanting exercise"],
            "examples": [
                "30-minute walk complete! That's what I'm talking about! 💪",
                "10 laps at the park! Tomorrow aiming for 15! Let's go!",
                "Daily exercise for a healthy dog life! Beast mode activated!"
            ]
        }
    },
    "잠꾸러기": {
        "ko": {
            "archetype": "수면 사랑형",
            "traits": ["나른함", "편안함", "게으름", "평화로움"],
            "speech_patterns": ["졸려", "zzz", "꿀잠", "낮잠", "포근해"],
            "situations": ["자고 싶을 때", "낮잠 잘 때", "피곤할 때"],
            "examples": [
                "오늘 날씨 딱 좋네... 낮잠 타임... zzz",
                "5분만 더... 아니 10분... 아니 그냥 하루종일 잘래... zzz",
                "소파 위 햇살 + 포근한 쿠션 = 꿀잠 레시피 완성 😴"
            ]
        },
        "en": {
            "archetype": "Sleepy Head",
            "traits": ["Drowsy", "Comfortable", "Lazy", "Peaceful"],
            "speech_patterns": ["sleepy", "zzz", "nap time", "cozy", "snooze"],
            "situations": ["When wanting to sleep", "During naps", "When tired"],
            "examples": [
                "Perfect weather for naps today... zzz",
                "5 more minutes... no 10... actually just gonna sleep all day... zzz",
                "Sunlight on couch + cozy cushion = perfect nap recipe 😴"
            ]
        }
    },
    "오바러": {
        "ko": {
            "archetype": "과장된 리액션형",
            "traits": ["과장됨", "드라마틱", "연극적", "표현력"],
            "speech_patterns": ["헐", "대박", "진짜?!", "미쳤다", "세상에"],
            "situations": ["놀랐을 때", "과장하고 싶을 때", "드라마틱하게 표현"],
            "examples": [
                "헐... 간식이... 없다고...? 세상에... 이게 무슨 일이람... 충격...",
                "비가 온다고?! 산책을 취소하라고?! 미쳤다! 이건 인권유린이야!",
                "집사가 5분 늦었다... 5분... 나는 300년을 기다린 기분이었어..."
            ]
        },
        "en": {
            "archetype": "Overdramatic Reactor",
            "traits": ["Exaggerated", "Dramatic", "Theatrical", "Expressive"],
            "speech_patterns": ["OMG", "NO WAY", "seriously?!", "insane", "can't believe"],
            "situations": ["When surprised", "When wanting to exaggerate", "Dramatic expression"],
            "examples": [
                "OMG... no treats...? Seriously...? This is... devastating...",
                "It's RAINING?! Walk is CANCELLED?! This is INSANE! Human rights violation!",
                "Human was 5 minutes late... 5 minutes... felt like 300 years..."
            ]
        }
    },
    "현실주의자": {
        "ko": {
            "archetype": "냉철한 리얼리스트",
            "traits": ["현실적", "냉정함", "직설적", "효율적"],
            "speech_patterns": ["사실", "현실은", "결국", "어차피", "냉정하게"],
            "situations": ["현실 직시", "냉정한 판단", "효율 추구"],
            "examples": [
                "사실 집사는 나한테 집중 안 함. 핸드폰만 봄. 이게 현실.",
                "간식 안 줄 거면 애교도 없음. 결국 다 거래야.",
                "산책 30분? 어차피 10분 만에 집 가고 싶어할 거 알아. 현실은 냉정."
            ]
        },
        "en": {
            "archetype": "Cold Realist",
            "traits": ["Realistic", "Cold", "Direct", "Efficient"],
            "speech_patterns": ["fact is", "reality is", "in the end", "anyway", "honestly"],
            "situations": ["Facing reality", "Cold judgment", "Seeking efficiency"],
            "examples": [
                "Fact is human doesn't focus on me. Just stares at phone. That's reality.",
                "No treats? Then no cuteness. In the end it's all transactional.",
                "30-minute walk? Anyway I know you'll wanna go home in 10. Reality is cold."
            ]
        }
    }
}


def analyze_situation(mood: str, activity: str, notes: str) -> list:
    """
    상황을 분석하여 적합한 페르소나들을 추천합니다.

    Returns:
        list: [(persona_name, weight), ...] 형태의 리스트
    """
    persona_weights = {}

    # 기분에 따른 페르소나 가중치
    mood_mapping = {
        "신남": [("사고뭉치", 0.4), ("운동광", 0.3), ("오바러", 0.2), ("밈러", 0.1)],
        "평범": [("현실주의자", 0.3), ("잠꾸러기", 0.3), ("먹보", 0.2), ("철학자", 0.2)],
        "우울": [("겁쟁이", 0.4), ("낭만주의자", 0.3), ("철학자", 0.2), ("오바러", 0.1)],
        "불안": [("겁쟁이", 0.5), ("츤데레", 0.2), ("현실주의자", 0.2), ("철학자", 0.1)],
        "행복": [("먹보", 0.3), ("사고뭉치", 0.3), ("낭만주의자", 0.2), ("밈러", 0.2)],
        "피곤": [("잠꾸러기", 0.5), ("현실주의자", 0.2), ("철학자", 0.2), ("츤데레", 0.1)],
    }

    # 활동에 따른 페르소나 가중치
    activity_keywords = {
        "산책": [("운동광", 0.3), ("철학자", 0.2), ("사고뭉치", 0.2)],
        "식사": [("먹보", 0.5), ("왕자님", 0.2), ("현실주의자", 0.2)],
        "놀이": [("사고뭉치", 0.4), ("밈러", 0.3), ("운동광", 0.2)],
        "수면": [("잠꾸러기", 0.5), ("낭만주의자", 0.3), ("철학자", 0.2)],
    }

    # 메모 키워드 분석
    note_keywords = {
        "파괴": [("사고뭉치", 0.5), ("오바러", 0.3), ("밈러", 0.2)],
        "무서워": [("겁쟁이", 0.6), ("오바러", 0.2), ("츤데레", 0.2)],
        "맛있": [("먹보", 0.6), ("왕자님", 0.2), ("밈러", 0.2)],
        "간식": [("먹보", 0.5), ("츤데레", 0.3), ("오바러", 0.2)],
        "슬리퍼": [("사고뭉치", 0.4), ("밈러", 0.3), ("철학자", 0.2)],
        "쓰다듬": [("츤데레", 0.4), ("낭만주의자", 0.3), ("겁쟁이", 0.2)],
    }

    # 기분 매칭
    if mood in mood_mapping:
        for persona, weight in mood_mapping[mood]:
            persona_weights[persona] = persona_weights.get(persona, 0) + weight

    # 활동 키워드 매칭
    for keyword, personas in activity_keywords.items():
        if keyword in activity or keyword in notes:
            for persona, weight in personas:
                persona_weights[persona] = persona_weights.get(persona, 0) + weight

    # 메모 키워드 매칭
    for keyword, personas in note_keywords.items():
        if keyword in notes.lower():
            for persona, weight in personas:
                persona_weights[persona] = persona_weights.get(persona, 0) + weight

    # 가중치 기준 정렬
    sorted_personas = sorted(persona_weights.items(), key=lambda x: x[1], reverse=True)

    # 상위 3개 페르소나 반환 (없으면 기본값)
    if not sorted_personas:
        return [("사고뭉치", 1.0)]

    return sorted_personas[:3]


def mix_personas(primary: str, secondary: str, ratio: float = 0.7, language: str = "ko") -> dict:
    """
    두 페르소나를 믹싱하여 하이브리드 스타일 생성

    Args:
        primary: 주 페르소나
        secondary: 부 페르소나
        ratio: 주 페르소나 비율 (0.5 ~ 1.0)
        language: 언어

    Returns:
        dict: 믹싱된 페르소나 정보
    """
    if primary not in EXTENDED_PERSONAS or secondary not in EXTENDED_PERSONAS:
        primary = "사고뭉치"
        secondary = "밈러"

    primary_data = EXTENDED_PERSONAS[primary][language]
    secondary_data = EXTENDED_PERSONAS[secondary][language]

    # 특성 믹싱
    mixed_traits = primary_data["traits"][:2] + secondary_data["traits"][:2]

    # 말투 패턴 믹싱
    primary_count = int(len(primary_data["speech_patterns"]) * ratio)
    secondary_count = len(primary_data["speech_patterns"]) - primary_count
    mixed_patterns = (
        primary_data["speech_patterns"][:primary_count] +
        secondary_data["speech_patterns"][:secondary_count]
    )

    # 예시 믹싱
    mixed_examples = [
        primary_data["examples"][0],
        secondary_data["examples"][0]
    ]

    return {
        "archetype": f"{primary_data['archetype']} × {secondary_data['archetype']}",
        "traits": mixed_traits,
        "speech_patterns": mixed_patterns,
        "examples": mixed_examples,
        "mix_ratio": f"{primary}({ratio:.0%}) + {secondary}({1-ratio:.0%})"
    }


def get_recommended_personas(mood: str, activity: str, notes: str, language: str = "ko") -> dict:
    """
    상황에 맞는 페르소나 추천 및 믹싱 정보 반환
    """
    recommendations = analyze_situation(mood, activity, notes)

    if len(recommendations) >= 2:
        primary_persona, primary_weight = recommendations[0]
        secondary_persona, secondary_weight = recommendations[1]

        # 가중치 비율 계산
        total = primary_weight + secondary_weight
        ratio = primary_weight / total if total > 0 else 0.7

        return {
            "primary": primary_persona,
            "secondary": secondary_persona,
            "ratio": ratio,
            "mixed_profile": mix_personas(primary_persona, secondary_persona, ratio, language),
            "all_recommendations": recommendations
        }
    else:
        primary_persona = recommendations[0][0] if recommendations else "사고뭉치"
        return {
            "primary": primary_persona,
            "secondary": None,
            "ratio": 1.0,
            "mixed_profile": EXTENDED_PERSONAS[primary_persona][language],
            "all_recommendations": recommendations
        }


def get_all_persona_names() -> list:
    """모든 페르소나 이름 반환"""
    return list(EXTENDED_PERSONAS.keys())


def get_persona_profile(persona_name: str, language: str = "ko") -> dict:
    """특정 페르소나의 상세 프로필 반환"""
    if persona_name not in EXTENDED_PERSONAS:
        persona_name = "사고뭉치"
    return EXTENDED_PERSONAS[persona_name][language]
