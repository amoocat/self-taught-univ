"""
YouTube 플레이리스트 관리 엔드포인트.

  - GET  /youtube/playlists           → 내 계정 플레이리스트 목록 (OAuth)
  - GET  /youtube/playlist-meta       → 공개 플리 메타데이터
  - GET  /youtube/registered-playlists→ DB 등록된 playlist_id 목록
  - GET  /youtube/discover            → 좋아요/지정 플리 기반 채널 탐색
  - GET  /youtube/channel-playlists   → 채널 공개 플리 목록
  - GET  /youtube/preview/{id}        → 크롤링 전 미리보기
  - POST /youtube/playlists/filter    → 필터링 결과 미리보기 (저장 X)
  - POST /youtube/playlists/sync      → VideoInbox 저장 + 즉시 큐레이션
  - POST /youtube/playlists/sync-llm  → LLM 분류 후 Lecture 승격 (비동기)
  - POST /youtube/playlists/rescan-llm→ 기존 플리 재스캔
  - POST /youtube/discover/auto-import→ AI 자동 선별 + 저장
  - POST /youtube/inbox/curate        → VideoInbox 수동 큐레이션
  - POST /youtube/inbox/classify-llm  → LLM 기반 분류
"""
import json
import logging
import re
import threading as _threading
import time as _time

import openai
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.crawlers.youtube import YouTubeCrawler, _classify_video
from app.crawlers.scheduler import _save_lectures, _save_to_inbox, _promote_inbox_to_lectures
from app.db.session import get_db
from app.models.models import Lecture
from app.api.v1.youtube_oauth import (
    OAuthExpiredError,
    _get_access_token,
    _auth_error,
    _auth_expired_error,
)

logger = logging.getLogger(__name__)

router = APIRouter()

_PLAYLIST_CATEGORIES = "MATH|STAT|ML|DL|CV|NLP|LLM|RL|DATA|MLOPS|PROG|ACTUARY|IE|OTHER"

# 플레이리스트 분류 결과 캐시 (30분 TTL)
_playlist_cache: dict | None = None
_playlist_cache_ts: float = 0
_PLAYLIST_CACHE_TTL = 1800  # 30분

_PLAYLIST_ID_RE = re.compile(r"(?:list=|/playlist/|youtu\.be/)([A-Za-z0-9_-]{10,})")
_VIDEO_ID_RE    = re.compile(r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})")


# ── GPT / 키워드 분류 헬퍼 ──────────────────────────────────────

