"""
Paw-Palja Structured Output 스키마 정의
모든 Agent의 출력을 Pydantic 모델로 강제하여 파싱 에러를 방지합니다.
다국어 지원: 모든 텍스트 필드는 _ko, _en 버전으로 동시 생성됩니다.
"""
import re

from pydantic import BaseModel, Field, field_validator
from typing import Optional
from enum import Enum

# VAL: 이미지 크기 제한 (base64 기준 약 5MB)
_MAX_IMAGE_LEN = 7_000_000
_IMAGE_DATA_URI_RE = re.compile(r"^data:image/(jpeg|png|gif|webp);base64,")
_IMAGE_URL_RE = re.compile(r"^https?://")


def _validate_image_field(v: str | None) -> str | None:
    """Validate that an image field is either a valid data URI or URL."""
    if not v:
        return v
    if len(v) > _MAX_IMAGE_LEN:
        raise ValueError("이미지 크기가 너무 큽니다 (최대 5MB)")
    if v.startswith("data:"):
        if not _IMAGE_DATA_URI_RE.match(v):
            raise ValueError("지원하지 않는 이미지 형식입니다 (JPEG, PNG, GIF, WebP만 허용)")
    elif not _IMAGE_URL_RE.match(v):
        raise ValueError("유효하지 않은 이미지 URL입니다")
    return v


