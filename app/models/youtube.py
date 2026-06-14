"""YouTube 도메인 모델 — VideoInbox"""
import uuid
from datetime import datetime
from sqlalchemy import String, Text, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


def gen_uuid():
    return str(uuid.uuid4())


class VideoInbox(Base):
    """YouTube 영상 임시 보관함 — 필터링 없이 전체 저장 후 큐레이션 잡이 학습 영상만 Lecture로 승격."""
    __tablename__ = "video_inbox"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    video_id: Mapped[str] = mapped_column(String(30), unique=True)
    playlist_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    duration_sec: Mapped[int | None] = mapped_column(Integer, nullable=True)
    published_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    channel_title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
