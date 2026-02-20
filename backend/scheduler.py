"""
Apify SNS 데이터 자동 수집 스케줄러 + 일기 알림 Push 발송
매일 아침 7시에 Instagram 데이터를 수집하여 RAG DB를 업데이트합니다.
매분 사용자 diary_time을 확인하여 Web Push 알림을 보냅니다.
"""
import json
import logging
import os
from datetime import datetime, timezone, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger("pawpalja.scheduler")


def collect_sns_data():
    """Apify를 통해 다국어 SNS 데이터를 수집하고 RAG DB를 업데이트합니다."""
    try:
        logger.info("=== 스케줄러: 다국어 SNS 데이터 수집 시작 ===")
        from backend.fetch_sns_data import fetch_multilingual_data, save_sns_data
        from backend.rag_pipeline import build_vector_db

        # 1. 다국어 SNS 데이터 수집
        sns_data = fetch_multilingual_data()
        if sns_data:
            save_sns_data(sns_data)
            logger.info(f"SNS 데이터 {len(sns_data)}건 수집 완료 (한국어+영어)")
        else:
            logger.warning("SNS 데이터 수집 실패")

        # 2. RAG DB 재구축
        build_vector_db()
        logger.info("=== 스케줄러: RAG DB 업데이트 완료 ===")

    except Exception as e:
        logger.error(f"스케줄러 오류: {e}", exc_info=True)


def send_diary_reminders():
    """Check users whose diary_time matches the current HH:MM and send push notifications."""
    import asyncio
    import os

    async def _send():
        try:
            from sqlalchemy import select
            from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
            from sqlalchemy.orm import joinedload
            from backend.models import User, PushSubscription
            from backend.routes.push import send_push_to_user_subscriptions

            # Create a dedicated engine for this thread's event loop
            # (the main engine is bound to uvicorn's loop and can't be shared)
            db_url = os.getenv(
                "DATABASE_URL", "sqlite+aiosqlite:///./data/pawpalja.db"
            )
            engine_kwargs = {"echo": False}
            if db_url.startswith("postgresql"):
                engine_kwargs.update(pool_size=1, max_overflow=0)
            engine = create_async_engine(db_url, **engine_kwargs)
            SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

            # Use configurable timezone (default: Asia/Seoul = UTC+9)
            tz_offset_hours = int(os.getenv("SCHEDULER_TZ_OFFSET", "9"))
            tz = timezone(timedelta(hours=tz_offset_hours))
            now = datetime.now(tz)
            current_time = now.strftime("%H:%M")

            try:
                async with SessionLocal() as db:
                    stmt = (
                        select(User)
                        .options(joinedload(User.dog_profile))
                        .where(User.diary_time == current_time)
                    )
                    result = await db.execute(stmt)
                    users = result.unique().scalars().all()

                    if not users:
                        return

                    logger.info(f"Diary reminder: {len(users)} users matched time {current_time}")

                    for user in users:
                        dog_name = ""
                        if user.dog_profile:
                            dog_name = user.dog_profile.name

                        # --- Push notifications ---
                        sub_stmt = select(PushSubscription).where(
                            PushSubscription.user_id == user.user_id
                        )
                        sub_result = await db.execute(sub_stmt)
                        subscriptions = sub_result.scalars().all()

                        if subscriptions:
                            payload = json.dumps({
                                "title": "Burti 🐾",
                                "body": f"{dog_name or '우리 강아지'}의 오늘 일기를 작성할 시간이에요!",
                                "url": "/home",
                            })

                            results = send_push_to_user_subscriptions(subscriptions, payload)
                            ok_count = sum(1 for r in results if r[0] == "ok")
                            logger.info(
                                f"Push sent to {user.user_id}: {ok_count}/{len(subscriptions)} delivered"
                            )

                        # --- Email notification ---
                        if user.email:
                            try:
                                from backend.email_service import send_diary_reminder_email
                                from backend.models import DiaryEntry

                                # Fetch most recent diary for personalized content
                                recent_stmt = (
                                    select(DiaryEntry)
                                    .where(DiaryEntry.user_id == user.user_id)
                                    .order_by(DiaryEntry.created_at.desc())
                                    .limit(1)
                                )
                                recent_result = await db.execute(recent_stmt)
                                recent_entry = recent_result.scalar_one_or_none()
                                recent_data = None
                                if recent_entry:
                                    recent_data = {"diary": recent_entry.diary}

                                send_diary_reminder_email(
                                    to_email=user.email,
                                    dog_name=dog_name or "Your pup",
                                    nickname=user.nickname,
                                    recent_diary_data=recent_data,
                                    lang="ko",
                                )
                            except Exception as email_err:
                                logger.error(f"Email send error for {user.user_id}: {email_err}")
            finally:
                await engine.dispose()

        except Exception as e:
            logger.error(f"Diary reminder error: {e}", exc_info=True)

    # Run the async function in a new event loop (scheduler runs in a thread)
    loop = None
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(_send())
    except Exception as e:
        logger.error(f"Diary reminder loop error: {e}", exc_info=True)
    finally:
        if loop:
            loop.close()


def start_scheduler():
    """스케줄러를 시작합니다. 매일 오전 7시에 SNS 수집, 매분 일기 알림."""
    scheduler = BackgroundScheduler()

    # 매일 오전 7시에 실행
    scheduler.add_job(
        collect_sns_data,
        trigger=CronTrigger(hour=7, minute=0),
        id="sns_data_collector",
        name="SNS 데이터 수집 및 RAG 업데이트",
        replace_existing=True,
    )

    # Every minute: check for users whose diary_time matches and send push
    scheduler.add_job(
        send_diary_reminders,
        trigger=IntervalTrigger(minutes=1),
        id="diary_push_reminder",
        name="Diary reminder push notifications",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("스케줄러 시작: SNS 수집 (07:00) + 일기 알림 Push (매분)")
    return scheduler
