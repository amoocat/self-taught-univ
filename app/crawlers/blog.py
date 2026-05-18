"""
테크 블로그 RSS/스크래핑 크롤러
- RSS 있는 곳: feedparser로 파싱
- RSS 없는 곳: httpx + BeautifulSoup 스크래핑
"""
import httpx
import feedparser
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


@dataclass
class BlogPost:
    source_name: str
    source_type: str          # "personal" | "bigtech" | "korean"
    title: str
    url: str
    summary: str = ""
    tags: list[str] = field(default_factory=list)
    published_at: Optional[datetime] = None


# ── RSS 소스 목록 ────────────────────────────────────────────────
RSS_SOURCES = [
    # 개인 연구자
    {"name": "Andrej Karpathy",  "type": "personal", "url": "https://karpathy.github.io/feed.xml"},
    {"name": "Sebastian Ruder",  "type": "personal", "url": "https://ruder.io/rss/index.rss"},
    {"name": "Chip Huyen",       "type": "personal", "url": "https://huyenchip.com/feed.xml"},
    {"name": "Lilian Weng",      "type": "personal", "url": "https://lilianweng.github.io/index.xml"},
    {"name": "Jay Alammar",      "type": "personal", "url": "https://jalammar.github.io/feed.xml"},
    # 빅테크
    {"name": "Google AI Blog",   "type": "bigtech",  "url": "https://blog.research.google/feeds/posts/default"},
    {"name": "OpenAI Blog",      "type": "bigtech",  "url": "https://openai.com/blog/rss/"},
    {"name": "DeepMind Blog",    "type": "bigtech",  "url": "https://deepmind.google/blog/rss.xml"},
    {"name": "Uber Engineering", "type": "bigtech",  "url": "https://www.uber.com/en-KR/blog/engineering/rss/"},
    {"name": "Airbnb Tech",      "type": "bigtech",  "url": "https://medium.com/feed/airbnb-engineering"},
    # 국내
    {"name": "카카오 Tech",      "type": "korean",   "url": "https://tech.kakao.com/feed/"},
    {"name": "네이버 D2",        "type": "korean",   "url": "https://d2.naver.com/d2.atom"},
    {"name": "LINE Engineering", "type": "korean",   "url": "https://engineering.linecorp.com/ko/feed"},
    {"name": "토스 Tech",        "type": "korean",   "url": "https://toss.tech/rss.xml"},
    {"name": "당근 Tech",        "type": "korean",   "url": "https://medium.com/feed/daangn"},
]

# RSS 없어서 직접 스크래핑해야 하는 곳
SCRAPE_SOURCES = [
    {"name": "버즈빌 Tech", "type": "korean", "url": "https://tech.buzzvil.com"},
    {"name": "쏘카 Tech",   "type": "korean", "url": "https://tech.socarcorp.kr"},
]

# ML/Data 관련 키워드 (소문자 비교)
_ML_KEYWORDS = {
    # 영문
    "machine learning", "deep learning", "neural", "transformer", "attention",
    "llm", "gpt", "bert", "diffusion", "reinforcement", "rl ", " rl,", "nlp",
    "natural language", "computer vision", "embedding", "vector", "gradient",
    "backprop", "convolution", "lstm", "rnn", "gan", "vae", "autoencoder",
    "recommendation", "retrieval", "rag", "fine-tun", "finetun", "pretrain",
    "inference", "training", "dataset", "benchmark", "generative", "classification",
    "regression", "clustering", "feature", "model", "ai ", " ai,", "artificial",
    "data science", "data engineer", "data pipeline", "data platform", "analytics",
    "spark", "kafka", "flink", "hadoop", "hive", "airflow", "mlflow", "mlops",
    "pytorch", "tensorflow", "jax", "cuda", "gpu", "tpu",
    # 한국어
    "머신러닝", "딥러닝", "신경망", "트랜스포머", "언어모델", "추천",
    "자연어", "컴퓨터비전", "임베딩", "강화학습", "생성형", "분류",
    "데이터 사이언스", "데이터 엔지니어", "데이터 파이프라인", "데이터 플랫폼",
    "데이터 분석", "데이터베이스", "검색", "랭킹", "개인화", "클러스터링",
    "피처", "모델", "학습", "인공지능", "ai", "ml",
}


