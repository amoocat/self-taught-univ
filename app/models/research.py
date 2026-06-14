"""리서치 도메인 모델 — Paper, PaperAnnotation, FeedItem"""
import uuid
from datetime import datetime
from sqlalchemy import String, Text, Integer, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def gen_uuid():
    return str(uuid.uuid4())


class Paper(Base):
    __tablename__ = "papers"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    title: Mapped[str] = mapped_column(String(500))
    authors: Mapped[str] = mapped_column(String(500))
    year: Mapped[int] = mapped_column(Integer)
    venue: Mapped[str | None] = mapped_column(String(200))
    abstract: Mapped[str | None] = mapped_column(Text)
    arxiv_id: Mapped[str | None] = mapped_column(String(50), unique=True)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    annotations: Mapped[list["PaperAnnotation"]] = relationship(back_populates="paper")


class PaperAnnotation(Base):
    __tablename__ = "paper_annotations"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    paper_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("papers.id"))
    keyword: Mapped[str] = mapped_column(String(100))
    explanation: Mapped[str] = mapped_column(Text)
    related_lecture_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("lectures.id"), nullable=True)

    paper: Mapped["Paper"] = relationship(back_populates="annotations")


class FeedItem(Base):
    __tablename__ = "feed_items"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    source_name: Mapped[str] = mapped_column(String(100))
    source_type: Mapped[str] = mapped_column(String(50))
    title: Mapped[str] = mapped_column(String(500))
    url: Mapped[str] = mapped_column(String(1000), unique=True)
    summary: Mapped[str | None] = mapped_column(Text)
    tags: Mapped[list] = mapped_column(JSONB, default=list)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
