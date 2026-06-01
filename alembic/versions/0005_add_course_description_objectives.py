"""add description and objectives to courses

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-20

courses.description : 과목 개요 (Text)
courses.objectives  : 학습 목표 리스트 (JSONB)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("courses", sa.Column("description", sa.Text(), nullable=True))
    op.add_column(
        "courses",
        sa.Column("objectives", postgresql.JSONB(), nullable=True, server_default=sa.text("'[]'::jsonb")),
    )


def downgrade() -> None:
    op.drop_column("courses", "objectives")
    op.drop_column("courses", "description")