async def _classify_playlists_gpt(
    playlists: list[dict],
    access_token: str | None = None,
) -> list[dict]:
    """GPT-4o-mini로 플레이리스트 학습 관련 여부를 분류.

    각 플리에서 영상 제목 샘플을 실제로 가져와서 GPT에게 보여줌 (병렬 fetch, 최대 8개/플리).
    GPT 실패 시 키워드 기반 폴백. 전체 작업에 20초 타임아웃.
    """
    import asyncio

    if not playlists:
        return []

    if not settings.CHATGPT_API_KEY:
        return _classify_playlists_keyword(playlists)

    crawler = YouTubeCrawler(api_key=settings.YOUTUBE_API_KEY)
    _SEM = asyncio.Semaphore(8)

    async def _safe_sample(pl: dict) -> tuple[str, list[str]]:
        async with _SEM:
            try:
                titles = await asyncio.wait_for(
                    crawler.fetch_playlist_video_sample(
                        pl["playlist_id"], access_token=access_token, max_count=8
                    ),
                    timeout=8,
                )
            except (asyncio.TimeoutError, Exception):
                titles = []
        return pl["playlist_id"], titles

    try:
        sample_results = await asyncio.wait_for(
            asyncio.gather(*[_safe_sample(p) for p in playlists]),
            timeout=20,
        )
    except asyncio.TimeoutError:
        logger.warning("[YouTube] 샘플 수집 타임아웃 — 키워드 폴백")
        await crawler.close()
        return _classify_playlists_keyword(playlists)
    finally:
        await crawler.close()

    sample_map: dict[str, list[str]] = dict(sample_results)

    payload = [
        {
            "id":     p["playlist_id"],
            "title":  p["title"],
            "desc":   (p.get("description") or "")[:80],
            "count":  p.get("video_count", 0),
            "sample_videos": sample_map.get(p["playlist_id"], []),
        }
        for p in playlists
    ]

    _BATCH = 40
    result_map: dict[str, dict] = {}

    gpt = openai.AsyncOpenAI(api_key=settings.CHATGPT_API_KEY)
    for i in range(0, len(payload), _BATCH):
        batch = payload[i : i + _BATCH]
        prompt = (
            "You are filtering YouTube playlists for an AI/ML/math self-study platform.\n\n"
            "Each playlist entry includes its title, description, and actual video titles sampled from inside.\n"
            "Use the VIDEO TITLES as the primary signal — they reveal the true content far better than the playlist name.\n\n"
            "✅ Classify as study if videos are about:\n"
            "  - Math (linear algebra, calculus, statistics, probability, optimization, information theory)\n"
            "  - CS fundamentals (algorithms, data structures, OS, networks, C/C++, Python, etc.)\n"
            "  - ML / DL / CV / NLP / LLM / Reinforcement Learning\n"
            "  - Data Engineering (Spark, Kafka, Airflow, SQL, pipelines)\n"
            "  - MLOps, DevOps, Docker, Kubernetes\n"
            "  - Any academic/technical lecture series\n\n"
            "❌ NOT study: music, entertainment, vlogs, travel, food, personal videos.\n\n"
            f"For study playlists assign a category: {_PLAYLIST_CATEGORIES}\n\n"
            "Playlists (with sampled video titles):\n"
            + json.dumps(batch, ensure_ascii=False)
            + '\n\nReturn JSON: {"results": [{"id":"PL...","is_study":true,"category":"ML"}]}\n'
            "Set category to null for non-study playlists."
        )
        try:
            import asyncio
            resp = await asyncio.wait_for(
                gpt.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                ),
                timeout=15,
            )
            raw = json.loads(resp.choices[0].message.content)
            for r in raw.get("results", []):
                result_map[r["id"]] = r
        except Exception as e:
            logger.warning("[YouTube] GPT 플리 분류 배치 %d 실패: %s", i // _BATCH, e)

    if not result_map:
        logger.warning("[YouTube] GPT 분류 결과 없음 — 키워드 폴백")
        return _classify_playlists_keyword(playlists)

    classified = []
    for p in playlists:
        info = result_map.get(p["playlist_id"])
        if info is None:
            cat = _classify_video(p["title"], p.get("description", ""))
            classified.append({**p, "is_study": cat is not None, "category": cat})
        else:
            is_study = bool(info.get("is_study", False))
            category = (info.get("category") or "").lower().strip() or None
            classified.append({**p, "is_study": is_study, "category": category})

    return classified


def _classify_playlists_keyword(playlists: list[dict]) -> list[dict]:
    """키워드 기반 폴백 분류 (GPT 실패 시 사용)."""
    return [
        {**p, "is_study": (cat := _classify_video(p["title"], p.get("description", ""))) is not None, "category": cat}
        for p in playlists
    ]


# ── 플레이리스트 엔드포인트 ─────────────────────────────────────

@router.get("/playlists")
async def list_my_playlists(refresh: bool = False):
    """내 YouTube 계정 플레이리스트 목록 (OAuth 필요). 30분 캐시."""
    global _playlist_cache, _playlist_cache_ts

    if not refresh and _playlist_cache is not None:
        if _time.monotonic() - _playlist_cache_ts < _PLAYLIST_CACHE_TTL:
            logger.debug("[YouTube] /playlists 캐시 히트")
            return _playlist_cache

    try:
        access_token = await _get_access_token()
    except OAuthExpiredError:
        raise _auth_expired_error()
    if not access_token:
        raise _auth_error()

    crawler = YouTubeCrawler(api_key=settings.YOUTUBE_API_KEY)
    try:
        all_pls = await crawler.fetch_user_playlists(access_token)
    finally:
        await crawler.close()

    classified = await _classify_playlists_gpt(all_pls, access_token=access_token)
    study_pls = sorted([p for p in classified if p.get("is_study")], key=lambda p: p["title"])
    result = {"playlists": study_pls, "total": len(study_pls)}

    _playlist_cache = result
    _playlist_cache_ts = _time.monotonic()
    return result


@router.get("/playlist-meta")
async def get_playlist_meta(id: str = Query(..., description="플레이리스트 ID 또는 URL")):
    """공개 플레이리스트 메타데이터 조회 (OAuth 불필요)."""
    m = _PLAYLIST_ID_RE.search(id)
    playlist_id = m.group(1) if m else id.strip()

    if not playlist_id:
        raise HTTPException(status_code=400, detail="유효한 플레이리스트 ID 또는 URL을 입력해주세요.")

    crawler = YouTubeCrawler(api_key=settings.YOUTUBE_API_KEY)
    try:
        meta = await crawler.get_playlist_meta(playlist_id)
    finally:
        await crawler.close()

    if not meta.get("title") or meta["title"] == playlist_id:
        raise HTTPException(status_code=404, detail="플레이리스트를 찾을 수 없습니다. ID를 확인해주세요.")

    return {
        "playlist_id":   playlist_id,
        "title":         meta["title"],
        "thumbnail_url": meta.get("thumbnail_url", ""),
    }


@router.get("/registered-playlists")
async def get_registered_playlists(db: AsyncSession = Depends(get_db)):
    """lectures 테이블에 저장된 playlist_id 목록 반환 (프론트 '등록됨' 뱃지용)."""
    rows = (await db.execute(
        select(Lecture.playlist_id)
        .where(Lecture.playlist_id != None)  # noqa: E711
        .distinct()
    )).scalars().all()
    return {"playlist_ids": [r for r in rows if r]}


@router.get("/discover")
async def discover_study_channels(
    page_token: str = Query(None),
    source_playlist_id: str = Query(None, description="탐색 소스 플레이리스트 ID. 없으면 좋아요 영상 사용."),
):
    """좋아요(기본) 또는 지정 플리 → 학습 관련 채널 식별 → 채널별 플리 반환."""
    import asyncio

    try:
        access_token = await _get_access_token()
    except OAuthExpiredError:
        raise _auth_expired_error()
    if not access_token:
        raise _auth_error()

    crawler = YouTubeCrawler(api_key=settings.YOUTUBE_API_KEY)
    try:
        if source_playlist_id:
            liked, next_page_token = await crawler.fetch_playlist_videos_page(
                source_playlist_id, access_token, page_token=page_token,
            )
        else:
            liked, next_page_token = await crawler.fetch_liked_videos_page(
                access_token, page_token=page_token,
            )

        channel_map: dict[str, dict] = {}
        for v in liked:
            cid = v["channel_id"]
            if cid not in channel_map:
                channel_map[cid] = {
                    "channel_id":    cid,
                    "channel_title": v["channel_title"],
                    "video_count":   0,
                    "categories":    set(),
                }
            channel_map[cid]["video_count"] += 1
            channel_map[cid]["categories"].add(v["category"])

        async def _fetch_study_playlists(ch: dict) -> dict | None:
            try:
                pls = await crawler.get_channel_playlists(ch["channel_id"], max_pages=1)
                study_pls = [
                    {**pl, "category": cat}
                    for pl in pls
                    if (cat := _classify_video(pl["title"], pl.get("description", ""))) is not None
                ]
                if not study_pls:
                    return None
                return {
                    "channel_id":    ch["channel_id"],
                    "channel_title": ch["channel_title"],
                    "video_count":   ch["video_count"],
                    "categories":    sorted(ch["categories"]),
                    "playlists":     study_pls,
                }
            except Exception:
                return None

        raw = await asyncio.gather(*[_fetch_study_playlists(ch) for ch in channel_map.values()])
        results = [r for r in raw if r is not None]

    finally:
        await crawler.close()

    return {
        "total_study_videos": len(liked),
        "channel_count":      len(results),
        "channels":           results,
        "next_page_token":    next_page_token,
    }


@router.get("/channel-playlists")
async def get_channel_playlists_endpoint(
    video_id:   str = Query(None, description="YouTube 영상 ID 또는 URL"),
    channel_id: str = Query(None, description="YouTube 채널 ID"),
):
    """영상 ID/URL 또는 채널 ID → 채널의 공개 플레이리스트 목록 조회 (OAuth 불필요)."""
    raw_vid = (video_id or "").strip()
    m = _VIDEO_ID_RE.search(raw_vid)
    vid = m.group(1) if m else (raw_vid if len(raw_vid) == 11 else None)

    if not vid and not channel_id:
        raise HTTPException(status_code=400, detail="video_id 또는 channel_id 중 하나는 필요합니다.")

    crawler = YouTubeCrawler(api_key=settings.YOUTUBE_API_KEY)
    try:
        if vid:
            channel_meta = await crawler.get_video_channel(vid)
            if not channel_meta:
                raise HTTPException(status_code=404, detail="영상을 찾을 수 없습니다. video_id를 확인해주세요.")
            cid           = channel_meta["channel_id"]
            channel_title = channel_meta["channel_title"]
        else:
            cid           = channel_id.strip()
            channel_title = cid

        playlists = await crawler.get_channel_playlists(cid)
    finally:
        await crawler.close()

    filtered = [
        {**pl, "category": cat}
        for pl in playlists
        if (cat := _classify_video(pl["title"], pl.get("description", ""))) is not None
    ]

    return {
        "channel_id":     cid,
        "channel_title":  channel_title,
        "playlist_count": len(filtered),
        "playlists":      filtered,
    }


@router.get("/preview/{playlist_id}")
async def preview_playlist(playlist_id: str, filter_ai: bool = True):
    """크롤링 전 미리보기 — 어떤 영상이 필터링되고 어떤 카테고리로 분류되는지 확인."""
    try:
        access_token = await _get_access_token()
    except OAuthExpiredError:
        access_token = None
    crawler = YouTubeCrawler(api_key=settings.YOUTUBE_API_KEY)
    try:
        videos = await crawler.fetch_playlist_videos(
            playlist_id, filter_ai=filter_ai, access_token=access_token,
        )
    finally:
        await crawler.close()

    return {
        "playlist_id": playlist_id,
        "total":       len(videos),
        "videos": [
            {"title": v.title, "category": v.category, "duration": v.duration_sec, "video_id": v.video_id}
            for v in videos
        ],
    }


@router.post("/playlists/filter")
async def filter_playlists(playlist_ids: list[str]):
    """선택한 플레이리스트 영상 필터링 결과 미리보기 (저장 X)."""
    try:
        access_token = await _get_access_token()
    except OAuthExpiredError:
        access_token = None
    crawler = YouTubeCrawler(api_key=settings.YOUTUBE_API_KEY)
    results = []
    total_videos = 0
    try:
        for pid in playlist_ids:
            pl_meta = await crawler.get_playlist_meta(pid, access_token=access_token)
            videos  = await crawler.fetch_playlist_videos(pid, filter_ai=True, access_token=access_token)
            total_videos += len(videos)
            results.append({
                "playlist_id":    pid,
                "playlist_title": pl_meta.get("title", pid),
                "total_filtered": len(videos),
                "videos": [
                    {
                        "video_id":      v.video_id,
                        "title":         v.title,
                        "category":      v.category,
                        "duration_sec":  v.duration_sec,
                        "thumbnail_url": v.thumbnail_url,
                        "position":      v.position,
                    }
                    for v in videos
                ],
            })
    finally:
        await crawler.close()

    return {"total": total_videos, "playlists": results}


@router.post("/playlists/sync")
async def sync_playlists(playlist_ids: list[str]):
    """선택한 플레이리스트 전체 영상 → VideoInbox 저장 + 즉시 큐레이션."""
    try:
        access_token = await _get_access_token()
    except OAuthExpiredError:
        access_token = None
    crawler = YouTubeCrawler(api_key=settings.YOUTUBE_API_KEY)
    result = {}
    total_fetched = 0
    try:
        for pid in playlist_ids:
            videos = await crawler.fetch_playlist_videos(pid, filter_ai=False, access_token=access_token)
            saved = await _save_to_inbox(videos)
            total_fetched += len(videos)
            result[pid] = {"fetched": len(videos), "inbox": saved}
    finally:
        await crawler.close()

    promoted, discarded = await _promote_inbox_to_lectures()
    return {
        "result": result,
        "curated": {"promoted": promoted, "discarded": discarded},
    }


@router.post("/inbox/curate")
async def curate_inbox():
    """VideoInbox → 학습 관련 영상 Lecture 승격, 나머지 삭제."""
    promoted, discarded = await _promote_inbox_to_lectures()
    return {"promoted": promoted, "discarded": discarded}


@router.post("/inbox/classify-llm")
async def classify_inbox_with_llm(db: AsyncSession = Depends(get_db)):
    """GPT-4o-mini로 VideoInbox 영상을 분류 → 강좌 배정 + 난이도 설정 후 Lecture 승격."""
    from app.services.video_classifier import classify_and_promote
    return await classify_and_promote(db)


@router.post("/playlists/rescan-llm")
async def rescan_known_playlists(db: AsyncSession = Depends(get_db)):
    """기존 Lecture에 등록된 플레이리스트를 전부 재스캔 → LLM 분류 후 누락 강의 추가."""
    from app.services.video_classifier import classify_and_promote

    rows = (await db.execute(
        select(Lecture.playlist_id).where(Lecture.playlist_id.isnot(None)).distinct()
    )).scalars().all()
    playlist_ids = [r for r in rows if r]

    if not playlist_ids:
        return {"error": "등록된 플레이리스트가 없습니다."}

    existing_vids = set(
        (await db.execute(
            select(Lecture.youtube_video_id).where(Lecture.youtube_video_id.isnot(None))
        )).scalars().all()
    )

    try:
        access_token = await _get_access_token()
    except OAuthExpiredError:
        access_token = None

    crawler = YouTubeCrawler(api_key=settings.YOUTUBE_API_KEY)
    inbox_result = {}
    try:
        for pid in playlist_ids:
            videos = await crawler.fetch_playlist_videos(pid, filter_ai=False, access_token=access_token)
            new_videos = [v for v in videos if v.video_id not in existing_vids]
            saved = await _save_to_inbox(new_videos) if new_videos else 0
            if saved:
                inbox_result[pid] = {"fetched": len(videos), "new": saved}
    finally:
        await crawler.close()

    classify_result = await classify_and_promote(db)
    return {
        "playlists_scanned": len(playlist_ids),
        "inbox": inbox_result,
        "llm": classify_result,
    }


@router.post("/discover/auto-import")
async def discover_auto_import(
    source_playlist_id: str = Query(None, description="탐색 소스 플리 ID. 없으면 좋아요 영상 사용."),
    page_token: str = Query(None),
    max_playlists: int = Query(20, description="AI가 선택할 최대 플레이리스트 수"),
    db: AsyncSession = Depends(get_db),
):
    """좋아요(또는 지정 플리) → 채널 플리 탐색 → GPT 자동 선택 → VideoInbox 저장."""
    import asyncio

    try:
        access_token = await _get_access_token()
    except OAuthExpiredError:
        raise _auth_expired_error()
    if not access_token:
        raise _auth_error()

    crawler = YouTubeCrawler(api_key=settings.YOUTUBE_API_KEY)
    all_playlists: list[dict] = []
    try:
        if source_playlist_id:
            liked, _ = await crawler.fetch_playlist_videos_page(
                source_playlist_id, access_token, page_token=page_token,
            )
        else:
            liked, _ = await crawler.fetch_liked_videos_page(access_token, page_token=page_token)

        channel_map: dict[str, dict] = {}
        for v in liked:
            cid = v["channel_id"]
            if cid not in channel_map:
                channel_map[cid] = {"channel_id": cid, "channel_title": v["channel_title"]}

        async def _fetch_study_pls(ch: dict) -> list[dict]:
            try:
                pls = await crawler.get_channel_playlists(ch["channel_id"], max_pages=1)
                return [
                    {**pl, "category": cat, "channel_title": ch["channel_title"]}
                    for pl in pls
                    if (cat := _classify_video(pl["title"], pl.get("description", ""))) is not None
                ]
            except Exception:
                return []

        raw = await asyncio.gather(*[_fetch_study_pls(ch) for ch in channel_map.values()])
        for pls in raw:
            all_playlists.extend(pls)
    finally:
        await crawler.close()

    if not all_playlists:
        return {"selected": 0, "message": "학습 관련 플레이리스트를 발견하지 못했습니다."}

    existing_ids = set(
        (await db.execute(
            select(Lecture.playlist_id).where(Lecture.playlist_id.isnot(None)).distinct()
        )).scalars().all()
    )
    new_playlists = [p for p in all_playlists if p["playlist_id"] not in existing_ids]

    if not new_playlists:
        return {"selected": 0, "message": "이미 등록된 플레이리스트만 발견됐습니다."}

    gpt = openai.AsyncOpenAI(api_key=settings.CHATGPT_API_KEY)
    payload = [
        {
            "id":          p["playlist_id"],
            "title":       p["title"],
            "channel":     p.get("channel_title", ""),
            "category":    p["category"],
            "video_count": p.get("video_count", 0),
            "description": (p.get("description") or "")[:120],
        }
        for p in new_playlists
    ]

    prompt = (
        "You are curating an AI/ML self-study curriculum. Select the most valuable playlists.\n\n"
        f"Choose up to {max_playlists} playlists. Prefer:\n"
        "- Structured lecture series over random video collections\n"
        "- Playlists with many videos (deeper coverage)\n"
        "- Mix of foundational and advanced topics\n"
        "- Reputable channels (universities, known researchers, established educators)\n\n"
        "Exclude:\n"
        "- Short clip compilations or interview collections\n"
        "- Multiple nearly identical playlists from the same channel on the same topic\n\n"
        "Playlists:\n"
        + json.dumps(payload, ensure_ascii=False)
        + f'\n\nReturn JSON: {{"selected_ids": ["PL...", ...], "reason": "brief explanation in Korean"}}'
    )

    selected_ids: list[str] = []
    try:
        resp = await gpt.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )
        raw_result = json.loads(resp.choices[0].message.content)
        selected_ids = raw_result.get("selected_ids", [])[:max_playlists]
    except Exception as e:
        logger.error("auto_import GPT error: %s", e)
        sorted_pls = sorted(new_playlists, key=lambda p: p.get("video_count", 0), reverse=True)
        selected_ids = [p["playlist_id"] for p in sorted_pls[:max_playlists]]

    selected_pls = [p for p in new_playlists if p["playlist_id"] in selected_ids]

    if not selected_pls:
        return {"selected": 0, "message": "AI가 선택한 플레이리스트가 없습니다."}

    crawler2 = YouTubeCrawler(api_key=settings.YOUTUBE_API_KEY)
    try:
        for pl in selected_pls:
            videos = await crawler2.fetch_playlist_videos(
                pl["playlist_id"], filter_ai=False, access_token=access_token,
            )
            await _save_to_inbox(videos)
    finally:
        await crawler2.close()

    promoted, discarded = await _promote_inbox_to_lectures()

    return {
        "discovered": len(all_playlists),
        "selected":   len(selected_pls),
        "selected_playlists": [
            {"title": p["title"], "playlist_id": p["playlist_id"], "category": p["category"]}
            for p in selected_pls
        ],
        "curated": {"promoted": promoted, "discarded": discarded},
    }


