"""
크롤러 테스트
- _iso8601_to_sec: 유닛 테스트 (외부 API 없이)
- POST /api/v1/crawl/youtube: 엔드포인트 smoke test (YouTubeCrawler mocking)
"""
import pytest
from unittest.mock import AsyncMock, patch

from app.crawlers.youtube import _iso8601_to_sec, YoutubeVideo


# ── _iso8601_to_sec 유닛 테스트 ──────────────────────────────────────

@pytest.mark.parametrize("iso, expected", [
    ("PT1H2M3S", 3723),
    ("PT30M",    1800),
    ("PT45S",    45),
    ("PT1H",     3600),
    ("PT2H30M",  9000),
    ("PT0S",     0),
])
def test_iso8601_to_sec(iso, expected):
    assert _iso8601_to_sec(iso) == expected


# ── crawl API smoke test ──────────────────────────────────────────────

@pytest.fixture
def mock_youtube_videos():
    return [
        YoutubeVideo(
            video_id="dQw4w9WgXcQ",
            title="Lecture 1: Introduction",
            description="첫 번째 강의",
            thumbnail_url="https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
            duration_sec=3600,
            published_at="2024-01-01T00:00:00Z",
            playlist_id="PL49CF3715CB9EF31D",
            position=0,
        ),
        YoutubeVideo(
            video_id="abc123xyz",
            title="Lecture 2: Vectors",
            description="두 번째 강의",
            thumbnail_url="https://img.youtube.com/vi/abc123xyz/mqdefault.jpg",
            duration_sec=2700,
            published_at="2024-01-08T00:00:00Z",
            playlist_id="PL49CF3715CB9EF31D",
            position=1,
        ),
    ]


def test_crawl_youtube_accepted(client, mock_youtube_videos):
    """POST /crawl/youtube → 202 반환, 백그라운드 잡 등록"""
    with patch(
        "app.crawlers.scheduler.job_crawl_youtube",
        new_callable=AsyncMock,
    ):
        resp = client.post("/api/v1/crawl/youtube")

    assert resp.status_code == 202
    assert "YouTube" in resp.json()["message"]


def test_crawl_blogs_accepted(client):
    """POST /crawl/blogs → 202 반환"""
    with patch(
        "app.crawlers.scheduler.job_crawl_blogs",
        new_callable=AsyncMock,
    ):
        resp = client.post("/api/v1/crawl/blogs")

    assert resp.status_code == 202


def test_crawl_arxiv_accepted(client):
    """POST /crawl/arxiv → 202 반환"""
    with patch(
        "app.crawlers.scheduler.job_crawl_arxiv",
        new_callable=AsyncMock,
    ):
        resp = client.post("/api/v1/crawl/arxiv")

    assert resp.status_code == 202
