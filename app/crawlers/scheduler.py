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
from app.services.tag_service import extract_all

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
        "date",
        id="seed_papers",
        replace_existing=True,
    )

    # 앱 시작 시 태그 없는 강의 일괄 태깅 (신규 과목 추가 후 한 번만)
    scheduler.add_job(
        job_tag_lectures,
        "date",
        id="tag_lectures",
        replace_existing=True,
    )

    # 매주 화요일 새벽 4시 — YouTube 영상 유효성 체크
    scheduler.add_job(
        job_check_video_availability,
        CronTrigger(day_of_week="tue", hour=4, minute=0),
        id="check_video_availability",
        replace_existing=True,
        misfire_grace_time=7200,
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


async def job_tag_lectures():
    """태그 없는 강의 일괄 GPT 태깅 (앱 시작 시 1회)"""
    if not settings.CHATGPT_API_KEY:
        logger.info("[Job] CHATGPT_API_KEY 없음 — 태깅 스킵")
        return

    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            select(Lecture).where(
                (Lecture.tags == None) | (Lecture.tags == [])  # noqa: E711
            )
        )).scalars().all()

    if not rows:
        logger.info("[Job] 태그 없는 강의 없음 — 스킵")
        return

    logger.info(f"[Job] 태그 없는 강의 {len(rows)}개 태깅 시작")
    tagged = 0
    async with AsyncSessionLocal() as db:
        for lec in rows:
            try:
                meta = await extract_all(lec.title, category=lec.category or "")
                lec_db = (await db.execute(
                    select(Lecture).where(Lecture.id == lec.id)
                )).scalar_one_or_none()
                if lec_db:
                    lec_db.tags         = meta["tags"]
                    lec_db.prerequisites = meta["prerequisites"]
                    tagged += 1
            except Exception as e:
                logger.warning(f"[Job] 태그 실패 ({lec.title[:40]}): {e}")
        await db.commit()

    logger.info(f"[Job] 태깅 완료 — {tagged}개")


async def job_check_video_availability():
    """DB에 저장된 YouTube 강의 유효성 배치 체크 — 삭제/비공개 영상 is_available=False"""
    if not settings.YOUTUBE_API_KEY:
        logger.warning("[Job] YOUTUBE_API_KEY 없음 — 유효성 체크 스킵")
        return

    logger.info("[Job] YouTube 영상 유효성 체크 시작")
    crawler = YouTubeCrawler(api_key=settings.YOUTUBE_API_KEY)
    try:
        async with AsyncSessionLocal() as db:
            rows = (await db.execute(
                select(Lecture).where(Lecture.youtube_video_id != None)  # noqa: E711
            )).scalars().all()

        if not rows:
            logger.info("[Job] youtube_video_id 가진 강의 없음 — 스킵")
            return

        video_ids = [r.youtube_video_id for r in rows]
        available = await crawler.check_video_availability(video_ids)

        marked_unavailable = 0
        marked_available   = 0
        async with AsyncSessionLocal() as db:
            for lec in rows:
                is_avail = lec.youtube_video_id in available
                lec_db = (await db.execute(
                    select(Lecture).where(Lecture.id == lec.id)
                )).scalar_one_or_none()
                if lec_db and lec_db.is_available != is_avail:
                    lec_db.is_available = is_avail
                    if is_avail:
                        marked_available += 1
                    else:
                        marked_unavailable += 1
            await db.commit()

        logger.info(
            f"[Job] 유효성 체크 완료 — "
            f"총 {len(rows)}개, 비공개처리 {marked_unavailable}개, 복구 {marked_available}개"
        )
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

            yt_url  = f"https://youtube.com/watch?v={v.video_id}"
            meta    = await extract_all(v.title, v.description, category)

            if exists:
                exists.youtube_url      = yt_url
                exists.youtube_video_id = v.video_id
                exists.thumbnail_url    = v.thumbnail_url or None
                exists.playlist_id      = v.playlist_id or None
                exists.duration_sec     = v.duration_sec
                exists.category         = category
                exists.is_available     = True
                if not exists.tags:
                    exists.tags = meta["tags"]
                if not exists.prerequisites:
                    exists.prerequisites = meta["prerequisites"]
            else:
                db.add(Lecture(
                    course_id=course.id,
                    title=v.title,
                    number=lecture_number,
                    category=category,
                    tags=meta["tags"],
                    prerequisites=meta["prerequisites"],
                    youtube_url=yt_url,
                    youtube_video_id=v.video_id,
                    thumbnail_url=v.thumbnail_url or None,
                    playlist_id=v.playlist_id or None,
                    duration_sec=v.duration_sec,
                ))
                saved += 1

        await db.commit()
    return saved
