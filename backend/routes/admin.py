"""
어드민 대시보드 API 라우터
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from backend import user_store
from backend.database import get_db
from backend.auth import require_admin

router = APIRouter()


@router.get("/admin/stats", dependencies=[Depends(require_admin)])
async def admin_stats(db: AsyncSession = Depends(get_db)):
    """어드민 대시보드 통계"""
    return await user_store.get_all_users_with_diary_counts(db)


@router.get("/admin/system", dependencies=[Depends(require_admin)])
async def admin_system():
    """시스템 정보"""
    return {
        "version": "3.0.0",
        "agents": ["oracle", "journalist", "vet"],
        "comment_personas": ["뽀삐언니", "츄르대장", "할배멍", "멍스타그램", "Dr.왕왕"],
        "features": ["tool_calling", "a2a_collaboration", "rag", "memory", "sse_streaming"],
    }