def _is_ml_related(post: "BlogPost") -> bool:
    """제목 + 요약 + 태그에 ML/Data 키워드가 하나라도 있으면 True"""
    # personal/bigtech 소스는 이미 ML 특화 — 모두 통과
    if post.source_type in ("personal", "bigtech"):
        return True

    text = " ".join([
        post.title.lower(),
        post.summary.lower(),
        " ".join(t.lower() for t in post.tags),
    ])
    return any(kw in text for kw in _ML_KEYWORDS)


class BlogCrawler:

    def __init__(self):
        self.client = httpx.AsyncClient(
            timeout=20,
            headers={"User-Agent": "STU-Crawler/1.0 (educational project)"},
            follow_redirects=True,
        )

    async def fetch_all(self, limit_per_source: int = 10) -> list[BlogPost]:
        posts = []

        for source in RSS_SOURCES:
            try:
                new_posts = await self._fetch_rss(source, limit_per_source)
                filtered = [p for p in new_posts if _is_ml_related(p)]
                posts.extend(filtered)
                logger.info(f"[Blog/RSS] {source['name']}: {len(new_posts)}개 수집 → {len(filtered)}개 ML 관련")
            except Exception as e:
                logger.warning(f"[Blog/RSS] {source['name']} 실패: {e}")

        for source in SCRAPE_SOURCES:
            try:
                new_posts = await self._scrape(source, limit_per_source)
                filtered = [p for p in new_posts if _is_ml_related(p)]
                posts.extend(filtered)
                logger.info(f"[Blog/Scrape] {source['name']}: {len(new_posts)}개 수집 → {len(filtered)}개 ML 관련")
            except Exception as e:
                logger.warning(f"[Blog/Scrape] {source['name']} 실패: {e}")

        return posts

    async def _fetch_rss(self, source: dict, limit: int) -> list[BlogPost]:
        resp = await self.client.get(source["url"])
        feed = feedparser.parse(resp.text)
        posts = []

        for entry in feed.entries[:limit]:
            published = None
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                try:
                    published = datetime(*entry.published_parsed[:6])
                except Exception:
                    pass

            summary = (
                entry.get("summary", "") or
                entry.get("content", [{}])[0].get("value", "")
            )
            # HTML 태그 제거
            if summary:
                summary = BeautifulSoup(summary, "html.parser").get_text()[:500]

            posts.append(BlogPost(
                source_name=source["name"],
                source_type=source["type"],
                title=entry.get("title", "").strip()[:500],
                url=entry.get("link", "")[:1000],
                summary=summary,
                tags=_extract_tags(entry),
                published_at=published,
            ))

        return posts

    async def _scrape(self, source: dict, limit: int) -> list[BlogPost]:
        """RSS 없는 블로그 직접 스크래핑 (공통 패턴)"""
        resp = await self.client.get(source["url"])
        soup = BeautifulSoup(resp.text, "html.parser")
        posts = []

        # article, .post, .blog-item 등 일반적인 패턴 시도
        candidates = (
            soup.find_all("article")[:limit] or
            soup.find_all(class_=lambda c: c and "post" in c.lower())[:limit]
        )

        for el in candidates:
            title_el = el.find(["h1","h2","h3"])
            link_el  = el.find("a", href=True)
            if not title_el or not link_el:
                continue

            url = link_el["href"]
            if not url.startswith("http"):
                from urllib.parse import urljoin
                url = urljoin(source["url"], url)

            desc_el = el.find("p")
            summary = desc_el.get_text(strip=True)[:500] if desc_el else ""

            posts.append(BlogPost(
                source_name=source["name"],
                source_type=source["type"],
                title=title_el.get_text(strip=True)[:500],
                url=url[:1000],
                summary=summary,
            ))

        return posts

    async def close(self):
        await self.client.aclose()


def _extract_tags(entry) -> list[str]:
    tags = []
    for tag in getattr(entry, "tags", []):
        label = tag.get("label") or tag.get("term", "")
        if label:
            tags.append(label[:50])
    return tags[:10]
