"""add youtube_video_id, thumbnail_url, playlist_id, is_available to lectures

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-21

lectures.youtube_video_id : YouTube 영상 ID (embed 및 썸네일 URL 구성용)
lectures.thumbnail_url    : 영상 썸네일 URL
lectures.playlist_id      : 출처 플레이리스트 ID
lectures.is_available     : 영상 공개 여부 (삭제·비공개 체크용)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("lectures", sa.Column("youtube_video_id", sa.String(30), nullable=True))
    op.add_column("lectures", sa.Column("thumbnail_url", sa.String(500), nullable=True))
    op.add_column("lectures", sa.Column("playlist_id", sa.String(100), nullable=True))
    op.add_column(
        "lectures",
        sa.Column("is_available", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    # 기존 youtube_url에서 video_id 역산
    op.execute("""
        UPDATE lectures
        SET youtube_video_id = substring(youtube_url FROM 'v=([A-Za-z0-9_-]+)')
        WHERE youtube_url IS NOT NULL
    """)


def downgrade() -> None:
    op.drop_column("lectures", "is_available")
    op.drop_column("lectures", "playlist_id")
    op.drop_column("lectures", "thumbnail_url")
    op.drop_column("lectures", "youtube_video_id")
