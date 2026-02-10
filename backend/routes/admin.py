"""
어드민 대시보드 API 라우터
"""
import os
import json
from fastapi import APIRouter, Depends, HTTPException, Header
from backend import user_store

router = APIRouter()


async def _require_admin(x_user_id: str = Header(None)):
    """간이 어드민 인가 (x-user-id 헤더 확인)"""
    if x_user_id != "admin":
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다.")


@router.get("/admin/stats", dependencies=[Depends(_require_admin)])
async def admin_stats():
    """어드민 대시보드 통계"""
    _dir = user_store.STORE_DIR
    if not os.path.exists(_dir):
        return {"total_users": 0, "total_diaries": 0, "users": []}

    users = []
    total_diaries = 0
    for f in os.listdir(_dir):
        if f.endswith(".json") and not f.endswith("_diaries.json") and not f.endswith(".lock"):
            path = os.path.join(_dir, f)
            with open(path, "r", encoding="utf-8") as fh:
                u = json.load(fh)
            uid = u.get("user_id", f.replace(".json", ""))
            diary_path = os.path.join(_dir, f"{uid}_diaries.json")
            diary_count = 0
            if os.path.exists(diary_path):
                with open(diary_path, "r", encoding="utf-8") as dh:
                    diaries = json.load(dh)
                    diary_count = len(diaries)
            total_diaries += diary_count
            users.append({
                "user_id": uid,
                "nickname": u.get("nickname", ""),
                "dog": u.get("dog", {}),
                "diary_count": diary_count,
                "created_at": u.get("created_at", ""),
            })

    users.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return {"total_users": len(users), "total_diaries": total_diaries, "users": users}


@router.get("/admin/system", dependencies=[Depends(_require_admin)])
async def admin_system():
    """시스템 정보"""
    return {
        "version": "3.0.0",
        "agents": ["oracle", "journalist", "vet"],
        "comment_personas": ["뽀삐언니", "츄르대장", "할배멍", "멍스타그램", "Dr.왕왕"],
        "features": ["tool_calling", "a2a_collaboration", "rag", "memory", "sse_streaming"],
    }
