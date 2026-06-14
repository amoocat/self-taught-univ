"""add course is_enrolled

Revision ID: 0013
Revises: 0012
Create Date: 2026-06-14
"""
from alembic import op
import sqlalchemy as sa

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("courses", sa.Column("is_enrolled", sa.Boolean(), nullable=False, server_default="false"))


def downgrade():
    op.drop_column("courses", "is_enrolled")
