"""그래프 도메인 모델 — GraphNode, GraphEdge"""
import uuid
from sqlalchemy import String, Text, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def gen_uuid():
    return str(uuid.uuid4())


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
