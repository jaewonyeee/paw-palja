"""
Paw-Palja API 라우터 패키지
"""
from backend.routes.auth import router as auth_router
from backend.routes.diary import router as diary_router
from backend.routes.comments import router as comments_router
from backend.routes.admin import router as admin_router
from backend.routes.agents import router as agents_router
from backend.routes.hospitals import router as hospitals_router
from backend.routes.social import router as social_router
from backend.routes.push import router as push_router
from backend.routes.analytics import router as analytics_router

__all__ = [
    "auth_router",
    "diary_router",
    "comments_router",
    "admin_router",
    "agents_router",
    "hospitals_router",
    "social_router",
    "push_router",
    "analytics_router",
]
