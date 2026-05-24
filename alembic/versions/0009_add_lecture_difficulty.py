"""add lecture difficulty

Revision ID: 0009
Revises: 0008
Create Date: 2026-05-23
"""
from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "lectures",
        sa.Column("difficulty", sa.Integer(), nullable=True, server_default=None),
    )


def downgrade():
    op.drop_column("lectures", "difficulty")
