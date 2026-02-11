"""
Analytics API endpoints (admin only).
Provides overview, engagement, and agent usage metrics.
"""
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, func, extract
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.auth import require_admin
from backend.models import User, DiaryEntry, UserEvent

logger = logging.getLogger("pawpalja.analytics")

router = APIRouter()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


@router.get("/admin/analytics/overview")
async def analytics_overview(
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Overview metrics: user counts, diary counts, DAU, MAU."""
    now = _utc_now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    month_start = today_start.replace(day=1)

    # Total users
    total_users = (await db.execute(select(func.count(User.user_id)))).scalar() or 0

    # New users today / this week / this month
    new_today = (await db.execute(
        select(func.count(User.user_id)).where(User.created_at >= today_start)
    )).scalar() or 0
    new_week = (await db.execute(
        select(func.count(User.user_id)).where(User.created_at >= week_start)
    )).scalar() or 0
    new_month = (await db.execute(
        select(func.count(User.user_id)).where(User.created_at >= month_start)
    )).scalar() or 0

    # Total diaries
    total_diaries = (await db.execute(select(func.count(DiaryEntry.entry_id)))).scalar() or 0

    # Diaries created today / this week / this month
    diaries_today = (await db.execute(
        select(func.count(DiaryEntry.entry_id)).where(DiaryEntry.created_at >= today_start)
    )).scalar() or 0
    diaries_week = (await db.execute(
        select(func.count(DiaryEntry.entry_id)).where(DiaryEntry.created_at >= week_start)
    )).scalar() or 0
    diaries_month = (await db.execute(
        select(func.count(DiaryEntry.entry_id)).where(DiaryEntry.created_at >= month_start)
    )).scalar() or 0

    # DAU: distinct users who created a diary entry today
    dau = (await db.execute(
        select(func.count(func.distinct(DiaryEntry.user_id))).where(
            DiaryEntry.created_at >= today_start
        )
    )).scalar() or 0

    # MAU: distinct users who created a diary entry this month
    mau = (await db.execute(
        select(func.count(func.distinct(DiaryEntry.user_id))).where(
            DiaryEntry.created_at >= month_start
        )
    )).scalar() or 0

    return {
        "total_users": total_users,
        "new_users_today": new_today,
        "new_users_week": new_week,
        "new_users_month": new_month,
        "total_diaries": total_diaries,
        "diaries_today": diaries_today,
        "diaries_week": diaries_week,
        "diaries_month": diaries_month,
        "dau": dau,
        "mau": mau,
    }


@router.get("/admin/analytics/engagement")
async def analytics_engagement(
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Engagement metrics: avg diaries/user, active hours, retention."""
    now = _utc_now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    seven_days_ago = today_start - timedelta(days=7)

    # Average diaries per user
    total_users = (await db.execute(select(func.count(User.user_id)))).scalar() or 1
    total_diaries = (await db.execute(select(func.count(DiaryEntry.entry_id)))).scalar() or 0
    avg_diaries = round(total_diaries / max(total_users, 1), 2)

    # Most active hours (diary creation hour distribution)
    hour_stmt = (
        select(
            extract("hour", DiaryEntry.created_at).label("hour"),
            func.count(DiaryEntry.entry_id).label("count"),
        )
        .group_by("hour")
        .order_by(func.count(DiaryEntry.entry_id).desc())
    )
    hour_result = await db.execute(hour_stmt)
    active_hours = [{"hour": int(row.hour), "count": row.count} for row in hour_result.all()]

    # Retention: % of users who created a diary in the last 7 days
    active_last_7 = (await db.execute(
        select(func.count(func.distinct(DiaryEntry.user_id))).where(
            DiaryEntry.created_at >= seven_days_ago
        )
    )).scalar() or 0
    retention_rate = round((active_last_7 / max(total_users, 1)) * 100, 1)

    # Diaries per day (last 7 days)
    daily_stmt = (
        select(
            DiaryEntry.date,
            func.count(DiaryEntry.entry_id).label("count"),
        )
        .where(DiaryEntry.created_at >= seven_days_ago)
        .group_by(DiaryEntry.date)
        .order_by(DiaryEntry.date)
    )
    daily_result = await db.execute(daily_stmt)
    daily_diaries = [{"date": row.date, "count": row.count} for row in daily_result.all()]

    return {
        "avg_diaries_per_user": avg_diaries,
        "active_hours": active_hours,
        "retention_rate_7d": retention_rate,
        "daily_diaries": daily_diaries,
    }


@router.get("/admin/analytics/agents")
async def analytics_agents(
    admin: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Agent usage metrics from tracked events."""
    # Count events by type
    stmt = (
        select(
            UserEvent.event_type,
            func.count(UserEvent.id).label("count"),
        )
        .group_by(UserEvent.event_type)
        .order_by(func.count(UserEvent.id).desc())
    )
    result = await db.execute(stmt)
    event_counts = [{"event_type": row.event_type, "count": row.count} for row in result.all()]

    # Agent-related events (diary_created implies all 3 agents were used)
    diary_events = (await db.execute(
        select(func.count(UserEvent.id)).where(UserEvent.event_type == "diary_created")
    )).scalar() or 0

    agent_usage = [
        {"agent": "oracle", "count": diary_events},
        {"agent": "journalist", "count": diary_events},
        {"agent": "vet", "count": diary_events},
    ]

    return {
        "event_counts": event_counts,
        "agent_usage": agent_usage,
    }
