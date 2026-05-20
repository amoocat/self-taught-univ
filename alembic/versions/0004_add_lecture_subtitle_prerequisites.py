"""add subtitle and prerequisites to lectures

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-20

lectures.subtitle      : 강의 소제목 / 부제 (예: '행렬의 기하학적 해석')
lectures.prerequisites : 선수 지식 목록 JSONB (예: ['행렬', '벡터 공간'])
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "lectures",
        sa.Column("subtitle", sa.String(500), nullable=True),
    )
    op.add_column(
        "lectures",
        sa.Column("prerequisites", postgresql.JSONB(), nullable=True, server_default=sa.text("'[]'::jsonb")),
    )


def downgrade() -> None:
    op.drop_column("lectures", "prerequisites")
    op.drop_column("lectures", "subtitle")
