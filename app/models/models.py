import uuid
from datetime import datetime
from sqlalchemy import String, Text, Integer, Float, ForeignKey, DateTime, Boolean
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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

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


class GraphNode(Base):
    __tablename__ = "graph_nodes"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    label: Mapped[str] = mapped_column(String(100))
    category: Mapped[str] = mapped_column(String(50))
    note_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("my_notes.id"), nullable=True)
    description: Mapped[str | None] = mapped_column(Text)
    has_content: Mapped[bool] = mapped_column(Boolean, default=False)

    source_edges: Mapped[list["GraphEdge"]] = relationship(foreign_keys="GraphEdge.source_id", back_populates="source")
    target_edges: Mapped[list["GraphEdge"]] = relationship(foreign_keys="GraphEdge.target_id", back_populates="target")


class GraphEdge(Base):
    __tablename__ = "graph_edges"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    source_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("graph_nodes.id"))
    target_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("graph_nodes.id"))
    relation_type: Mapped[str] = mapped_column(String(50), default="related")

    source: Mapped["GraphNode"] = relationship(foreign_keys=[source_id], back_populates="source_edges")
    target: Mapped["GraphNode"] = relationship(foreign_keys=[target_id], back_populates="target_edges")


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    mode: Mapped[str] = mapped_column(String(20), default="study")
    subject: Mapped[str | None] = mapped_column(String(100))
    messages: Mapped[list] = mapped_column(JSONB, default=list)
    score: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


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


class NoteEmbedding(Base):
    __tablename__ = "note_embeddings"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    note_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("my_notes.id"), unique=True)
    embedding: Mapped[list] = mapped_column(Vector(1536))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    note: Mapped["MyNote"] = relationship(back_populates="embedding")
