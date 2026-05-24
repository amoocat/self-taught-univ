"""lecture: rename created_at→crawled_at, add published_at

Revision ID: 0011
Revises: 0010
Create Date: 2026-05-24
"""
from alembic import op
import sqlalchemy as sa

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("lectures", "created_at", new_column_name="crawled_at")
    op.add_column("lectures", sa.Column("published_at", sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column("lectures", "published_at")
    op.alter_column("lectures", "crawled_at", new_column_name="created_at")
