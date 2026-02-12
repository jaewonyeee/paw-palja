"""
SQLAlchemy ORM models for Paw-Palja.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Boolean, DateTime, ForeignKey, Index, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.database import Base


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[str] = mapped_column(String(30), primary_key=True)
    nickname: Mapped[str] = mapped_column(String(30), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    diary_time: Mapped[str] = mapped_column(String(5), default="09:00")
    refresh_token_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # Token family ID: all refresh tokens in a rotation chain share the same family.
    # If a token outside the current family is presented, it means a stolen token
    # was replayed — we invalidate everything (nuclear revocation).
    refresh_token_family: Mapped[str | None] = mapped_column(String(36), nullable=True)
    bio: Mapped[str | None] = mapped_column(String(200), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_profile_public: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_share_social: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    dog_profile: Mapped["DogProfile"] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False, lazy="joined"
    )
    diary_entries: Mapped[list["DiaryEntry"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", lazy="selectin"
    )


class DogProfile(Base):
    __tablename__ = "dog_profiles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String(30), ForeignKey("users.user_id", ondelete="CASCADE"), unique=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    breed: Mapped[str] = mapped_column(String(50), nullable=False)
    mbti: Mapped[str] = mapped_column(String(10), nullable=False)
    image: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship(back_populates="dog_profile")


class DiaryEntry(Base):
    __tablename__ = "diary_entries"
    __table_args__ = (
        Index("ix_diary_user_date", "user_id", "date"),
        Index("ix_diary_public_created", "is_public", "created_at"),
    )

    entry_id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(30), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[str] = mapped_column(String(10), nullable=False)
    diary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    horoscope: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    health: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    comments: Mapped[list | None] = mapped_column(JSON, default=list)
    agent_memos: Mapped[list | None] = mapped_column(JSON, default=list)
    logs: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    photo: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_edited: Mapped[bool] = mapped_column(Boolean, default=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    share_token: Mapped[str | None] = mapped_column(String(32), nullable=True, unique=True)
    likes: Mapped[list | None] = mapped_column(JSON, default=list)
    user_comments: Mapped[list | None] = mapped_column(JSON, default=list)
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped["User"] = relationship(back_populates="diary_entries")


class UserEvent(Base):
    __tablename__ = "user_events"
    __table_args__ = (
        Index("ix_event_user", "user_id"),
        Index("ix_event_type", "event_type"),
        Index("ix_event_created", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String(30), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String(30), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False
    )
    endpoint: Mapped[str] = mapped_column(Text, nullable=False)
    p256dh: Mapped[str] = mapped_column(Text, nullable=False)
    auth_key: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped["User"] = relationship("User")
