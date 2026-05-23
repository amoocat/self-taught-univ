"""add has_content to graph_nodes — LLM 생성 노드가 실제 콘텐츠(강의/노트/논문)와 연결되어 있는지 표시

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-23
"""
from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "graph_nodes",
        sa.Column("has_content", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade():
    op.drop_column("graph_nodes", "has_content")
