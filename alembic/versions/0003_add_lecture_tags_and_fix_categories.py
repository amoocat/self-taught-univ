"""add lecture tags, fix category naming, add new courses

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-20

lectures.tags      : 강의 태그 목록 (JSONB)
category 정리      : stats→stat, infra→mlops (일관성)
새 과목            : llm, rl, data, mlops
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "lectures",
        sa.Column("tags", postgresql.JSONB(), nullable=True, server_default="'[]'::jsonb"),
    )

    # stats → stat 통일
    op.execute("UPDATE courses  SET category = 'stat'  WHERE category = 'stats'")
    op.execute("UPDATE lectures SET category = 'stat'  WHERE category = 'stats'")

    # infra → mlops (더 명확한 이름)
    op.execute("UPDATE courses  SET category = 'mlops' WHERE category = 'infra'")
    op.execute("UPDATE lectures SET category = 'mlops' WHERE category = 'infra'")


def downgrade() -> None:
    op.execute("UPDATE lectures SET category = 'infra'  WHERE category = 'mlops'")
    op.execute("UPDATE courses  SET category = 'infra'  WHERE category = 'mlops'")
    op.execute("UPDATE lectures SET category = 'stats'  WHERE category = 'stat'")
    op.execute("UPDATE courses  SET category = 'stats'  WHERE category = 'stat'")
    op.drop_column("lectures", "tags")
