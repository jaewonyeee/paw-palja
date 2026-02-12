"""
Paw-Palja FastAPI Backend
라우터 기반 모듈화 구조
"""
import os
import logging
import time
import uuid
import warnings
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from dotenv import load_dotenv
from slowapi.errors import RateLimitExceeded

from backend.logger import setup_logging

warnings.filterwarnings("ignore", category=UserWarning)
load_dotenv()

# Activate structured JSON logging (replaces logging.basicConfig)
setup_logging(
    log_level=os.getenv("LOG_LEVEL", "INFO"),
    json_format=os.getenv("LOG_FORMAT", "json") == "json",
)
logger = logging.getLogger("pawpalja")

if os.getenv("GOOGLE_API_KEY") and os.getenv("GEMINI_API_KEY"):
    os.environ.pop("GEMINI_API_KEY", None)


# Rate limiter (shared module to avoid circular imports)
from backend.rate_limit import limiter  # noqa: E402


def _rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Too many requests. Please wait before trying again.",
            "retry_after": str(exc.detail),
        },
    )


from backend.routes import (
    auth_router,
    diary_router,
    comments_router,
    admin_router,
    agents_router,
    hospitals_router,
    social_router,
    push_router,
    analytics_router,
)
from backend import user_store
from backend.database import init_db, AsyncSessionLocal
from backend.scheduler import start_scheduler
from backend.cache import init_redis, close_redis
from backend.tasks import get_arq_pool, close_arq_pool

# 스케줄러 관리
_scheduler = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI 시작/종료 시 DB, Redis 초기화 및 스케줄러 관리"""
    global _scheduler
    # 시작 시
    logger.info("FastAPI 서버 시작 중...")
    await init_db()
    await init_redis()

    # Initialize ARQ pool if task queue is enabled
    if os.getenv("USE_TASK_QUEUE", "false").lower() in ("true", "1", "yes"):
        try:
            await get_arq_pool()
            logger.info("ARQ task queue pool initialized")
        except Exception as exc:
            logger.warning("ARQ pool init failed (%s) — task queue disabled", exc)

    # 관리자 계정 자동 생성
    _admin_pw = os.getenv("ADMIN_PASSWORD", "admin!")
    async with AsyncSessionLocal() as db:
        admin = await user_store.get_user(db, "admin")
        if not admin:
            await user_store.signup(db, "admin", "관리자", _admin_pw, {"name": "포포자", "breed": "믹스견", "mbti": "ENTJ"})
            logger.info("Admin account created")

    _scheduler = start_scheduler()
    yield
    # 종료 시
    logger.info("FastAPI 서버 종료 중...")
    if _scheduler:
        _scheduler.shutdown()
    await close_arq_pool()
    await close_redis()


app = FastAPI(
    title="Paw-Palja API",
    description="반려견 운세 기반 육아일기 & 건강 관리 Agent Backend",
    version="3.0.0",
    lifespan=lifespan,
)

# SEC-005: CORS 도메인 제한 (환경변수로 설정 가능)
_allowed_origins = os.getenv(
    "ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:8000"
).split(",")


# ============================================================
# Middleware: Request ID + Request Logging + Security Headers
# ============================================================

class RequestIDMiddleware(BaseHTTPMiddleware):
    """Generate a unique request ID for each request and inject into logging context."""

    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log every request with method, path, status, duration, and request_id."""

    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        request_id = getattr(request.state, "request_id", "-")
        try:
            response = await call_next(request)
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            logger.info(
                "request completed",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_ms": duration_ms,
                },
            )
            return response
        except Exception as exc:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            logger.error(
                f"request failed: {exc}",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "duration_ms": duration_ms,
                },
                exc_info=True,
            )
            raise


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to every response."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response


# i18n: Accept-Language middleware (must be added before CORS so it runs first)
class AcceptLanguageMiddleware(BaseHTTPMiddleware):
    _SUPPORTED = ("ko", "en", "ja", "zh", "es")

    async def dispatch(self, request: Request, call_next):
        accept = request.headers.get("Accept-Language", "").lower()
        lang = "ko"  # default
        for supported in self._SUPPORTED:
            if supported in accept:
                lang = supported
                break
        request.state.lang = lang
        return await call_next(request)


# Middleware registration order matters:
# Starlette processes middleware in LIFO order (last added = first to run).
# Execution order: CORS -> SecurityHeaders -> RequestID -> RequestLogging -> AcceptLanguage
app.add_middleware(AcceptLanguageMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Accept-Language"],
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 라우터 등록 (API v1 prefix)
_V1 = "/api/v1"
app.include_router(auth_router, prefix=_V1)
app.include_router(diary_router, prefix=_V1)
app.include_router(comments_router, prefix=_V1)
app.include_router(admin_router, prefix=_V1)
app.include_router(agents_router, prefix=_V1)
app.include_router(hospitals_router, prefix=_V1)
app.include_router(social_router, prefix=_V1)
app.include_router(push_router, prefix=_V1)
app.include_router(analytics_router, prefix=_V1)


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
    async def serve_spa(full_path: str, request: Request):
        # Do not catch API routes — let FastAPI return 404 for unknown API paths
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        # SEC-002: Path Traversal 방어
        from backend.i18n import get_message, get_lang
        requested = (_FRONTEND_RESOLVED / full_path).resolve()
        if not requested.is_relative_to(_FRONTEND_RESOLVED):
            raise HTTPException(status_code=403, detail=get_message("forbidden", get_lang(request)))
        if requested.is_file():
            return FileResponse(str(requested))
        return FileResponse(str(_FRONTEND_RESOLVED / "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
