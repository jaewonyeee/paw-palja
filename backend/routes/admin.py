"""
어드민 대시보드 API 라우터
"""
import os
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, text, or_
from sqlalchemy.ext.asyncio import AsyncSession
from backend import user_store
from backend.database import get_db, engine, DATABASE_URL
from backend.auth import require_admin
from backend.models import User, DogProfile, DiaryEntry, UserEvent, ApiUsageLog, PromptConfig
from backend.prompt_defaults import PROMPT_DEFAULTS, get_cached_prompt_value, refresh_prompt_cache, invalidate_cache
from backend.mcp.registry import get_registry
from backend.schemas import PromptUpdateRequest

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


# --- User Management ---

@router.get("/admin/users", dependencies=[Depends(require_admin)])
async def admin_users(
    q: str = Query("", description="Search query"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Paginated user search."""
    offset = (page - 1) * limit
    base = select(User)
    count_base = select(func.count(User.user_id))

    if q:
        pattern = f"%{q}%"
        condition = or_(User.user_id.ilike(pattern), User.nickname.ilike(pattern))
        base = base.where(condition)
        count_base = count_base.where(condition)

    total_result = await db.execute(count_base)
    total = total_result.scalar() or 0

    stmt = base.order_by(User.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    users = result.scalars().all()

    items = []
    for u in users:
        diary_count_r = await db.execute(
            select(func.count(DiaryEntry.entry_id)).where(DiaryEntry.user_id == u.user_id)
        )
        diary_count = diary_count_r.scalar() or 0
        items.append({
            "user_id": u.user_id,
            "nickname": u.nickname,
            "email": u.email,
            "dog": user_store._dog_to_dict(u.dog_profile),
            "diary_count": diary_count,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "limit": limit, "pages": max(1, -(-total // limit))}


@router.get("/admin/users/{user_id}/detail", dependencies=[Depends(require_admin)])
async def admin_user_detail(user_id: str, db: AsyncSession = Depends(get_db)):
    """User detail: profile + recent diaries + activity."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Recent diaries
    stmt = (
        select(DiaryEntry)
        .where(DiaryEntry.user_id == user_id)
        .order_by(DiaryEntry.created_at.desc())
        .limit(10)
    )
    result = await db.execute(stmt)
    diaries = result.scalars().all()

    # Diary count
    count_r = await db.execute(
        select(func.count(DiaryEntry.entry_id)).where(DiaryEntry.user_id == user_id)
    )
    diary_count = count_r.scalar() or 0

    # Recent events
    evt_stmt = (
        select(UserEvent)
        .where(UserEvent.user_id == user_id)
        .order_by(UserEvent.created_at.desc())
        .limit(20)
    )
    evt_result = await db.execute(evt_stmt)
    events = evt_result.scalars().all()

    return {
        "user_id": user.user_id,
        "nickname": user.nickname,
        "email": user.email,
        "bio": user.bio,
        "is_profile_public": user.is_profile_public,
        "dog": user_store._dog_to_dict(user.dog_profile),
        "diary_count": diary_count,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "recent_diaries": [
            {
                "entry_id": d.entry_id,
                "date": d.date,
                "is_public": d.is_public,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in diaries
        ],
        "recent_events": [
            {
                "event_type": e.event_type,
                "metadata": e.metadata_json,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in events
        ],
    }


@router.delete("/admin/users/{user_id}", dependencies=[Depends(require_admin)])
async def admin_delete_user(user_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a user. Prevents deleting admin account."""
    if user_id == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete admin account")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.delete(user)
    await db.commit()
    return {"success": True, "deleted_user_id": user_id}


# --- Diary Browser ---

@router.get("/admin/diaries", dependencies=[Depends(require_admin)])
async def admin_diaries(
    q: str = Query("", description="Search query"),
    user_id: str = Query("", description="Filter by user_id"),
    date_from: str = Query("", description="Start date YYYY-MM-DD"),
    date_to: str = Query("", description="End date YYYY-MM-DD"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Search/filter diary entries."""
    offset = (page - 1) * limit
    base = select(DiaryEntry)
    count_base = select(func.count(DiaryEntry.entry_id))

    conditions = []
    if user_id:
        conditions.append(DiaryEntry.user_id == user_id)
    if date_from:
        conditions.append(DiaryEntry.date >= date_from)
    if date_to:
        conditions.append(DiaryEntry.date <= date_to)
    if q:
        pattern = f"%{q}%"
        conditions.append(
            or_(DiaryEntry.user_id.ilike(pattern), DiaryEntry.date.ilike(pattern))
        )

    for cond in conditions:
        base = base.where(cond)
        count_base = count_base.where(cond)

    total_result = await db.execute(count_base)
    total = total_result.scalar() or 0

    stmt = base.order_by(DiaryEntry.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    entries = result.scalars().all()

    items = []
    for e in entries:
        diary_data = e.diary or {}
        preview = ""
        for key in ("content_ko", "content_en", "content"):
            if diary_data.get(key):
                preview = str(diary_data[key])[:100]
                break
        items.append({
            "entry_id": e.entry_id,
            "user_id": e.user_id,
            "date": e.date,
            "preview": preview,
            "is_public": e.is_public,
            "comment_count": len(e.comments or []),
            "created_at": e.created_at.isoformat() if e.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "limit": limit, "pages": max(1, -(-total // limit))}


@router.get("/admin/diaries/{entry_id}", dependencies=[Depends(require_admin)])
async def admin_diary_detail(entry_id: str, db: AsyncSession = Depends(get_db)):
    """Diary detail view for admin."""
    stmt = select(DiaryEntry).where(DiaryEntry.entry_id == entry_id)
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Diary entry not found")
    return user_store._entry_to_dict(entry)


# --- DB Status ---

@router.get("/admin/db-status", dependencies=[Depends(require_admin)])
async def admin_db_status(db: AsyncSession = Depends(get_db)):
    """Database status: table row counts, DB size, pool info."""
    tables = {}
    for table_name in ["users", "dog_profiles", "diary_entries", "user_events", "push_subscriptions", "api_usage_logs"]:
        try:
            r = await db.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
            tables[table_name] = r.scalar() or 0
        except Exception:
            tables[table_name] = 0

    db_type = "PostgreSQL" if DATABASE_URL.startswith("postgresql") else "SQLite"
    db_size = None

    try:
        if db_type == "PostgreSQL":
            r = await db.execute(text("SELECT pg_database_size(current_database())"))
            size_bytes = r.scalar() or 0
            db_size = f"{size_bytes / (1024 * 1024):.1f} MB"
        else:
            db_path = DATABASE_URL.split("///")[-1] if "///" in DATABASE_URL else None
            if db_path and os.path.exists(db_path):
                size_bytes = os.path.getsize(db_path)
                db_size = f"{size_bytes / (1024 * 1024):.1f} MB"
    except Exception:
        pass

    pool_status = None
    try:
        pool = engine.pool
        pool_status = {
            "size": pool.size(),
            "checked_in": pool.checkedin(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
        }
    except Exception:
        pass

    return {
        "db_type": db_type,
        "db_size": db_size,
        "tables": tables,
        "pool": pool_status,
    }


# --- API Usage ---

@router.get("/admin/api-usage", dependencies=[Depends(require_admin)])
async def admin_api_usage(
    period: str = Query("today", regex="^(today|week|month)$"),
    db: AsyncSession = Depends(get_db),
):
    """API usage statistics for given period."""
    now = datetime.now(timezone.utc)
    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start = now - timedelta(days=7)
    else:
        start = now - timedelta(days=30)

    base_filter = ApiUsageLog.created_at >= start

    # Total calls
    total_r = await db.execute(select(func.count(ApiUsageLog.id)).where(base_filter))
    total_calls = total_r.scalar() or 0

    # Success count
    success_r = await db.execute(
        select(func.count(ApiUsageLog.id)).where(base_filter, ApiUsageLog.success == True)
    )
    success_count = success_r.scalar() or 0

    # Tokens
    tokens_r = await db.execute(
        select(func.sum(ApiUsageLog.total_tokens)).where(base_filter)
    )
    total_tokens = tokens_r.scalar() or 0

    # Cost
    cost_r = await db.execute(
        select(func.sum(ApiUsageLog.cost_usd)).where(base_filter)
    )
    total_cost = round(cost_r.scalar() or 0, 4)

    # By endpoint
    ep_stmt = (
        select(ApiUsageLog.endpoint, func.count(ApiUsageLog.id).label("count"))
        .where(base_filter)
        .group_by(ApiUsageLog.endpoint)
        .order_by(func.count(ApiUsageLog.id).desc())
        .limit(10)
    )
    ep_result = await db.execute(ep_stmt)
    by_endpoint = [{"endpoint": r.endpoint, "count": r.count} for r in ep_result.all()]

    # By model
    model_stmt = (
        select(ApiUsageLog.model_name, func.count(ApiUsageLog.id).label("count"))
        .where(base_filter, ApiUsageLog.model_name.isnot(None))
        .group_by(ApiUsageLog.model_name)
        .order_by(func.count(ApiUsageLog.id).desc())
        .limit(10)
    )
    model_result = await db.execute(model_stmt)
    by_model = [{"model": r.model_name, "count": r.count} for r in model_result.all()]

    # Recent errors
    err_stmt = (
        select(ApiUsageLog)
        .where(base_filter, ApiUsageLog.success == False)
        .order_by(ApiUsageLog.created_at.desc())
        .limit(5)
    )
    err_result = await db.execute(err_stmt)
    recent_errors = [
        {
            "endpoint": e.endpoint,
            "error": e.error_message,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in err_result.scalars().all()
    ]

    return {
        "period": period,
        "total_calls": total_calls,
        "success_count": success_count,
        "success_rate": round(success_count / total_calls * 100, 1) if total_calls > 0 else 100.0,
        "total_tokens": total_tokens,
        "total_cost_usd": total_cost,
        "by_endpoint": by_endpoint,
        "by_model": by_model,
        "recent_errors": recent_errors,
    }


# --- KPI Summary ---

@router.get("/admin/kpi-summary", dependencies=[Depends(require_admin)])
async def admin_kpi_summary(db: AsyncSession = Depends(get_db)):
    """KPI summary: cost, tokens, active users, latency, error rate."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    today_filter = ApiUsageLog.created_at >= today_start
    month_filter = ApiUsageLog.created_at >= month_start

    # Today's cost
    cost_today_r = await db.execute(select(func.sum(ApiUsageLog.cost_usd)).where(today_filter))
    cost_today = round(cost_today_r.scalar() or 0, 4)

    # This month's cost
    cost_month_r = await db.execute(select(func.sum(ApiUsageLog.cost_usd)).where(month_filter))
    cost_month = round(cost_month_r.scalar() or 0, 4)

    # Today's tokens
    tokens_today_r = await db.execute(select(func.sum(ApiUsageLog.total_tokens)).where(today_filter))
    tokens_today = tokens_today_r.scalar() or 0

    # DAU: distinct users with events today
    dau_r = await db.execute(
        select(func.count(func.distinct(UserEvent.user_id))).where(UserEvent.created_at >= today_start)
    )
    active_users = dau_r.scalar() or 0

    # Average latency today
    avg_latency_r = await db.execute(select(func.avg(ApiUsageLog.duration_ms)).where(today_filter))
    avg_latency_ms = round(avg_latency_r.scalar() or 0, 1)

    # Error rate today
    total_today_r = await db.execute(select(func.count(ApiUsageLog.id)).where(today_filter))
    total_today = total_today_r.scalar() or 0
    errors_today_r = await db.execute(
        select(func.count(ApiUsageLog.id)).where(today_filter, ApiUsageLog.success == False)
    )
    errors_today = errors_today_r.scalar() or 0
    error_rate = round(errors_today / total_today * 100, 1) if total_today > 0 else 0.0

    return {
        "cost_today": cost_today,
        "cost_month": cost_month,
        "tokens_today": tokens_today,
        "active_users": active_users,
        "avg_latency_ms": avg_latency_ms,
        "error_rate": error_rate,
    }


# --- Agent Performance ---

@router.get("/admin/agent-performance", dependencies=[Depends(require_admin)])
async def admin_agent_performance(
    period: str = Query("today", regex="^(today|week|month)$"),
    db: AsyncSession = Depends(get_db),
):
    """Per-agent performance stats."""
    now = datetime.now(timezone.utc)
    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start = now - timedelta(days=7)
    else:
        start = now - timedelta(days=30)

    base_filter = ApiUsageLog.created_at >= start

    # Filter for agent-related endpoints
    agent_keywords = ["diary/generate", "comments", "analyze"]
    agent_condition = or_(*[ApiUsageLog.endpoint.contains(kw) for kw in agent_keywords])

    stmt = (
        select(
            ApiUsageLog.endpoint,
            func.count(ApiUsageLog.id).label("call_count"),
            func.count(ApiUsageLog.id).filter(ApiUsageLog.success == False).label("error_count"),
            func.avg(ApiUsageLog.duration_ms).label("avg_duration_ms"),
            func.sum(ApiUsageLog.total_tokens).label("total_tokens"),
            func.sum(ApiUsageLog.cost_usd).label("total_cost"),
        )
        .where(base_filter, agent_condition)
        .group_by(ApiUsageLog.endpoint)
        .order_by(func.count(ApiUsageLog.id).desc())
    )

    result = await db.execute(stmt)
    rows = result.all()

    agents = []
    for row in rows:
        agents.append({
            "endpoint": row.endpoint,
            "call_count": row.call_count,
            "error_count": row.error_count or 0,
            "avg_duration_ms": round(row.avg_duration_ms or 0, 1),
            "total_tokens": row.total_tokens or 0,
            "total_cost": round(row.total_cost or 0, 4),
        })

    return {"period": period, "agents": agents}


# --- MCP Stats ---

@router.get("/admin/mcp-stats", dependencies=[Depends(require_admin)])
async def admin_mcp_stats():
    """MCP tool registry statistics."""
    registry = get_registry()
    return registry.get_stats()


# --- Prompt Management ---

@router.get("/admin/prompts", dependencies=[Depends(require_admin)])
async def admin_prompts(db: AsyncSession = Depends(get_db)):
    """List all prompt configs (defaults merged with DB overrides)."""
    # Load DB overrides
    stmt = select(PromptConfig)
    result = await db.execute(stmt)
    db_configs = {row.config_key: row for row in result.scalars().all()}

    prompts = []
    for key, default_info in PROMPT_DEFAULTS.items():
        db_row = db_configs.get(key)
        prompts.append({
            "key": key,
            "value": db_row.config_value if db_row else default_info["value"],
            "type": db_row.config_type if db_row else default_info["type"],
            "description": default_info["description"],
            "is_overridden": key in db_configs,
            "default_value": default_info["value"],
        })

    return {"prompts": prompts}


@router.put("/admin/prompts/{config_key:path}", dependencies=[Depends(require_admin)])
async def admin_update_prompt(
    config_key: str,
    body: PromptUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Upsert a prompt config override."""
    # Check if exists
    stmt = select(PromptConfig).where(PromptConfig.config_key == config_key)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    description = PROMPT_DEFAULTS.get(config_key, {}).get("description")

    if existing:
        existing.config_value = body.value
        existing.config_type = body.config_type
        existing.updated_at = datetime.now(timezone.utc)
        if description:
            existing.description = description
    else:
        new_config = PromptConfig(
            config_key=config_key,
            config_value=body.value,
            config_type=body.config_type,
            description=description,
        )
        db.add(new_config)

    await db.commit()
    await refresh_prompt_cache(db)

    return {"success": True, "key": config_key, "value": body.value}


@router.delete("/admin/prompts/{config_key:path}", dependencies=[Depends(require_admin)])
async def admin_delete_prompt(config_key: str, db: AsyncSession = Depends(get_db)):
    """Delete a prompt config override (restore default)."""
    stmt = select(PromptConfig).where(PromptConfig.config_key == config_key)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        await db.delete(existing)
        await db.commit()

    await refresh_prompt_cache(db)
    default_value = PROMPT_DEFAULTS.get(config_key, {}).get("value")

    return {"success": True, "key": config_key, "restored_default": default_value}


# --- RAG Status ---

@router.get("/admin/rag-status", dependencies=[Depends(require_admin)])
async def admin_rag_status():
    """ChromaDB / RAG pipeline status."""
    try:
        import chromadb
        from pathlib import Path

        chroma_dir = Path("data/chroma_db")
        if not chroma_dir.exists():
            return {"available": False, "message": "ChromaDB directory not found"}

        client = chromadb.PersistentClient(path=str(chroma_dir))
        collections = client.list_collections()

        collection_info = []
        total_docs = 0
        for col in collections:
            count = col.count()
            total_docs += count
            collection_info.append({"name": col.name, "count": count})

        # Directory size
        dir_size = sum(f.stat().st_size for f in chroma_dir.rglob("*") if f.is_file())
        dir_size_mb = round(dir_size / (1024 * 1024), 2)

        return {
            "available": True,
            "total_docs": total_docs,
            "collections": collection_info,
            "directory_size_mb": dir_size_mb,
        }
    except ImportError:
        return {"available": False, "message": "chromadb not installed"}
    except Exception as e:
        return {"available": False, "message": str(e)}


# --- Image Stats ---

@router.get("/admin/image-stats", dependencies=[Depends(require_admin)])
async def admin_image_stats(db: AsyncSession = Depends(get_db)):
    """Profile image and diary photo storage stats."""
    # Profile images
    profile_count_r = await db.execute(
        select(func.count(DogProfile.id)).where(DogProfile.image.isnot(None))
    )
    profile_images_count = profile_count_r.scalar() or 0

    # Diary photos
    diary_count_r = await db.execute(
        select(func.count(DiaryEntry.entry_id)).where(DiaryEntry.photo.isnot(None))
    )
    diary_photos_count = diary_count_r.scalar() or 0

    # Estimate sizes (sum of string lengths)
    profile_size_r = await db.execute(
        select(func.sum(func.length(DogProfile.image))).where(DogProfile.image.isnot(None))
    )
    profile_size_chars = profile_size_r.scalar() or 0

    diary_size_r = await db.execute(
        select(func.sum(func.length(DiaryEntry.photo))).where(DiaryEntry.photo.isnot(None))
    )
    diary_size_chars = diary_size_r.scalar() or 0

    # Base64 is ~4/3 of binary, so estimated binary size = chars * 3/4
    estimated_bytes = int((profile_size_chars + diary_size_chars) * 3 / 4)
    estimated_mb = round(estimated_bytes / (1024 * 1024), 2)

    return {
        "profile_images_count": profile_images_count,
        "diary_photos_count": diary_photos_count,
        "estimated_size_mb": estimated_mb,
    }
