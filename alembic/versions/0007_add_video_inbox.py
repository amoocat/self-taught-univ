"""add video_inbox table — YouTube 영상 임시 보관함 (필터링 없이 전체 저장)

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-22

video_inbox: 플리 동기화 시 필터 없이 전체 영상 임시 저장.
매일 큐레이션 잡이 학습 관련 영상만 lectures로 승격, 나머지 삭제.
"""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "video_inbox",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("video_id", sa.String(30), nullable=False, unique=True),
        sa.Column("playlist_id", sa.String(100), nullable=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("thumbnail_url", sa.String(500), nullable=True),
        sa.Column("duration_sec", sa.Integer, nullable=True),
        sa.Column("published_at", sa.String(50), nullable=True),
        sa.Column("position", sa.Integer, nullable=False, server_default="0"),
        sa.Column("channel_title", sa.String(200), nullable=True),
        sa.Column("synced_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("video_inbox")
