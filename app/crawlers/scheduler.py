"""
APScheduler 기반 배치 스케줄러
FastAPI lifespan에 붙어서 같이 실행됨

나중에 Airflow로 마이그레이션 시:
- 이 파일의 각 함수를 Airflow DAG task로 1:1 이전 가능
- 함수 시그니처를 의도적으로 단순하게 유지
"""
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.crawlers.youtube import YouTubeCrawler, YOUTUBE_PLAYLISTS
from app.crawlers.blog import BlogCrawler
from app.crawlers.arxiv import ArxivCrawler
from app.models.models import FeedItem, Paper, Lecture, Course

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="Asia/Seoul")


def init_scheduler():
    """FastAPI 시작 시 호출"""

    # 매일 새벽 2시 — 블로그 피드
    scheduler.add_job(
        job_crawl_blogs,
        CronTrigger(hour=2, minute=0),
        id="crawl_blogs",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # 매일 새벽 2시 30분 — arXiv 논문
    scheduler.add_job(
        job_crawl_arxiv,
        CronTrigger(hour=2, minute=30),
        id="crawl_arxiv",
        replace_existing=True,
        misfire_grace_time=3600,
    )

    # 매주 월요일 새벽 3시 — YouTube 강의 (자주 바뀌지 않음)
    scheduler.add_job(
        job_crawl_youtube,
        CronTrigger(day_of_week="mon", hour=3, minute=0),
        id="crawl_youtube",
        replace_existing=True,
        misfire_grace_time=7200,
    )

    # 앱 시작 시 저명 논문 한 번 즉시 수집 (DB가 비어있을 때)
    scheduler.add_job(
        job_seed_papers,
        "date",  # 즉시 1회 실행
        id="seed_papers",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("[Scheduler] 시작 완료")


def shutdown_scheduler():
    """FastAPI 종료 시 호출"""
    scheduler.shutdown(wait=False)
    logger.info("[Scheduler] 종료")


# ── 잡 함수들 ────────────────────────────────────────────────────
# 각 함수는 독립적으로 실행 가능 → Airflow task로 쉽게 이전 가능

async def job_crawl_blogs():
    """테크 블로그 RSS + 스크래핑"""
    logger.info("[Job] 블로그 크롤링 시작")
    crawler = BlogCrawler()
    try:
        posts = await crawler.fetch_all(limit_per_source=10)
        saved = await _save_feed_items(posts)
        logger.info(f"[Job] 블로그 완료 — 신규 {saved}개 저장")
    finally:
        await crawler.close()


async def job_crawl_arxiv():
    """arXiv 최신 논문 수집"""
    logger.info("[Job] arXiv 크롤링 시작")
    crawler = ArxivCrawler()
    try:
        papers = await crawler.fetch_recent(days_back=7, max_per_query=15)
        saved  = await _save_papers(papers)
        logger.info(f"[Job] arXiv 완료 — 신규 {saved}개 저장")
    finally:
        await crawler.close()


async def job_crawl_youtube():
    """YouTube 강의 메타데이터 수집"""
    if not settings.YOUTUBE_API_KEY:
        logger.warning("[Job] YOUTUBE_API_KEY 없음 — 스킵")
        return

    logger.info("[Job] YouTube 크롤링 시작")
    crawler = YouTubeCrawler(api_key=settings.YOUTUBE_API_KEY)
    try:
        for playlist in YOUTUBE_PLAYLISTS:
            videos = await crawler.fetch_playlist_videos(
                playlist["playlist_id"], filter_ai=True
            )
            saved = await _save_lectures(videos)
            logger.info(f"[Job] YouTube {playlist['name']}: {saved}개 저장")
    finally:
        await crawler.close()


async def job_seed_papers():
    """앱 시작 시 저명 논문 초기 데이터 수집"""
    async with AsyncSessionLocal() as db:
        count = (await db.execute(select(Paper))).scalars().first()
        if count:
            logger.info("[Job] 논문 이미 존재 — seed 스킵")
            return

    logger.info("[Job] 저명 논문 초기 수집 시작")
    crawler = ArxivCrawler()
    try:
        papers = await crawler.fetch_must_have()
        saved  = await _save_papers(papers)
        logger.info(f"[Job] 저명 논문 {saved}개 저장 완료")
    finally:
        await crawler.close()


# ── DB 저장 헬퍼 ─────────────────────────────────────────────────

async def _save_feed_items(posts) -> int:
    """url 기준 중복 방지 upsert"""
    from app.crawlers.blog import BlogPost
    saved = 0
    async with AsyncSessionLocal() as db:
        for post in posts:
            exists = (await db.execute(
                select(FeedItem).where(FeedItem.url == post.url)
            )).scalar_one_or_none()

            if not exists and post.url and post.title:
                db.add(FeedItem(
                    source_name=post.source_name,
                    source_type=post.source_type,
                    title=post.title,
                    url=post.url,
                    summary=post.summary,
                    tags=post.tags,
                    category=getattr(post, "category", "etc"),
                    published_at=post.published_at,
                ))
                saved += 1

        await db.commit()
    return saved


async def _save_papers(papers) -> int:
    """arxiv_id 기준 중복 방지"""
    saved = 0
    async with AsyncSessionLocal() as db:
        for p in papers:
            exists = (await db.execute(
                select(Paper).where(Paper.arxiv_id == p.arxiv_id)
            )).scalar_one_or_none()

            if not exists:
                db.add(Paper(
                    arxiv_id=p.arxiv_id,
                    title=p.title,
                    authors=p.authors,
                    abstract=p.abstract,
                    year=p.published_at.year,
                    venue=p.label,
                ))
                saved += 1

        await db.commit()
    return saved


async def _save_lectures(videos) -> int:
    """video.category로 course 조회 후 youtube_url/duration upsert"""
    saved = 0
    async with AsyncSessionLocal() as db:
        for v in videos:
            category = v.category or "misc"

            course = (await db.execute(
                select(Course).where(Course.category == category)
            )).scalar_one_or_none()

            if not course:
                logger.debug(f"[YouTube] category '{category}' 과목 없음 — 스킵: {v.title[:50]}")
                continue

            lecture_number = v.position + 1
            exists = (await db.execute(
                select(Lecture).where(
                    Lecture.course_id == course.id,
                    Lecture.number    == lecture_number,
                )
            )).scalar_one_or_none()

            yt_url = f"https://youtube.com/watch?v={v.video_id}"
            if exists:
                exists.youtube_url  = yt_url
                exists.duration_sec = v.duration_sec
                exists.category     = category
            else:
                db.add(Lecture(
                    course_id=course.id,
                    title=v.title,
                    number=lecture_number,
                    category=category,
                    youtube_url=yt_url,
                    duration_sec=v.duration_sec,
                ))
                saved += 1

        await db.commit()
    return saved
