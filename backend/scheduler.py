"""
Apify SNS 데이터 자동 수집 스케줄러 + 일기 알림 Push 발송
매일 아침 7시에 Instagram 데이터를 수집하여 RAG DB를 업데이트합니다.
매분 사용자 diary_time을 확인하여 Web Push 알림을 보냅니다.
"""
import json
import logging
from datetime import datetime, timezone

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

    async def _send():
        try:
            from sqlalchemy import select
            from backend.database import AsyncSessionLocal
            from backend.models import User, PushSubscription
            from backend.routes.push import send_push_to_user_subscriptions

            now = datetime.now(timezone.utc)
            current_time = now.strftime("%H:%M")

            async with AsyncSessionLocal() as db:
                # Find users whose diary_time matches current minute
                stmt = select(User).where(User.diary_time == current_time)
                result = await db.execute(stmt)
                users = result.scalars().all()

                if not users:
                    return

                logger.info(f"Diary reminder: {len(users)} users matched time {current_time}")

                for user in users:
                    # Get push subscriptions for this user
                    sub_stmt = select(PushSubscription).where(
                        PushSubscription.user_id == user.user_id
                    )
                    sub_result = await db.execute(sub_stmt)
                    subscriptions = sub_result.scalars().all()

                    if not subscriptions:
                        continue

                    dog_name = ""
                    if user.dog_profile:
                        dog_name = user.dog_profile.name

                    payload = json.dumps({
                        "title": "Paw-Palja",
                        "body": f"{dog_name or 'Your pup'}의 오늘 일기를 작성할 시간이에요!",
                        "url": "/home",
                    })

                    results = send_push_to_user_subscriptions(subscriptions, payload)
                    ok_count = sum(1 for r in results if r[0] == "ok")
                    logger.info(
                        f"Push sent to {user.user_id}: {ok_count}/{len(subscriptions)} delivered"
                    )

        except Exception as e:
            logger.error(f"Diary reminder error: {e}", exc_info=True)

    # Run the async function in a new event loop (scheduler runs in a thread)
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(_send())
    except Exception as e:
        logger.error(f"Diary reminder loop error: {e}", exc_info=True)
    finally:
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
