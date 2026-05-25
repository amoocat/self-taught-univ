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
from app.crawlers.youtube import YouTubeCrawler, YOUTUBE_PLAYLISTS, _classify_video
from app.crawlers.blog import BlogCrawler
from app.crawlers.arxiv import ArxivCrawler
from app.models.models import FeedItem, Paper, Lecture, Course, VideoInbox
from app.services.tag_service import extract_all
from app.services.video_classifier import _parse_yt_date

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

    # 매주 일요일 새벽 3시 30분 — 좋아요 영상 채널 탐색 → 자동 수집
    scheduler.add_job(
        job_liked_videos_auto_import,
        CronTrigger(day_of_week="sun", hour=3, minute=30),
        id="liked_videos_auto_import",
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


async def job_curate_lectures():
    """일 1회 — ① inbox → 학습 영상 lectures 승격 + ② 기존 lectures 카테고리 재검토."""
    logger.info("[Job] 강의 큐레이션 시작")

    # ── ① VideoInbox 처리 ──────────────────────────────────────────
    promoted, discarded = await _promote_inbox_to_lectures()
    logger.info(f"[Job] inbox 처리 — 승격 {promoted}개, 폐기 {discarded}개")

    # ── ② 기존 Lecture 재검토 (카테고리 보정 / 비활성화) ──────────
    from app.crawlers.youtube import _classify_video

    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            select(Lecture).where(Lecture.youtube_video_id != None)  # noqa: E711
        )).scalars().all()

    deactivated   = 0
    reactivated   = 0
    recategorized = 0

    async with AsyncSessionLocal() as db:
        for lec in rows:
            lec_db = (await db.execute(
                select(Lecture).where(Lecture.id == lec.id)
            )).scalar_one_or_none()
            if not lec_db:
                continue

            category = _classify_video(lec.title, lec.subtitle or "")

            if category is None:
                if lec_db.is_available:
                    lec_db.is_available = False
                    deactivated += 1
            else:
                if not lec_db.is_available:
                    lec_db.is_available = True
                    reactivated += 1
                if lec_db.category != category:
                    lec_db.category = category
                    recategorized += 1

        await db.commit()

    logger.info(
        f"[Job] 큐레이션 완료 — 기존 {len(rows)}개 재검토: "
        f"비활성화 {deactivated}개, 복구 {reactivated}개, 카테고리 변경 {recategorized}개"
    )


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
                    published_at=_parse_yt_date(v.published_at),
                ))
                saved += 1

        await db.commit()
    return saved


