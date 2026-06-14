"""커리큘럼 도메인 모델 — Course, Lecture, LectureNote, MyNote, Progress, NoteEmbedding"""
import uuid
from datetime import datetime
from sqlalchemy import String, Text, Integer, ForeignKey, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

from app.db.session import Base


def gen_uuid():
    return str(uuid.uuid4())


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    title: Mapped[str] = mapped_column(String(200))
    source: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(50))
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    is_enrolled: Mapped[bool] = mapped_column(Boolean, default=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    objectives: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    lectures: Mapped[list["Lecture"]] = relationship(back_populates="course")
    progress: Mapped[list["Progress"]] = relationship(back_populates="course")


class Lecture(Base):
    __tablename__ = "lectures"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    course_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("courses.id"))
    title: Mapped[str] = mapped_column(String(300))
    subtitle: Mapped[str | None] = mapped_column(String(500), nullable=True)
    number: Mapped[int] = mapped_column(Integer)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tags: Mapped[list] = mapped_column(JSONB, default=list)
    prerequisites: Mapped[list] = mapped_column(JSONB, default=list)
    youtube_url: Mapped[str | None] = mapped_column(String(500))
    youtube_video_id: Mapped[str | None] = mapped_column(String(30), nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    playlist_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    duration_sec: Mapped[int | None] = mapped_column(Integer)
    difficulty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    module_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    meta_source: Mapped[str | None] = mapped_column(String(20), nullable=True)  # "manual" | "llm" | null
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    crawled_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    course: Mapped["Course"] = relationship(back_populates="lectures")
    lecture_note: Mapped["LectureNote | None"] = relationship(back_populates="lecture")
    my_notes: Mapped[list["MyNote"]] = relationship(back_populates="lecture")


class LectureNote(Base):
    __tablename__ = "lecture_notes"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    lecture_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("lectures.id"), unique=True)
    content_md: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lecture: Mapped["Lecture"] = relationship(back_populates="lecture_note")


class MyNote(Base):
    __tablename__ = "my_notes"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    title: Mapped[str] = mapped_column(String(300))
    content_md: Mapped[str] = mapped_column(Text, default="")
    lecture_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("lectures.id"), nullable=True)
    tags: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lecture: Mapped["Lecture | None"] = relationship(back_populates="my_notes")
    embedding: Mapped["NoteEmbedding | None"] = relationship(back_populates="note")


class Progress(Base):
    __tablename__ = "progress"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    course_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("courses.id"))
    lecture_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("lectures.id"))
    completed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    course: Mapped["Course"] = relationship(back_populates="progress")


class NoteEmbedding(Base):
    __tablename__ = "note_embeddings"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    note_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("my_notes.id"), unique=True)
    embedding: Mapped[list] = mapped_column(Vector(1536))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    note: Mapped["MyNote"] = relationship(back_populates="embedding")
