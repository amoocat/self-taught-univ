"""
YouTube 강의 크롤러
- Google YouTube Data API v3 사용
- 커리큘럼 플레이리스트/채널에서 강의 메타데이터 수집
"""
import httpx
import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

# 수집할 플레이리스트 목록
YOUTUBE_PLAYLISTS = [
    {
        "category": "math",
        "name": "선형대수학 (MIT 18.06)",
        "playlist_id": "PL49CF3715CB9EF31D",  # Gilbert Strang MIT 18.06
    },
    {
        "category": "ml",
        "name": "머신러닝 (Stanford CS229)",
        "playlist_id": "PLoROMvodv4rMiGQp3WXShtMGgzqpfVfbU",  # Andrew Ng CS229
    },
    {
        "category": "dl",
        "name": "딥러닝 (Stanford CS231n)",
        "playlist_id": "PL3FW7Lu3i5JvHM8ljYj-zLfQRF3EO8sYv",  # CS231n
    },
    {
        "category": "nlp",
        "name": "자연어처리 (Stanford CS224n)",
        "playlist_id": "PLoROMvodv4rOSH4v6133s9LFPRHjEmbmJ",  # CS224n
    },
]


@dataclass
class YoutubeVideo:
    video_id: str
    title: str
    description: str
    thumbnail_url: str
    duration_sec: int
    published_at: str
    playlist_id: str
    position: int  # 강의 번호


class YouTubeCrawler:
    BASE_URL = "https://www.googleapis.com/youtube/v3"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.client  = httpx.AsyncClient(timeout=30)

    async def fetch_playlist_videos(self, playlist_id: str) -> list[YoutubeVideo]:
        """플레이리스트의 모든 영상 메타데이터 수집"""
        videos    = []
        page_token = None

        while True:
            params = {
                "part":       "snippet,contentDetails",
                "playlistId": playlist_id,
                "maxResults": 50,
                "key":        self.api_key,
            }
            if page_token:
                params["pageToken"] = page_token

            try:
                resp = await self.client.get(
                    f"{self.BASE_URL}/playlistItems", params=params
                )
                resp.raise_for_status()
                data = resp.json()
            except Exception as e:
                logger.error(f"[YouTube] 플레이리스트 {playlist_id} 수집 실패: {e}")
                break

            for item in data.get("items", []):
                snippet = item["snippet"]
                vid_id  = snippet.get("resourceId", {}).get("videoId")
                if not vid_id:
                    continue

                # duration은 별도 videos API 호출 필요
                videos.append(YoutubeVideo(
                    video_id=vid_id,
                    title=snippet.get("title", ""),
                    description=snippet.get("description", "")[:500],
                    thumbnail_url=(
                        snippet.get("thumbnails", {})
                        .get("medium", {})
                        .get("url", "")
                    ),
                    duration_sec=0,  # 아래에서 채움
                    published_at=snippet.get("publishedAt", ""),
                    playlist_id=playlist_id,
                    position=snippet.get("position", 0),
                ))

            page_token = data.get("nextPageToken")
            if not page_token:
                break

        # 재생시간 일괄 조회 (50개씩)
        await self._fill_durations(videos)
        return videos

    async def _fill_durations(self, videos: list[YoutubeVideo]):
        """videos API로 재생시간(ISO 8601) → 초 변환"""
        for i in range(0, len(videos), 50):
            batch    = videos[i:i+50]
            ids_str  = ",".join(v.video_id for v in batch)
            try:
                resp = await self.client.get(
                    f"{self.BASE_URL}/videos",
                    params={"part": "contentDetails", "id": ids_str, "key": self.api_key},
                )
                resp.raise_for_status()
                data = resp.json()
            except Exception as e:
                logger.error(f"[YouTube] duration 조회 실패: {e}")
                continue

            dur_map = {
                item["id"]: _iso8601_to_sec(
                    item["contentDetails"]["duration"]
                )
                for item in data.get("items", [])
            }
            for v in batch:
                v.duration_sec = dur_map.get(v.video_id, 0)

    async def close(self):
        await self.client.aclose()


def _iso8601_to_sec(duration: str) -> int:
    """PT1H2M3S → 3723"""
    import re
    h = int(re.search(r"(\d+)H", duration).group(1)) if re.search(r"(\d+)H", duration) else 0
    m = int(re.search(r"(\d+)M", duration).group(1)) if re.search(r"(\d+)M", duration) else 0
    s = int(re.search(r"(\d+)S", duration).group(1)) if re.search(r"(\d+)S", duration) else 0
    return h * 3600 + m * 60 + s