async def job_liked_videos_auto_import() -> dict:
    """좋아요 영상 채널 탐색 → GPT 선별 → VideoInbox → Lecture 자동 수집.
    스케줄러(매주 일요일 03:30) 및 수동 트리거(`POST /api/v1/youtube/jobs/sync-liked`) 양쪽에서 호출.
    반환: {"discovered", "selected", "promoted", "discarded"}
    """
    import asyncio
    import json
    import openai as _openai

    # OAuth 토큰 — 파일 직접 읽기 (API 모듈 순환참조 방지)
    from app.api.v1.youtube import _get_access_token

    access_token = await _get_access_token()
    if not access_token:
        logger.warning("[Job:LikedImport] OAuth 토큰 없음 — 스킵")
        return {"discovered": 0, "selected": 0, "promoted": 0, "discarded": 0, "skipped": "no_token"}

    if not settings.YOUTUBE_API_KEY:
        logger.warning("[Job:LikedImport] YOUTUBE_API_KEY 없음 — 스킵")
        return {"discovered": 0, "selected": 0, "promoted": 0, "discarded": 0, "skipped": "no_api_key"}

    logger.info("[Job:LikedImport] 시작")
    crawler = YouTubeCrawler(api_key=settings.YOUTUBE_API_KEY)
    all_playlists: list[dict] = []

    try:
        # 좋아요 영상 최대 5페이지(~250개) 순회 → 채널 목록 수집
        channel_map: dict[str, dict] = {}
        page_token = None
        for _ in range(5):
            liked, page_token = await crawler.fetch_liked_videos_page(
                access_token, page_token=page_token
            )
            for v in liked:
                cid = v["channel_id"]
                if cid not in channel_map:
                    channel_map[cid] = {"channel_id": cid, "channel_title": v["channel_title"]}
            if not page_token:
                break

        logger.info(f"[Job:LikedImport] 발견 채널 {len(channel_map)}개")

        # 채널별 학습 관련 플리 수집 (병렬)
        async def _fetch_pls(ch: dict) -> list[dict]:
            try:
                pls = await crawler.get_channel_playlists(ch["channel_id"], max_pages=1)
                result = []
                for pl in pls:
                    cat = _classify_video(pl["title"], pl.get("description", ""))
                    if cat is not None:
                        result.append({**pl, "category": cat, "channel_title": ch["channel_title"]})
                return result
            except Exception:
                return []

        raw = await asyncio.gather(*[_fetch_pls(ch) for ch in channel_map.values()])
        for pls in raw:
            all_playlists.extend(pls)
    finally:
        await crawler.close()

    logger.info(f"[Job:LikedImport] 학습 플리 {len(all_playlists)}개 발견")

    if not all_playlists:
        return {"discovered": 0, "selected": 0, "promoted": 0, "discarded": 0}

    # 이미 등록된 플리 제외
    async with AsyncSessionLocal() as db:
        existing_ids = set(
            (await db.execute(
                select(Lecture.playlist_id).where(Lecture.playlist_id.isnot(None)).distinct()
            )).scalars().all()
        )
    new_playlists = [p for p in all_playlists if p["playlist_id"] not in existing_ids]
    logger.info(f"[Job:LikedImport] 신규 {len(new_playlists)}개 (기등록 {len(all_playlists) - len(new_playlists)}개 제외)")

    if not new_playlists:
        return {"discovered": len(all_playlists), "selected": 0, "promoted": 0, "discarded": 0}

    # GPT-4o-mini 선별 (쿼터 초과 시 video_count 순 fallback)
    MAX_SELECT = 30
    selected_ids: list[str] = []
    if settings.CHATGPT_API_KEY:
        try:
            payload = [
                {
                    "id": p["playlist_id"],
                    "title": p["title"],
                    "channel": p.get("channel_title", ""),
                    "category": p["category"],
                    "video_count": p.get("video_count", 0),
                    "description": (p.get("description") or "")[:120],
                }
                for p in new_playlists
            ]
            gpt = _openai.AsyncOpenAI(api_key=settings.CHATGPT_API_KEY)
            resp = await gpt.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": (
                    "You are curating an AI/ML self-study curriculum. "
                    f"Select up to {MAX_SELECT} most valuable playlists.\n"
                    "Prefer structured lecture series, reputable channels, many videos, diverse topics.\n"
                    "Exclude short clip collections and duplicate playlists from same channel.\n\n"
                    "Playlists:\n" + json.dumps(payload, ensure_ascii=False) +
                    '\n\nReturn JSON: {"selected_ids": ["PL...", ...]}'
                )}],
                response_format={"type": "json_object"},
            )
            selected_ids = json.loads(resp.choices[0].message.content).get("selected_ids", [])[:MAX_SELECT]
            logger.info(f"[Job:LikedImport] GPT 선택 {len(selected_ids)}개")
        except Exception as e:
            logger.warning(f"[Job:LikedImport] GPT 실패 — fallback 사용: {e}")

    if not selected_ids:
        sorted_pls = sorted(new_playlists, key=lambda p: p.get("video_count", 0), reverse=True)
        selected_ids = [p["playlist_id"] for p in sorted_pls[:MAX_SELECT]]
        logger.info(f"[Job:LikedImport] fallback 선택 {len(selected_ids)}개 (video_count 순)")

    selected_pls = [p for p in new_playlists if p["playlist_id"] in selected_ids]

    # 선택된 플리 영상 → VideoInbox 저장
    crawler2 = YouTubeCrawler(api_key=settings.YOUTUBE_API_KEY)
    try:
        for pl in selected_pls:
            videos = await crawler2.fetch_playlist_videos(
                pl["playlist_id"], filter_ai=False, access_token=access_token
            )
            await _save_to_inbox(videos)
    finally:
        await crawler2.close()

    # VideoInbox → Lecture 승격
    promoted, discarded = await _promote_inbox_to_lectures()
    logger.info(
        f"[Job:LikedImport] 완료 — 발견 {len(all_playlists)}, 선택 {len(selected_pls)}, "
        f"승격 {promoted}강, 폐기 {discarded}개"
    )
    return {
        "discovered": len(all_playlists),
        "selected": len(selected_pls),
        "promoted": promoted,
        "discarded": discarded,
    }


async def _save_to_inbox(videos) -> int:
    """video_id 기준 중복 방지 — 필터 없이 VideoInbox에 전체 저장."""
    saved = 0
    async with AsyncSessionLocal() as db:
        for v in videos:
            exists = (await db.execute(
                select(VideoInbox).where(VideoInbox.video_id == v.video_id)
            )).scalar_one_or_none()
            if not exists:
                db.add(VideoInbox(
                    video_id=v.video_id,
                    playlist_id=v.playlist_id or None,
                    title=v.title,
                    description=(v.description or "")[:500] or None,
                    thumbnail_url=v.thumbnail_url or None,
                    duration_sec=v.duration_sec or None,
                    published_at=v.published_at or None,
                    position=v.position,
                    channel_title=getattr(v, "channel_title", None),
                ))
                saved += 1
        await db.commit()
    return saved


async def _promote_inbox_to_lectures() -> tuple[int, int]:
    """VideoInbox 전체를 큐레이션: 학습 영상 → Lecture 승격, 나머지 삭제.
    반환: (승격 수, 폐기 수)
    """
    from app.crawlers.youtube import YoutubeVideo, _classify_video
    from sqlalchemy import delete

    async with AsyncSessionLocal() as db:
        inbox_rows = (await db.execute(select(VideoInbox))).scalars().all()

    if not inbox_rows:
        return 0, 0

    to_promote: list[YoutubeVideo] = []
    all_ids = [row.id for row in inbox_rows]

    MIN_DURATION_SEC = 300  # 5분 이하 제외
    for row in inbox_rows:
        if (row.duration_sec or 0) < MIN_DURATION_SEC:
            continue
        category = _classify_video(row.title, row.description or "")
        if category:
            to_promote.append(YoutubeVideo(
                video_id=row.video_id,
                title=row.title,
                description=row.description or "",
                thumbnail_url=row.thumbnail_url or "",
                duration_sec=row.duration_sec or 0,
                published_at=row.published_at or "",
                playlist_id=row.playlist_id or "",
                position=row.position,
                category=category,
            ))

    promoted = await _save_lectures(to_promote) if to_promote else 0

    # 처리한 inbox 행 전부 삭제 (승격 여부 무관)
    async with AsyncSessionLocal() as db:
        await db.execute(delete(VideoInbox).where(VideoInbox.id.in_(all_ids)))
        await db.commit()

    return promoted, len(inbox_rows) - len(to_promote)