# --- Enums ---
class RiskLevel(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


# --- 의료 고지 (Safety Disclaimer) ---
MEDICAL_DISCLAIMER_KO = "이 분석은 수의학적 참고 정보이며, 전문 수의사의 진료를 대체하지 않습니다."
MEDICAL_DISCLAIMER_EN = "This analysis is for reference only and does not replace professional veterinary advice."

EMERGENCY_GUIDANCE = {
    "Low": {
        "ko": "현재 특별한 이상은 보이지 않습니다.",
        "en": "No significant concerns at this time.",
    },
    "Medium": {
        "ko": "1주 내 호전되지 않으면 수의사 상담을 권장합니다.",
        "en": "If symptoms don't improve within a week, consult a veterinarian.",
    },
    "High": {
        "ko": "가능한 빨리 가까운 동물병원을 방문해주세요.",
        "en": "Please visit a veterinary clinic as soon as possible.",
    },
    "Critical": {
        "ko": "즉시 응급 동물병원을 방문해주세요. 야간/공휴일 응급 진료 가능 병원을 확인하세요.",
        "en": "Visit an emergency veterinary hospital immediately. Check for 24-hour emergency clinics.",
    },
}


# --- RAG 근거 출처 표준화 ---
class SourceItem(BaseModel):
    """RAG 검색 결과의 표준화된 출처 정보"""
    title: str = Field(description="문서 제목 (예: '푸들 건강 정보')")
    snippet: str = Field(default="", max_length=300, description="관련 텍스트 스니펫")
    source_type: str = Field(description="데이터 소스 (breeds/memes/sns/disease_qa/kisti_disease/personas)")
    score: float = Field(default=0.0, ge=0.0, le=1.0, description="유사도 점수")
    metadata: dict = Field(default_factory=dict, description="추가 메타데이터 (breed, disease_code 등)")


# --- Agent Output Models (다국어 지원) ---
class HoroscopeResult(BaseModel):
    """Oracle Agent 구조화 출력 - 한국어/영어 동시 생성"""
    summary_ko: str = Field(description="오늘의 운세 한 줄 요약 (한국어)")
    summary_en: str = Field(description="Today's fortune summary (English)")
    content_ko: str = Field(description="상세 운세 내용 (한국어, 100자 이상, 트렌드 반영)")
    content_en: str = Field(description="Detailed fortune content (English, 100+ chars, trend-aware)")
    lucky_item_ko: str = Field(description="오늘의 럭키 아이템 (한국어)")
    lucky_item_en: str = Field(description="Today's lucky item (English)")
    interaction_hint_ko: str = Field(description="집사와의 인터랙션 힌트 (한국어)")
    interaction_hint_en: str = Field(description="Interaction hint with human (English)")
    weather_context_ko: str = Field(description="날씨 기반 조언 (한국어)")
    weather_context_en: str = Field(description="Weather-based advice (English)")
    trend_reference_ko: str = Field(description="트렌드 반영 요소 (한국어)")
    trend_reference_en: str = Field(description="Trend reference element (English)")

    # Legacy fields for backward compatibility (deprecated)
    summary: Optional[str] = None
    content: Optional[str] = None
    lucky_item: Optional[str] = None
    interaction_hint: Optional[str] = None
    weather_context: Optional[str] = None
    trend_reference: Optional[str] = None


class DiaryResult(BaseModel):
    """Journalist Agent 구조화 출력 - 한국어/영어 동시 생성"""
    title_ko: str = Field(description="일기 제목 (강아지 시점, 한국어)")
    title_en: str = Field(description="Diary title (dog's perspective, English)")
    content_ko: str = Field(description="일기 본문 (1인칭 강아지 시점, 밈 활용, 한국어)")
    content_en: str = Field(description="Diary content (1st person dog POV, meme-aware, English)")
    mood_icon: str = Field(description="오늘의 무드 아이콘 (예: sparkles, heart, cloud-rain)")
    meme_reference_ko: str = Field(description="사용된 밈 레퍼런스 (한국어)")
    meme_reference_en: str = Field(description="Meme reference used (English)")

    # Legacy fields for backward compatibility (deprecated)
    title: Optional[str] = None
    content: Optional[str] = None
    meme_reference: Optional[str] = None


class HealthAnalysis(BaseModel):
    """Vet Agent 구조화 출력 - CoT 사고 과정 포함, 한국어/영어 동시 생성

    CoT 각 단계는 보호자가 이해할 수 있는 '요약된 근거' 수준으로 작성됩니다.
    내부 추론 과정은 숨기고, 사용자에게 유용한 결론과 근거만 노출합니다.
    """
    risk_level: RiskLevel = Field(description="위험도 수준")
    symptom_analysis_ko: str = Field(description="Step 1: 증상 분석 요약 — 보호자가 이해할 수 있는 핵심 소견 1~2문장 (한국어)")
    symptom_analysis_en: str = Field(description="Step 1: Symptom summary — key findings in 1-2 sentences for guardians (English)")
    duration_context_ko: str = Field(description="Step 2: 기간/빈도 요약 — 관찰 기간과 패턴 1~2문장 (한국어)")
    duration_context_en: str = Field(description="Step 2: Duration summary — observation period and patterns in 1-2 sentences (English)")
    breed_context_ko: str = Field(description="Step 3: 견종 관련 요약 — 해당 견종의 관련 특성 1~2문장 (한국어)")
    breed_context_en: str = Field(description="Step 3: Breed relevance summary — breed-specific traits in 1-2 sentences (English)")
    conclusion_ko: str = Field(description="Step 4: 최종 결론 — 종합 판단과 위험도 근거 (한국어)")
    conclusion_en: str = Field(description="Step 4: Final conclusion — overall assessment and risk rationale (English)")
    advice_ko: str = Field(description="보호자를 위한 구체적 행동 권장사항 (한국어)")
    advice_en: str = Field(description="Specific action recommendations for guardian (English)")
    disclaimer_ko: str = Field(default=MEDICAL_DISCLAIMER_KO, description="의료 고지 (한국어)")
    disclaimer_en: str = Field(default=MEDICAL_DISCLAIMER_EN, description="Medical disclaimer (English)")
    emergency_guidance_ko: str = Field(default="", description="위험도별 긴급 안내 (한국어)")
    emergency_guidance_en: str = Field(default="", description="Risk-level emergency guidance (English)")
    rag_sources: list[SourceItem] = Field(default_factory=list, description="참조된 RAG 데이터 출처 (표준화)")

    # Legacy fields for backward compatibility (deprecated)
    symptom_analysis: Optional[str] = None
    duration_context: Optional[str] = None
    breed_context: Optional[str] = None
    conclusion: Optional[str] = None
    advice: Optional[str] = None


# --- API Request/Response Models ---
class DogProfile(BaseModel):
    name: str = Field(max_length=50)
    breed: str = Field(max_length=50)
    mbti: str = Field(max_length=10)
    image: Optional[str] = None  # base64 이미지 또는 URL

    @field_validator("image")
    @classmethod
    def check_image(cls, v):
        return _validate_image_field(v)


class DailyLog(BaseModel):
    mood: str = Field(max_length=50)
    food: str = Field(max_length=50)
    walk: str = Field(max_length=20)
    poop: str = Field(max_length=50)
    notes: Optional[str] = Field(default="", max_length=500)
    photo: Optional[str] = None  # base64 이미지 (일기 사진 첨부)
    share_to_social: Optional[bool] = Field(default=None)

    @field_validator("photo")
    @classmethod
    def check_photo(cls, v):
        return _validate_image_field(v)


class AnalysisRequest(BaseModel):
    profile: DogProfile
    logs: DailyLog


class AnalysisResponse(BaseModel):
    horoscope: HoroscopeResult
    diary: DiaryResult
    health: HealthAnalysis
    agent_memos: list[dict] = Field(default_factory=list, description="A2A Agent 간 교환된 메모")


# --- Comment Models ---
class CommentRequest(BaseModel):
    diary_content: str = Field(max_length=5000)
    dog_name: str = Field(max_length=50)
    dog_breed: str = Field(max_length=50)


class CommentResult(BaseModel):
    author: str = Field(description="댓글 작성자 이름 (에이전트 페르소나)")
    emoji: str = Field(description="작성자 이모지")
    text_ko: str = Field(min_length=1, description="댓글 내용 (1~2문장, 귀엽고 감성적, 한국어)")
    text_en: str = Field(min_length=1, description="Comment content (1-2 sentences, cute & emotional, English)")

    # Legacy field for backward compatibility (deprecated)
    text: Optional[str] = None


class DiaryEditRequest(BaseModel):
    original_diary: str = Field(max_length=5000)
    edited_diary: str = Field(max_length=5000)
    dog_name: str = Field(max_length=50)
    dog_breed: str = Field(max_length=50)


# --- User / Session Models ---
class UserProfile(BaseModel):
    user_id: str
    nickname: str
    dog: DogProfile
    diary_time: str = Field(default="09:00", description="매일 다이어리 수신 시간 (HH:MM)")
    created_at: Optional[str] = None


class DiaryEntry(BaseModel):
    entry_id: str
    user_id: str
    date: str
    diary: DiaryResult
    horoscope: HoroscopeResult
    health: HealthAnalysis
    comments: list[dict] = Field(default_factory=list)
    agent_memos: list[dict] = Field(default_factory=list)
    is_edited: bool = False


class LoginRequest(BaseModel):
    user_id: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class SignupRequest(BaseModel):
    user_id: str = Field(min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9]+$")
    nickname: str = Field(min_length=1, max_length=30)
    password: str = Field(min_length=4, max_length=100)
    dog: DogProfile
    diary_time: str = Field(default="09:00", pattern=r"^\d{2}:\d{2}$")
    email: str = Field(min_length=1, max_length=255, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class UpdateUserRequest(BaseModel):
    dog: Optional[DogProfile] = None
    diary_time: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    email: Optional[str] = Field(default=None, max_length=255, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class PushSubscribeRequest(BaseModel):
    endpoint: str = Field(max_length=2000)
    p256dh: str = Field(max_length=500)
    auth_key: str = Field(max_length=500)


class PromptUpdateRequest(BaseModel):
    value: str
    config_type: str = Field(default="text", pattern=r"^(text|float|json)$")
