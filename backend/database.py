"""
Async database engine and session management.
Supports PostgreSQL (production) and SQLite (local dev fallback).
"""
import os
import logging
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

logger = logging.getLogger("pawpalja.database")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite+aiosqlite:///./data/pawpalja.db",
)

_engine_kwargs: dict = {"echo": False}

if DATABASE_URL.startswith("postgresql"):
    _engine_kwargs.update(pool_size=5, max_overflow=10)
else:
    # SQLite doesn't support pool_size / max_overflow
    logger.info("Using SQLite backend (local dev mode): %s", DATABASE_URL)
    # Ensure the directory for the SQLite file exists
    _sqlite_path = DATABASE_URL.split("///")[-1] if "///" in DATABASE_URL else None
    if _sqlite_path:
        Path(_sqlite_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_async_engine(DATABASE_URL, **_engine_kwargs)

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    """FastAPI dependency that yields an async DB session."""
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    """Create all tables (for development / first run)."""
    from backend.models import User, DogProfile, DiaryEntry, UserEvent, PushSubscription, ApiUsageLog, PromptConfig  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Auto-migrate: add new columns if missing
    import sqlalchemy
    async with engine.begin() as conn:
        if DATABASE_URL.startswith("postgresql"):
            await conn.execute(
                sqlalchemy.text(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_share_social BOOLEAN DEFAULT FALSE"
                )
            )
            await conn.execute(
                sqlalchemy.text(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)"
                )
            )
            await conn.execute(
                sqlalchemy.text(
                    "ALTER TABLE diary_entries ADD COLUMN IF NOT EXISTS likes JSON DEFAULT '[]'"
                )
            )
            await conn.execute(
                sqlalchemy.text(
                    "ALTER TABLE diary_entries ADD COLUMN IF NOT EXISTS user_comments JSON DEFAULT '[]'"
                )
            )
        else:
            result = await conn.execute(sqlalchemy.text("PRAGMA table_info(users)"))
            columns = [row[1] for row in result.fetchall()]
            if "auto_share_social" not in columns:
                await conn.execute(
                    sqlalchemy.text("ALTER TABLE users ADD COLUMN auto_share_social BOOLEAN DEFAULT 0")
                )
            if "email" not in columns:
                await conn.execute(
                    sqlalchemy.text("ALTER TABLE users ADD COLUMN email VARCHAR(255)")
                )

            result = await conn.execute(sqlalchemy.text("PRAGMA table_info(diary_entries)"))
            diary_columns = [row[1] for row in result.fetchall()]
            if "likes" not in diary_columns:
                await conn.execute(
                    sqlalchemy.text("ALTER TABLE diary_entries ADD COLUMN likes JSON DEFAULT '[]'")
                )
            if "user_comments" not in diary_columns:
                await conn.execute(
                    sqlalchemy.text("ALTER TABLE diary_entries ADD COLUMN user_comments JSON DEFAULT '[]'")
                )

    logger.info("Database tables initialized")
