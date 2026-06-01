"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # pgvector 익스텐션 활성화 (NoteEmbedding.embedding 컬럼에 필요)
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "courses",
        sa.Column("id", postgresql.UUID(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("source", sa.String(200), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "lectures",
        sa.Column("id", postgresql.UUID(), nullable=False),
        sa.Column("course_id", postgresql.UUID(), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("youtube_url", sa.String(500), nullable=True),
        sa.Column("duration_sec", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "lecture_notes",
        sa.Column("id", postgresql.UUID(), nullable=False),
        sa.Column("lecture_id", postgresql.UUID(), nullable=False),
        sa.Column("content_md", sa.Text(), nullable=False, server_default=""),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["lecture_id"], ["lectures.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("lecture_id"),
    )

    op.create_table(
        "my_notes",
        sa.Column("id", postgresql.UUID(), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("content_md", sa.Text(), nullable=False, server_default=""),
        sa.Column("lecture_id", postgresql.UUID(), nullable=True),
        sa.Column("tags", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["lecture_id"], ["lectures.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "progress",
        sa.Column("id", postgresql.UUID(), nullable=False),
        sa.Column("course_id", postgresql.UUID(), nullable=False),
        sa.Column("lecture_id", postgresql.UUID(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"]),
        sa.ForeignKeyConstraint(["lecture_id"], ["lectures.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "papers",
        sa.Column("id", postgresql.UUID(), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("authors", sa.String(500), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("venue", sa.String(200), nullable=True),
        sa.Column("abstract", sa.Text(), nullable=True),
        sa.Column("arxiv_id", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("arxiv_id"),
    )

    op.create_table(
        "paper_annotations",
        sa.Column("id", postgresql.UUID(), nullable=False),
        sa.Column("paper_id", postgresql.UUID(), nullable=False),
        sa.Column("keyword", sa.String(100), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("related_lecture_id", postgresql.UUID(), nullable=True),
        sa.ForeignKeyConstraint(["paper_id"], ["papers.id"]),
        sa.ForeignKeyConstraint(["related_lecture_id"], ["lectures.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "feed_items",
        sa.Column("id", postgresql.UUID(), nullable=False),
        sa.Column("source_name", sa.String(100), nullable=False),
        sa.Column("source_type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("url", sa.String(1000), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("tags", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("published_at", sa.DateTime(), nullable=True),
        sa.Column("fetched_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("url"),
    )

    op.create_table(
        "graph_nodes",
        sa.Column("id", postgresql.UUID(), nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("note_id", postgresql.UUID(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["note_id"], ["my_notes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "graph_edges",
        sa.Column("id", postgresql.UUID(), nullable=False),
        sa.Column("source_id", postgresql.UUID(), nullable=False),
        sa.Column("target_id", postgresql.UUID(), nullable=False),
        sa.Column("relation_type", sa.String(50), nullable=False, server_default="related"),
        sa.ForeignKeyConstraint(["source_id"], ["graph_nodes.id"]),
        sa.ForeignKeyConstraint(["target_id"], ["graph_nodes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "chat_sessions",
        sa.Column("id", postgresql.UUID(), nullable=False),
        sa.Column("mode", sa.String(20), nullable=False, server_default="study"),
        sa.Column("subject", sa.String(100), nullable=True),
        sa.Column("messages", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "note_embeddings",
        sa.Column("id", postgresql.UUID(), nullable=False),
        sa.Column("note_id", postgresql.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["note_id"], ["my_notes.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("note_id"),
    )
    # vector 타입은 CREATE EXTENSION 이후에만 사용 가능하므로 raw DDL로 추가
    op.execute("ALTER TABLE note_embeddings ADD COLUMN embedding vector(1536) NOT NULL")


def downgrade() -> None:
    op.drop_table("note_embeddings")
    op.drop_table("chat_sessions")
    op.drop_table("graph_edges")
    op.drop_table("graph_nodes")
    op.drop_table("feed_items")
    op.drop_table("paper_annotations")
    op.drop_table("papers")
    op.drop_table("progress")
    op.drop_table("my_notes")
    op.drop_table("lecture_notes")
    op.drop_table("lectures")
    op.drop_table("courses")
    op.execute("DROP EXTENSION IF EXISTS vector")