# ── LLM 동기화 (별도 스레드) ────────────────────────────────────

_sync_running = False
_sync_lock_th = _threading.Lock()


def _run_sync_in_thread(playlist_ids: list[str]):
    """별도 스레드 + 자체 이벤트 루프에서 sync 실행 — uvicorn 이벤트 루프와 완전 격리."""
    import asyncio

    async def _body():
        from app.services.video_classifier import classify_and_promote
        from app.db.session import AsyncSessionLocal

        try:
            access_token = await _get_access_token()
        except OAuthExpiredError:
            access_token = None

        crawler = YouTubeCrawler(api_key=settings.YOUTUBE_API_KEY)
        try:
            for pid in playlist_ids:
                try:
                    videos = await crawler.fetch_playlist_videos(pid, filter_ai=False, access_token=access_token)
                    await _save_to_inbox(videos)
                    logger.info("sync-llm: %s → %d videos fetched", pid, len(videos))
                except Exception as e:
                    logger.error("sync-llm fetch error [%s]: %s", pid, e)
        finally:
            await crawler.close()

        async with AsyncSessionLocal() as db:
            try:
                result = await classify_and_promote(db)
                logger.info("sync-llm classify done: %s", result)
            except Exception as e:
                logger.error("sync-llm classify error: %s", e)

    global _sync_running
    try:
        asyncio.run(_body())
    except Exception as e:
        logger.error("sync-llm thread error: %s", e)
    finally:
        with _sync_lock_th:
            _sync_running = False
        logger.info("sync-llm thread finished")


@router.post("/playlists/sync-llm", status_code=202)
async def sync_playlists_llm(
    playlist_ids: list[str],
    background_tasks: BackgroundTasks,
):
    """플레이리스트 → LLM 분류 → Lecture 승격. 별도 스레드 비동기 실행, 즉시 202 반환."""
    global _sync_running
    if not playlist_ids:
        raise HTTPException(status_code=400, detail="playlist_ids가 비어 있습니다.")

    with _sync_lock_th:
        if _sync_running:
            raise HTTPException(status_code=409, detail="이미 동기화가 진행 중입니다. 잠시 후 다시 시도해주세요.")
        _sync_running = True

    t = _threading.Thread(target=_run_sync_in_thread, args=(playlist_ids,), daemon=True)
    t.start()
    return {"status": "started", "playlist_ids": playlist_ids}
