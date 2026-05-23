"""add lecture module_name

Revision ID: 0010
Revises: 0009
Create Date: 2026-05-23
"""
from alembic import op
import sqlalchemy as sa

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "lectures",
        sa.Column("module_name", sa.String(100), nullable=True),
    )


def downgrade():
    op.drop_column("lectures", "module_name")
