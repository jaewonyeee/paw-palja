"""
Paw-Palja Structured Output 스키마 정의
모든 Agent의 출력을 Pydantic 모델로 강제하여 파싱 에러를 방지합니다.
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from enum import Enum

# VAL: 이미지 크기 제한 (base64 기준 약 5MB)
_MAX_IMAGE_LEN = 7_000_000


# --- Enums ---
class RiskLevel(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


# --- Agent Output Models ---
class HoroscopeResult(BaseModel):
    """Oracle Agent 구조화 출력"""
    summary: str = Field(description="오늘의 운세 한 줄 요약")
    content: str = Field(description="상세 운세 내용 (100자 이상, 트렌드 반영)")
    lucky_item: str = Field(description="오늘의 럭키 아이템")
    interaction_hint: str = Field(description="집사와의 인터랙션 힌트")
    weather_context: str = Field(description="날씨 기반 조언")
    trend_reference: str = Field(description="트렌드 반영 요소")


class DiaryResult(BaseModel):
    """Journalist Agent 구조화 출력"""
    title: str = Field(description="일기 제목 (강아지 시점)")
    content: str = Field(description="일기 본문 (1인칭 강아지 시점, 밈 활용)")
    mood_icon: str = Field(description="오늘의 무드 아이콘 (예: sparkles, heart, cloud-rain)")
    meme_reference: str = Field(description="사용된 밈 레퍼런스")


class HealthAnalysis(BaseModel):
    """Vet Agent 구조화 출력 - CoT 사고 과정 포함"""
    risk_level: RiskLevel = Field(description="위험도 수준")
    symptom_analysis: str = Field(description="Step 1: 증상 분석")
    duration_context: str = Field(description="Step 2: 기간/빈도 맥락")
    breed_context: str = Field(description="Step 3: 견종 특성 기반 분석")
    conclusion: str = Field(description="Step 4: 최종 결론")
    advice: str = Field(description="보호자를 위한 구체적 행동 권장사항")
    rag_sources: list[str] = Field(default_factory=list, description="참조된 RAG 데이터 출처")


# --- API Request/Response Models ---
class DogProfile(BaseModel):
    name: str = Field(max_length=50)
    breed: str = Field(max_length=50)
    mbti: str = Field(max_length=10)
    image: Optional[str] = None  # base64 이미지 또는 URL

    @field_validator("image")
    @classmethod
    def check_image_size(cls, v):
        if v and len(v) > _MAX_IMAGE_LEN:
            raise ValueError("이미지 크기가 너무 큽니다 (최대 5MB)")
        return v


class DailyLog(BaseModel):
    mood: str = Field(max_length=50)
    food: str = Field(max_length=50)
    walk: str = Field(max_length=20)
    poop: str = Field(max_length=50)
    notes: Optional[str] = Field(default="", max_length=500)
    photo: Optional[str] = None  # base64 이미지 (일기 사진 첨부)

    @field_validator("photo")
    @classmethod
    def check_photo_size(cls, v):
        if v and len(v) > _MAX_IMAGE_LEN:
            raise ValueError("사진 크기가 너무 큽니다 (최대 5MB)")
        return v


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
    text: str = Field(description="댓글 내용 (1~2문장, 귀엽고 감성적)")


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


class SignupRequest(BaseModel):
    user_id: str = Field(min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9]+$")
    nickname: str = Field(min_length=1, max_length=30)
    password: str = Field(min_length=4, max_length=100)
    dog: DogProfile
    diary_time: str = Field(default="09:00", pattern=r"^\d{2}:\d{2}$")
