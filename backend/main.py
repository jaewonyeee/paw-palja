"""
Paw-Palja FastAPI Backend
라우터 기반 모듈화 구조
"""
import os
import logging
import warnings
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv

warnings.filterwarnings("ignore", category=UserWarning)
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("pawpalja")

if os.getenv("GOOGLE_API_KEY") and os.getenv("GEMINI_API_KEY"):
    os.environ.pop("GEMINI_API_KEY", None)

from backend.routes import (
    auth_router,
    diary_router,
    comments_router,
    admin_router,
    agents_router,
    hospitals_router,
)
from backend import user_store

app = FastAPI(
    title="Paw-Palja API",
    description="반려견 운세 기반 육아일기 & 건강 관리 Agent Backend",
    version="3.0.0",
)

# SEC-005: CORS 도메인 제한 (환경변수로 설정 가능)
_allowed_origins = os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:8000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(auth_router)
app.include_router(diary_router)
app.include_router(comments_router)
app.include_router(admin_router)
app.include_router(agents_router)
app.include_router(hospitals_router)

# 관리자 계정 자동 생성 (비밀번호는 환경변수에서 읽기)
_admin_pw = os.getenv("ADMIN_PASSWORD", "admin!")
_admin_path = os.path.join(user_store.STORE_DIR, "admin.json")
if not os.path.exists(_admin_path):
    user_store.signup("admin", "관리자", _admin_pw, {"name": "포팔자", "breed": "믹스견", "mbti": "ENTJ"})


@app.get("/")
async def root():
    return {
        "service": "Paw-Palja API",
        "version": "3.0.0",
        "agents": ["oracle", "journalist", "vet"],
        "features": ["tool_calling", "a2a_collaboration", "rag", "memory"],
    }


@app.get("/health")
async def health_check():
    return {"status": "ok"}


# ============================================================
# Static file serving for React frontend
# ============================================================

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
_FRONTEND_RESOLVED = Path(FRONTEND_DIR).resolve()

if os.path.exists(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # SEC-002: Path Traversal 방어
        requested = (_FRONTEND_RESOLVED / full_path).resolve()
        if not requested.is_relative_to(_FRONTEND_RESOLVED):
            raise HTTPException(status_code=403, detail="Forbidden")
        if requested.is_file():
            return FileResponse(str(requested))
        return FileResponse(str(_FRONTEND_RESOLVED / "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
