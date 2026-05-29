"""
YouTube OAuth + 플레이리스트 관리 API

흐름:
  1. GET  /youtube/oauth          → Google OAuth URL 반환
  2. GET  /youtube/oauth/callback → 인증 코드로 토큰 교환 후 저장
  3. GET  /youtube/playlists      → 내 계정 플레이리스트 목록
  4. POST /youtube/playlists/sync → 선택한 플레이리스트 크롤링 + 저장
  5. GET  /youtube/preview/{id}   → 크롤링 전 필터 결과 미리보기
"""
import json
import logging
import re
import secrets
from pathlib import Path

import httpx
import openai
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.crawlers.youtube import YouTubeCrawler, _classify_video
from app.crawlers.scheduler import _save_lectures, _save_to_inbox, _promote_inbox_to_lectures
from app.db.session import get_db
from app.models.models import Lecture

logger = logging.getLogger(__name__)

router = APIRouter()

_TOKEN_FILE = Path("oauth_tokens/youtube.json")
_GOOGLE_AUTH_URL   = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL  = "https://oauth2.googleapis.com/token"
_SCOPES = "https://www.googleapis.com/auth/youtube.readonly"

# CSRF 방지용 임시 state 저장 (단일 사용자 앱이라 메모리로 충분)
_pending_states: set[str] = set()


def _load_token() -> dict | None:
    if _TOKEN_FILE.exists():
        return json.loads(_TOKEN_FILE.read_text())
    return None


def _save_token(data: dict):
    _TOKEN_FILE.parent.mkdir(exist_ok=True)
    _TOKEN_FILE.write_text(json.dumps(data, indent=2))


class OAuthExpiredError(Exception):
    """refresh_token이 폐기/만료된 경우 — 재인증 필요"""
    pass


