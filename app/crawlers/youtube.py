"""
YouTube 강의 크롤러
- Google YouTube Data API v3 사용
- 플레이리스트에서 강의 메타데이터 수집
- AI/데이터 관련 영상만 키워드 필터링 후 자동 카테고리 분류
"""
import httpx
import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# 기본 공개 플레이리스트 (API 키만으로 접근 가능)
YOUTUBE_PLAYLISTS = [
    {
        "name": "선형대수학 (MIT 18.06)",
        "playlist_id": "PL49CF3715CB9EF31D",
    },
    {
        "name": "머신러닝 (Stanford CS229)",
        "playlist_id": "PLoROMvodv4rMiGQp3WXShtMGgzqpfVfbU",
    },
    {
        "name": "딥러닝 (Stanford CS231n)",
        "playlist_id": "PL3FW7Lu3i5JvHM8ljYj-zLfQRF3EO8sYv",
    },
    {
        "name": "자연어처리 (Stanford CS224n)",
        "playlist_id": "PLoROMvodv4rOSH4v6133s9LFPRHjEmbmJ",
    },
]

# 카테고리 분류 규칙 — (카테고리, 키워드 집합)
# 제목+설명에서 키워드 하나라도 매칭되면 해당 카테고리로 분류
# 아무것도 매칭 안 되면 AI/데이터 무관 영상 → 저장 스킵
_CATEGORY_RULES: list[tuple[str, set[str]]] = [
    ("math", {
        "linear algebra", "calculus", "statistics", "probability", "matrix",
        "eigenvalue", "eigenvector", "18.06", "strang", "convex optimization",
        "gradient descent", "partial derivative", "fourier", "linear equation",
        "선형대수", "미적분", "통계", "확률",
    }),
    ("ml", {
        "machine learning", "random forest", "xgboost", "gradient boosting",
        "scikit", "supervised learning", "unsupervised learning",
        "classification", "regression", "cs229", "andrew ng", "feature engineering",
        "머신러닝", "분류", "회귀",
    }),
    ("dl", {
        "deep learning", "neural network", "backpropagation", "activation function",
        "dropout", "batch normalization", "cs231n", "pytorch", "tensorflow",
        "딥러닝", "신경망", "역전파",
    }),
    ("nlp", {
        "natural language processing", "nlp", "bert", "transformer", "tokenizer",
        "attention mechanism", "language model", "text classification",
        "cs224n", "cs224", "word2vec", "embedding", "sequence to sequence",
        "자연어처리", "언어모델",
    }),
    ("cv", {
        "computer vision", "convolutional", "cnn", "image classification",
        "object detection", "image segmentation", "vision transformer", "vit",
        "diffusion model", "stable diffusion", "gan", "yolo", "resnet",
        "컴퓨터비전", "이미지",
    }),
    ("llm", {
        "large language model", "llm", "chatgpt", "fine-tuning", "fine tuning",
        "retrieval augmented", "rag", "prompt engineering", "rlhf",
        "instruction tuning", "llama", "mistral", "gemma", "in-context learning",
        "언어모델", "파인튜닝",
    }),
    ("data", {
        "data engineering", "data pipeline", "apache spark", "kafka",
        "data lake", "etl", "airflow", "dbt", "data warehouse",
        "hadoop", "flink", "bigquery", "snowflake", "data architecture",
        "데이터 엔지니어링", "파이프라인",
    }),
    ("stat", {
        "bayesian", "markov chain", "monte carlo", "statistical learning",
        "hypothesis testing", "a/b test", "causal inference", "time series",
        "베이지안", "통계학",
    }),
    ("infra", {
        "kubernetes", "k8s", "docker", "mlops", "model deployment",
        "model serving", "ci/cd", "devops", "cloud native", "monitoring",
        "쿠버네티스", "도커", "배포",
    }),
]


def _classify_video(title: str, description: str) -> str | None:
    """AI/데이터 관련 영상이면 카테고리 반환, 무관하면 None (스킵 대상)."""
    text = f"{title} {description}".lower()
    for category, keywords in _CATEGORY_RULES:
        if any(kw in text for kw in keywords):
            return category
    return None


