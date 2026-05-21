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
# 순서 중요: 앞 카테고리가 먼저 매칭됨
# 아무것도 매칭 안 되면 AI/데이터 무관 영상 → 저장 스킵
_CATEGORY_RULES: list[tuple[str, set[str]]] = [
    # ── LLM (nlp보다 먼저: gpt/llama 등은 llm으로 분류)
    ("llm", {
        "large language model", "llm", "chatgpt", "gpt-4", "gpt4", "fine-tuning", "fine tuning",
        "retrieval augmented", "rag", "prompt engineering", "rlhf",
        "instruction tuning", "llama", "mistral", "gemma", "phi-3", "claude",
        "in-context learning", "chain of thought", "function calling",
        "언어모델", "파인튜닝", "프롬프트",
    }),
    # ── 수학 기초
    ("math", {
        "linear algebra", "calculus", "matrix", "eigenvalue", "eigenvector",
        "18.06", "strang", "convex optimization", "partial derivative",
        "fourier transform", "fourier series", "linear equation",
        "singular value decomposition", "svd", "determinant", "gram-schmidt",
        "선형대수", "미적분", "행렬", "고유값",
    }),
    # ── 통계 / 확률
    ("stat", {
        "probability", "statistics", "bayesian", "markov chain", "monte carlo",
        "statistical learning", "hypothesis testing", "a/b test",
        "causal inference", "time series", "cs109", "stochastic",
        "maximum likelihood", "confidence interval", "p-value",
        "확률", "통계", "베이지안",
    }),
    # ── 강화학습
    ("rl", {
        "reinforcement learning", "q-learning", "policy gradient", "mdp",
        "markov decision process", "actor critic", "ppo", "reward function",
        "exploration exploitation", "david silver", "openai gym",
        "강화학습", "보상함수",
    }),
    # ── 머신러닝 (rl 다음)
    ("ml", {
        "machine learning", "random forest", "xgboost", "gradient boosting",
        "scikit", "supervised learning", "unsupervised learning",
        "classification", "regression", "cs229", "andrew ng", "feature engineering",
        "decision tree", "naive bayes", "k-means", "svm", "support vector",
        "머신러닝", "분류", "회귀",
    }),
    # ── 컴퓨터 비전 (dl보다 먼저: cs231n은 cv)
    ("cv", {
        "computer vision", "convolutional", "cnn", "image classification",
        "object detection", "image segmentation", "vision transformer", "vit",
        "diffusion model", "stable diffusion", "gan", "yolo", "resnet",
        "cs231n", "alexnet", "vgg", "feature map", "bounding box",
        "컴퓨터비전", "이미지 분류", "객체 탐지",
    }),
    # ── 자연어처리 (cv 다음)
    ("nlp", {
        "natural language processing", "nlp", "bert", "transformer", "tokenizer",
        "attention mechanism", "language model", "text classification",
        "cs224n", "cs224", "word2vec", "embedding", "sequence to sequence",
        "named entity", "pos tagging", "sentiment analysis", "text generation",
        "자연어처리", "텍스트 분류",
    }),
    # ── 딥러닝 (cv/nlp보다 뒤)
    ("dl", {
        "deep learning", "neural network", "backpropagation", "activation function",
        "dropout", "batch normalization", "pytorch", "tensorflow", "keras",
        "deep neural", "multilayer perceptron", "mlp", "autoencoder",
        "딥러닝", "신경망", "역전파",
    }),
    # ── 데이터 엔지니어링
    ("data", {
        "data engineering", "data pipeline", "apache spark", "kafka",
        "data lake", "etl", "airflow", "dbt", "data warehouse",
        "hadoop", "flink", "bigquery", "snowflake", "data architecture",
        "stream processing", "batch processing", "data modeling",
        "데이터 엔지니어링", "파이프라인",
    }),
    # ── MLOps / 인프라
    ("mlops", {
        "kubernetes", "k8s", "docker", "mlops", "model deployment",
        "model serving", "ci/cd", "devops", "cloud native", "monitoring",
        "feature store", "model registry", "experiment tracking", "mlflow",
        "kubeflow", "bentoml", "triton", "model versioning",
        "쿠버네티스", "도커", "모델 배포",
    }),
    # ── 보험계리 / 계리학 (SOA, CAS)
    ("actuary", {
        "actuarial", "actuary", "soa exam", "exam fm", "exam p", "exam mfe",
        "exam stam", "exam ltam", "exam mas", "ifrs 17", "ifrs17",
        "life insurance mathematics", "mortality table", "life table",
        "credibility theory", "risk theory", "loss models", "annuity",
        "보험계리", "보험수리", "계리", "생명보험수학", "손해보험수리",
        "재보험", "보험료", "준비금",
    }),
    # ── 산업공학 / 운영과학
    ("ie", {
        "industrial engineering", "operations research", "supply chain management",
        "logistics", "quality management", "six sigma", "lean manufacturing",
        "queuing theory", "inventory management", "linear programming",
        "integer programming", "simulation modeling", "scheduling",
        "facility layout", "work measurement", "ergonomics",
        "산업공학", "운영관리", "물류관리", "품질관리", "공정관리",
        "수요예측", "재고관리", "대기이론",
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

    async def get_playlist_meta(
        self,
        playlist_id: str,
        access_token: str | None = None,
    ) -> dict:
        """단일 플레이리스트 메타(제목, 썸네일) 조회"""
        params  = {"part": "snippet", "id": playlist_id}
        headers = {}
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"
        else:
            params["key"] = self.api_key
        try:
            resp = await self.client.get(
                f"{self.BASE_URL}/playlists", params=params, headers=headers,
            )
            resp.raise_for_status()
            items = resp.json().get("items", [])
            if items:
                sn = items[0]["snippet"]
                return {
                    "title":         sn.get("title", playlist_id),
                    "thumbnail_url": sn.get("thumbnails", {}).get("medium", {}).get("url", ""),
                }
        except Exception as e:
            logger.warning(f"[YouTube] playlist meta 조회 실패 {playlist_id}: {e}")
        return {"title": playlist_id, "thumbnail_url": ""}

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

    async def fetch_liked_videos(
        self,
        access_token: str,
        max_results: int = 200,
    ) -> list[dict]:
        """좋아요한 영상 중 학습 관련 영상만 수집 (OAuth 필요). channel_id 포함."""
        results = []
        page_token = None

        while len(results) < max_results:
            params: dict = {"part": "snippet", "myRating": "like", "maxResults": 50}
            if page_token:
                params["pageToken"] = page_token

            try:
                resp = await self.client.get(
                    f"{self.BASE_URL}/videos",
                    params=params,
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                resp.raise_for_status()
                data = resp.json()
            except Exception as e:
                logger.error(f"[YouTube] fetch_liked_videos 실패: {e}")
                break

            for item in data.get("items", []):
                sn       = item["snippet"]
                title    = sn.get("title", "")
                desc     = sn.get("description", "")[:500]
                category = _classify_video(title, desc)
                if category is None:
                    continue  # 학습 무관 영상 스킵
                results.append({
                    "video_id":      item["id"],
                    "title":         title,
                    "channel_id":    sn["channelId"],
                    "channel_title": sn.get("channelTitle", ""),
                    "category":      category,
                })

            page_token = data.get("nextPageToken")
            if not page_token:
                break

        return results[:max_results]

    async def get_video_channel(self, video_id: str) -> dict | None:
        """video_id → {channel_id, channel_title}"""
        params = {"part": "snippet", "id": video_id, "key": self.api_key}
        try:
            resp = await self.client.get(f"{self.BASE_URL}/videos", params=params)
            resp.raise_for_status()
            items = resp.json().get("items", [])
            if not items:
                return None
            sn = items[0]["snippet"]
            return {
                "channel_id":    sn["channelId"],
                "channel_title": sn.get("channelTitle", ""),
            }
        except Exception as e:
            logger.error(f"[YouTube] get_video_channel 실패 {video_id}: {e}")
            return None

    async def get_channel_playlists(self, channel_id: str) -> list[dict]:
        """channel_id → 해당 채널의 공개 플레이리스트 목록"""
        playlists = []
        page_token = None

        while True:
            params: dict = {
                "part":      "snippet,contentDetails",
                "channelId": channel_id,
                "maxResults": 50,
                "key":       self.api_key,
            }
            if page_token:
                params["pageToken"] = page_token

            try:
                resp = await self.client.get(f"{self.BASE_URL}/playlists", params=params)
                resp.raise_for_status()
                data = resp.json()
            except Exception as e:
                logger.error(f"[YouTube] get_channel_playlists 실패 {channel_id}: {e}")
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

    async def check_video_availability(self, video_ids: list[str]) -> set[str]:
        """주어진 video_id 중 현재 공개 상태인 것들의 집합 반환 (50개 배치)"""
        available: set[str] = set()
        for i in range(0, len(video_ids), 50):
            batch  = video_ids[i:i + 50]
            params = {"part": "status", "id": ",".join(batch), "key": self.api_key}
            try:
                resp = await self.client.get(f"{self.BASE_URL}/videos", params=params)
                resp.raise_for_status()
                for item in resp.json().get("items", []):
                    if item.get("status", {}).get("privacyStatus") in ("public", "unlisted"):
                        available.add(item["id"])
            except Exception as e:
                logger.warning(f"[YouTube] 유효성 체크 실패 (batch {i}): {e}")
        return available

    async def close(self):
        await self.client.aclose()


def _iso8601_to_sec(duration: str) -> int:
    """PT1H2M3S → 3723"""
    import re
    h = int(re.search(r"(\d+)H", duration).group(1)) if re.search(r"(\d+)H", duration) else 0
    m = int(re.search(r"(\d+)M", duration).group(1)) if re.search(r"(\d+)M", duration) else 0
    s = int(re.search(r"(\d+)S", duration).group(1)) if re.search(r"(\d+)S", duration) else 0
    return h * 3600 + m * 60 + s