async def _refresh_if_needed(token: dict) -> str:
    """access_token 만료 시 refresh_token으로 재발급.
    invalid_grant(토큰 폐기) 시 토큰 파일 삭제 후 OAuthExpiredError 발생.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.post(_GOOGLE_TOKEN_URL, data={
            "client_id":     settings.YOUTUBE_OAUTH_CLIENT,
            "client_secret": settings.YOUTUBE_OAUTH_SECRET,
            "refresh_token": token["refresh_token"],
            "grant_type":    "refresh_token",
        })
        if resp.status_code == 400:
            err = resp.json().get("error", "")
            if err == "invalid_grant":
                # 토큰 폐기됨 — 파일 삭제하고 재인증 요구
                _TOKEN_FILE.unlink(missing_ok=True)
                logger.warning("[YouTube OAuth] refresh_token 폐기됨 — 재인증 필요")
                raise OAuthExpiredError("refresh_token이 폐기됐습니다. 재인증이 필요합니다.")
        resp.raise_for_status()
        new = resp.json()
        token["access_token"] = new["access_token"]
        _save_token(token)
    return token["access_token"]


async def _get_access_token() -> str | None:
    """저장된 토큰에서 유효한 access_token 반환.
    토큰 없음 → None, 토큰 폐기 → OAuthExpiredError 발생.
    """
    token = _load_token()
    if not token:
        return None
    return await _refresh_if_needed(token)


def _auth_error() -> HTTPException:
    """OAuth 인증 필요 시 반환할 표준 401"""
    return HTTPException(
        status_code=401,
        detail={
            "code": "YOUTUBE_AUTH_REQUIRED",
            "message": "YouTube 인증이 필요합니다.",
            "auth_url": "/api/v1/youtube/oauth",
        },
    )


def _auth_expired_error() -> HTTPException:
    """OAuth 토큰 만료/폐기 시 반환할 표준 401"""
    return HTTPException(
        status_code=401,
        detail={
            "code": "YOUTUBE_AUTH_EXPIRED",
            "message": "YouTube 인증이 만료됐습니다. 재인증이 필요합니다.",
            "auth_url": "/api/v1/youtube/oauth",
        },
    )


# ── OAuth 엔드포인트 ────────────────────────────────────────────

@router.get("/oauth")
async def youtube_oauth_start():
    """Google OAuth 인증 URL로 리디렉트. 처음 1회만 실행."""
    if not settings.YOUTUBE_OAUTH_CLIENT or not settings.YOUTUBE_OAUTH_SECRET:
        return {"error": ".env에 YOUTUBE_OAUTH_CLIENT, YOUTUBE_OAUTH_SECRET 설정 필요"}

    state = secrets.token_urlsafe(16)
    _pending_states.add(state)

    params = (
        f"client_id={settings.YOUTUBE_OAUTH_CLIENT}"
        f"&redirect_uri={settings.YOUTUBE_OAUTH_REDIRECT}"
        f"&response_type=code"
        f"&scope={_SCOPES}"
        f"&access_type=offline"
        f"&prompt=consent"
        f"&state={state}"
    )
    return RedirectResponse(f"{_GOOGLE_AUTH_URL}?{params}")


@router.get("/oauth/callback")
async def youtube_oauth_callback(code: str = Query(...), state: str = Query(...)):
    """Google에서 리디렉트되는 콜백. 코드 → 토큰 교환 후 파일에 저장."""
    if state not in _pending_states:
        return {"error": "잘못된 state — 인증을 다시 시도해주세요."}
    _pending_states.discard(state)

    async with httpx.AsyncClient() as client:
        resp = await client.post(_GOOGLE_TOKEN_URL, data={
            "code":          code,
            "client_id":     settings.YOUTUBE_OAUTH_CLIENT,
            "client_secret": settings.YOUTUBE_OAUTH_SECRET,
            "redirect_uri":  settings.YOUTUBE_OAUTH_REDIRECT,
            "grant_type":    "authorization_code",
        })
        resp.raise_for_status()
        token = resp.json()

    _save_token(token)
    return {
        "message": "YouTube 인증 완료. 이제 플레이리스트를 불러올 수 있습니다.",
        "token_saved": str(_TOKEN_FILE),
    }


@router.get("/oauth/status")
async def oauth_status():
    """토큰 저장 여부 + 실제 유효성 확인"""
    token = _load_token()
    if not token or not token.get("refresh_token"):
        return {"authenticated": False, "reason": "no_token"}
    try:
        await _refresh_if_needed(token)
        return {"authenticated": True}
    except OAuthExpiredError:
        return {"authenticated": False, "reason": "token_expired"}
    except Exception:
        # 네트워크 오류 등 — 토큰은 있지만 검증 불가
        return {"authenticated": True, "reason": "unverified"}


# ── 플레이리스트 관리 ───────────────────────────────────────────

@router.get("/playlists")
async def list_my_playlists():
    """내 YouTube 계정 플레이리스트 목록 (OAuth 필요)"""
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

    # 전체 플리 반환 — category는 참고용 (null이면 학습 무관)
    result = []
    for pl in all_pls:
        cat = _classify_video(pl["title"], pl.get("description", ""))
        result.append({**pl, "category": cat, "is_study": cat is not None})

    # 학습 관련 플리를 앞으로 정렬
    result.sort(key=lambda p: (0 if p["is_study"] else 1, p["title"]))
    return {"playlists": result, "total": len(result)}


_PLAYLIST_ID_RE = re.compile(r"(?:list=|/playlist/|youtu\.be/)([A-Za-z0-9_-]{10,})")
_VIDEO_ID_RE    = re.compile(r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})")


@router.get("/playlist-meta")
async def get_playlist_meta(id: str = Query(..., description="플레이리스트 ID 또는 URL")):
    """
    공개 플레이리스트 메타데이터 조회 (OAuth 불필요).
    id에 URL 전체를 넣어도 playlist ID 자동 추출.
    """
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
    """lectures 테이블에 이미 저장된 playlist_id 목록 반환 (프론트 '등록됨' 뱃지용)."""
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
    """
    좋아요 영상(기본) 또는 지정 플레이리스트 한 페이지(50개) → 학습 관련 채널 식별 → 채널별 플리 반환.
    source_playlist_id 지정 시 해당 플리 기준으로 탐색 (나중에 볼 영상 등).
    next_page_token이 있으면 더 보기 가능. OAuth 필요.
    """
    import asyncio

    try:
        access_token = await _get_access_token()
    except OAuthExpiredError:
        raise _auth_expired_error()
    if not access_token:
        raise _auth_error()

    crawler = YouTubeCrawler(api_key=settings.YOUTUBE_API_KEY)
    try:
        # 1. 영상 한 페이지 수집 (소스: 좋아요 or 지정 플리)
        if source_playlist_id:
            liked, next_page_token = await crawler.fetch_playlist_videos_page(
                source_playlist_id, access_token, page_token=page_token,
            )
        else:
            liked, next_page_token = await crawler.fetch_liked_videos_page(
                access_token, page_token=page_token,
            )

        # 2. 채널별 그룹화
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

        # 3. 채널별 플리 병렬 조회
        async def _fetch_study_playlists(ch: dict) -> dict | None:
            try:
                pls = await crawler.get_channel_playlists(ch["channel_id"], max_pages=1)
                study_pls = []
                for pl in pls:
                    cat = _classify_video(pl["title"], pl.get("description", ""))
                    if cat is not None:
                        study_pls.append({**pl, "category": cat})
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
    """
    영상 ID/URL 또는 채널 ID → 해당 채널의 공개 플레이리스트 목록 조회 (OAuth 불필요).
    video_id에 URL 전체 붙여도 video_id 자동 추출.
    """
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

    # 학습 카테고리가 감지된 플리만 반환
    filtered = []
    for pl in playlists:
        cat = _classify_video(pl["title"], pl.get("description", ""))
        if cat is not None:
            filtered.append({**pl, "category": cat})

    return {
        "channel_id":     cid,
        "channel_title":  channel_title,
        "playlist_count": len(filtered),
        "playlists":      filtered,
    }


@router.get("/preview/{playlist_id}")
async def preview_playlist(
    playlist_id: str,
    filter_ai: bool = True,
):
    """
    크롤링 전 미리보기 — 어떤 영상이 필터링되고 어떤 카테고리로 분류되는지 확인.
    filter_ai=false 로 호출하면 전체 영상 목록 반환.
    """
    try:
        access_token = await _get_access_token()
    except OAuthExpiredError:
        access_token = None  # 공개 플리는 token 없이도 동작
    crawler = YouTubeCrawler(api_key=settings.YOUTUBE_API_KEY)
    try:
        videos = await crawler.fetch_playlist_videos(
            playlist_id,
            filter_ai=filter_ai,
            access_token=access_token,
        )
    finally:
        await crawler.close()

    return {
        "playlist_id": playlist_id,
        "total":       len(videos),
        "videos": [
            {
                "title":    v.title,
                "category": v.category,
                "duration": v.duration_sec,
                "video_id": v.video_id,
            }
            for v in videos
        ],
    }


@router.post("/playlists/filter")
async def filter_playlists(playlist_ids: list[str]):
    """
    선택한 플레이리스트의 영상을 가져와서 학습 관련 영상만 필터링해 반환.
    저장은 하지 않음 — 미리보기 전용.
    body: ["PLxxxxxx", "PLyyyyyy"]
    """
    try:
        access_token = await _get_access_token()
    except OAuthExpiredError:
        access_token = None  # 공개 플리는 token 없이도 동작
    crawler = YouTubeCrawler(api_key=settings.YOUTUBE_API_KEY)

    results = []
    total_videos = 0

    try:
        for pid in playlist_ids:
            pl_meta = await crawler.get_playlist_meta(pid, access_token=access_token)
            videos  = await crawler.fetch_playlist_videos(
                pid, filter_ai=True, access_token=access_token,
            )
            total_videos += len(videos)
            results.append({
                "playlist_id":   pid,
                "playlist_title": pl_meta.get("title", pid),
                "total_filtered": len(videos),
                "videos": [
                    {
                        "video_id":     v.video_id,
                        "title":        v.title,
                        "category":     v.category,
                        "duration_sec": v.duration_sec,
                        "thumbnail_url": v.thumbnail_url,
                        "position":     v.position,
                    }
                    for v in videos
                ],
            })
    finally:
        await crawler.close()

    return {"total": total_videos, "playlists": results}


@router.post("/playlists/sync")
async def sync_playlists(playlist_ids: list[str]):
    """
    선택한 플레이리스트 전체 영상 → VideoInbox 저장 (필터 없음).
    학습 관련 선별은 매일 새벽 job_curate_lectures 또는 POST /inbox/curate 로 수행.
    body: ["PLxxxxxx", "PLyyyyyy"]
    """
    try:
        access_token = await _get_access_token()
    except OAuthExpiredError:
        access_token = None  # 공개 플리는 token 없이도 동작
    crawler = YouTubeCrawler(api_key=settings.YOUTUBE_API_KEY)
    result = {}
    total_fetched = 0
    try:
        for pid in playlist_ids:
            videos = await crawler.fetch_playlist_videos(
                pid,
                filter_ai=False,
                access_token=access_token,
            )
            saved = await _save_to_inbox(videos)
            total_fetched += len(videos)
            result[pid] = {"fetched": len(videos), "inbox": saved}
    finally:
        await crawler.close()

    # inbox에 쌓인 영상 즉시 큐레이션 (키워드 매칭 + 5분 이하 제외)
    promoted, discarded = await _promote_inbox_to_lectures()
    return {
        "result": result,
        "curated": {"promoted": promoted, "discarded": discarded},
    }


@router.post("/inbox/curate")
async def curate_inbox():
    """
    VideoInbox → 학습 관련 영상 Lecture 승격, 나머지 삭제.
    수동 트리거 또는 나중에 LLM 기반 큐레이션으로 교체할 때 진입점.
    일반 sync는 이미 내부적으로 즉시 큐레이션을 수행함.
    """
    promoted, discarded = await _promote_inbox_to_lectures()
    return {"promoted": promoted, "discarded": discarded}


@router.post("/inbox/classify-llm")
async def classify_inbox_with_llm(db: AsyncSession = Depends(get_db)):
    """GPT-4o-mini로 VideoInbox 영상을 분류 → 강좌 배정 + 난이도 설정 후 Lecture 승격.

    기존 키워드 기반 /inbox/curate 대신 사용.
    기존 강좌에 맞지 않으면 새 강좌 자동 생성.
    """
    from app.services.video_classifier import classify_and_promote
    result = await classify_and_promote(db)
    return result


@router.post("/playlists/rescan-llm")
async def rescan_known_playlists(db: AsyncSession = Depends(get_db)):
    """기존 Lecture에 등록된 플레이리스트를 전부 재스캔.

    이전에 키워드 필터로 걸러진 영상들을 LLM으로 다시 분류해서 누락 강의 추가.
    이미 DB에 있는 youtube_video_id는 스킵.
    """
    from app.services.video_classifier import classify_and_promote

    # 기존 Lecture에서 playlist_id 수집
    rows = (await db.execute(
        select(Lecture.playlist_id).where(Lecture.playlist_id.isnot(None)).distinct()
    )).scalars().all()
    playlist_ids = [r for r in rows if r]

    if not playlist_ids:
        return {"error": "등록된 플레이리스트가 없습니다."}

    # 이미 DB에 있는 video_id 목록
    existing_vids = set(
        (await db.execute(
            select(Lecture.youtube_video_id).where(Lecture.youtube_video_id.isnot(None))
        )).scalars().all()
    )

    try:
        access_token = await _get_access_token()
    except OAuthExpiredError:
        access_token = None  # 공개 플리는 token 없이도 동작
    crawler = YouTubeCrawler(api_key=settings.YOUTUBE_API_KEY)
    inbox_result = {}
    try:
        for pid in playlist_ids:
            videos = await crawler.fetch_playlist_videos(pid, filter_ai=False, access_token=access_token)
            # 이미 있는 영상 제외 후 inbox에 저장
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
    """
    좋아요(또는 지정 플리) → 채널 플리 탐색 → GPT-4o-mini가 학습 관련도 높은 플리 자동 선택 → VideoInbox 저장.
    """
    import asyncio

    try:
        access_token = await _get_access_token()
    except OAuthExpiredError:
        raise _auth_expired_error()
    if not access_token:
        raise _auth_error()

    # 1. discover와 동일 로직으로 채널 플리 수집
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
                result = []
                for pl in pls:
                    cat = _classify_video(pl["title"], pl.get("description", ""))
                    if cat is not None:
                        result.append({**pl, "category": cat, "channel_title": ch["channel_title"]})
                return result
            except Exception:
                return []

        raw = await asyncio.gather(*[_fetch_study_pls(ch) for ch in channel_map.values()])
        for pls in raw:
            all_playlists.extend(pls)
    finally:
        await crawler.close()

    if not all_playlists:
        return {"selected": 0, "message": "학습 관련 플레이리스트를 발견하지 못했습니다."}

    # 2. 이미 등록된 플리 제외
    existing_ids = set(
        (await db.execute(
            select(Lecture.playlist_id).where(Lecture.playlist_id.isnot(None)).distinct()
        )).scalars().all()
    )
    new_playlists = [p for p in all_playlists if p["playlist_id"] not in existing_ids]

    if not new_playlists:
        return {"selected": 0, "message": "이미 등록된 플레이리스트만 발견됐습니다."}

    # 3. GPT-4o-mini로 가치 있는 플리 선별
    gpt = openai.AsyncOpenAI(api_key=settings.CHATGPT_API_KEY)
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
        # fallback: video_count 기준 상위 선택
        sorted_pls = sorted(new_playlists, key=lambda p: p.get("video_count", 0), reverse=True)
        selected_ids = [p["playlist_id"] for p in sorted_pls[:max_playlists]]

    selected_pls = [p for p in new_playlists if p["playlist_id"] in selected_ids]

    if not selected_pls:
        return {"selected": 0, "message": "AI가 선택한 플레이리스트가 없습니다."}

    # 4. 선택된 플리 VideoInbox에 저장
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
        "selected": len(selected_pls),
        "selected_playlists": [
            {"title": p["title"], "playlist_id": p["playlist_id"], "category": p["category"]}
            for p in selected_pls
        ],
        "curated": {"promoted": promoted, "discarded": discarded},
    }


@router.post("/playlists/sync-llm")
async def sync_playlists_llm(playlist_ids: list[str], db: AsyncSession = Depends(get_db)):
    """플레이리스트 영상 → VideoInbox 저장 → GPT-4o-mini LLM 분류 → Lecture 승격.

    /playlists/sync (키워드 방식)의 LLM 대체 버전.
    강좌 자동 배정 + 난이도 판단 + 신규 강좌 생성까지 처리.
    """
    from app.services.video_classifier import classify_and_promote

    try:
        access_token = await _get_access_token()
    except OAuthExpiredError:
        access_token = None  # 공개 플리는 token 없이도 동작
    crawler = YouTubeCrawler(api_key=settings.YOUTUBE_API_KEY)
    inbox_result = {}
    try:
        for pid in playlist_ids:
            videos = await crawler.fetch_playlist_videos(pid, filter_ai=False, access_token=access_token)
            saved = await _save_to_inbox(videos)
            inbox_result[pid] = {"fetched": len(videos), "inbox": saved}
    finally:
        await crawler.close()

    classify_result = await classify_and_promote(db)
    return {
        "result": inbox_result,
        "llm": classify_result,
    }