@dataclass
class YoutubeVideo:
    video_id: str
    title: str
    description: str
    thumbnail_url: str
    duration_sec: int
    published_at: str
    playlist_id: str
    position: int
    category: str = ""  # _classify_video()로 자동 분류


class YouTubeCrawler:
    BASE_URL = "https://www.googleapis.com/youtube/v3"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.client  = httpx.AsyncClient(timeout=30)

    async def fetch_playlist_videos(
        self,
        playlist_id: str,
        filter_ai: bool = True,
        access_token: str | None = None,
    ) -> list[YoutubeVideo]:
        """플레이리스트 영상 수집. filter_ai=True 시 AI/데이터 관련 영상만 반환."""
        videos: list[YoutubeVideo] = []
        page_token = None

        while True:
            params: dict = {
                "part":       "snippet",
                "playlistId": playlist_id,
                "maxResults": 50,
            }
            if access_token:
                headers = {"Authorization": f"Bearer {access_token}"}
            else:
                params["key"] = self.api_key
                headers = {}

            if page_token:
                params["pageToken"] = page_token

            try:
                resp = await self.client.get(
                    f"{self.BASE_URL}/playlistItems",
                    params=params,
                    headers=headers,
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

                title = snippet.get("title", "")
                desc  = snippet.get("description", "")[:500]

                # AI/데이터 무관 영상 필터링
                category = _classify_video(title, desc)
                if filter_ai and category is None:
                    logger.debug(f"[YouTube] 스킵 (AI/데이터 무관): {title[:60]}")
                    continue

                videos.append(YoutubeVideo(
                    video_id=vid_id,
                    title=title,
                    description=desc,
                    thumbnail_url=(
                        snippet.get("thumbnails", {})
                        .get("medium", {})
                        .get("url", "")
                    ),
                    duration_sec=0,
                    published_at=snippet.get("publishedAt", ""),
                    playlist_id=playlist_id,
                    position=snippet.get("position", 0),
                    category=category or "misc",
                ))

            page_token = data.get("nextPageToken")
            if not page_token:
                break

        await self._fill_durations(videos, access_token=access_token)
        logger.info(f"[YouTube] {playlist_id}: {len(videos)}개 수집 (필터 후)")
        return videos

    async def fetch_user_playlists(self, access_token: str) -> list[dict]:
        """OAuth 토큰으로 내 계정의 플레이리스트 목록 조회"""
        playlists = []
        page_token = None

        while True:
            params: dict = {"part": "snippet,contentDetails", "mine": "true", "maxResults": 50}
            if page_token:
                params["pageToken"] = page_token

            try:
                resp = await self.client.get(
                    f"{self.BASE_URL}/playlists",
                    params=params,
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                resp.raise_for_status()
                data = resp.json()
            except Exception as e:
                logger.error(f"[YouTube] 플레이리스트 목록 조회 실패: {e}")
                break

            for item in data.get("items", []):
                sn = item["snippet"]
                playlists.append({
                    "playlist_id":   item["id"],
                    "title":         sn.get("title", ""),
                    "description":   sn.get("description", "")[:200],
                    "video_count":   item.get("contentDetails", {}).get("itemCount", 0),
                    "thumbnail_url": sn.get("thumbnails", {}).get("medium", {}).get("url", ""),
                })

            page_token = data.get("nextPageToken")
            if not page_token:
                break

        return playlists

    async def _fill_durations(
        self,
        videos: list[YoutubeVideo],
        access_token: str | None = None,
    ):
        """videos API로 재생시간(ISO 8601) → 초 변환"""
        for i in range(0, len(videos), 50):
            batch   = videos[i:i+50]
            ids_str = ",".join(v.video_id for v in batch)

            params  = {"part": "contentDetails", "id": ids_str}
            headers = {}
            if access_token:
                headers["Authorization"] = f"Bearer {access_token}"
            else:
                params["key"] = self.api_key

            try:
                resp = await self.client.get(
                    f"{self.BASE_URL}/videos",
                    params=params,
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json()
            except Exception as e:
                logger.error(f"[YouTube] duration 조회 실패: {e}")
                continue

            dur_map = {
                item["id"]: _iso8601_to_sec(item["contentDetails"]["duration"])
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
