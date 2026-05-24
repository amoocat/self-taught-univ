"""lecture: add meta_source column

Revision ID: 0012
Revises: 0011
Create Date: 2026-05-24
"""
from alembic import op
import sqlalchemy as sa

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("lectures", sa.Column("meta_source", sa.String(20), nullable=True))


def downgrade():
    op.drop_column("lectures", "meta_source")
