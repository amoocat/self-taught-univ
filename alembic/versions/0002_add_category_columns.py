"""add category columns to lectures, papers, feed_items

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-19

lectures.category  : 강의가 속한 과목 분류 (math/stats/ml/dl/cv/nlp)
                     Course.category 와 동일한 값. JOIN 없이 강의 필터링에 사용.
papers.category    : 논문 분야 (math/ml/dl/cv/nlp/etc)
feed_items.category: 블로그 포스트 주제 (llm/cv/infra/rec/etc) — 프론트 탭 필터와 매핑
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("lectures",   sa.Column("category", sa.String(50), nullable=True))
    op.add_column("papers",     sa.Column("category", sa.String(50), nullable=True))
    op.add_column("feed_items", sa.Column("category", sa.String(50), nullable=True))

    # lectures: course.category 값으로 기존 행 일괄 채우기
    op.execute("""
        UPDATE lectures l
        SET category = c.category
        FROM courses c
        WHERE l.course_id = c.id
          AND l.category IS NULL
    """)


def downgrade() -> None:
    op.drop_column("feed_items", "category")
    op.drop_column("papers",     "category")
    op.drop_column("lectures",   "category")
