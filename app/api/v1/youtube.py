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
import re
import secrets
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse

from app.core.config import settings
from app.crawlers.youtube import YouTubeCrawler, _classify_video
from app.crawlers.scheduler import _save_lectures

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


async def _refresh_if_needed(token: dict) -> str:
    """access_token 만료 시 refresh_token으로 재발급"""
    async with httpx.AsyncClient() as client:
        resp = await client.post(_GOOGLE_TOKEN_URL, data={
            "client_id":     settings.YOUTUBE_OAUTH_CLIENT,
            "client_secret": settings.YOUTUBE_OAUTH_SECRET,
            "refresh_token": token["refresh_token"],
            "grant_type":    "refresh_token",
        })
        resp.raise_for_status()
        new = resp.json()
        token["access_token"] = new["access_token"]
        _save_token(token)
    return token["access_token"]


async def _get_access_token() -> str | None:
    token = _load_token()
    if not token:
        return None
    try:
        return await _refresh_if_needed(token)
    except Exception:
        return token.get("access_token")


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
    """토큰 저장 여부 확인"""
    token = _load_token()
    return {"authenticated": bool(token and token.get("refresh_token"))}


# ── 플레이리스트 관리 ───────────────────────────────────────────

@router.get("/playlists")
async def list_my_playlists():
    """내 YouTube 계정 플레이리스트 목록 (OAuth 필요)"""
    access_token = await _get_access_token()
    if not access_token:
        return {"error": "YouTube 인증 필요 — GET /api/v1/youtube/oauth 로 인증해주세요."}

    crawler = YouTubeCrawler(api_key=settings.YOUTUBE_API_KEY)
    try:
        playlists = await crawler.fetch_user_playlists(access_token)
    finally:
        await crawler.close()

    return {"playlists": playlists}


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


@router.get("/discover")
async def discover_study_channels():
    """
    내 좋아요 영상 → 학습 관련 채널 식별 → 채널별 학습 관련 플리 목록 반환.
    OAuth 필요. 상위 10개 채널만 조회 (API 할당량 절약).
    """
    import asyncio

    access_token = await _get_access_token()
    if not access_token:
        raise HTTPException(
            status_code=401,
            detail="YouTube 인증 필요 — GET /api/v1/youtube/oauth 로 인증해주세요.",
        )

    crawler = YouTubeCrawler(api_key=settings.YOUTUBE_API_KEY)
    try:
        # 1. 좋아요 영상에서 학습 관련 영상만 수집
        liked = await crawler.fetch_liked_videos(access_token, max_results=200)

        # 2. 채널별 그룹화 (좋아요 영상 수 + 카테고리 집계)
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

        # 3. 좋아요 영상 많은 순 상위 10개 채널 플리 병렬 조회
        top_channels = sorted(
            channel_map.values(), key=lambda x: x["video_count"], reverse=True
        )[:10]

        async def _fetch_study_playlists(ch: dict) -> dict | None:
            try:
                pls = await crawler.get_channel_playlists(ch["channel_id"])
                study_pls = [
                    pl for pl in pls
                    if _classify_video(pl["title"], pl.get("description", "")) is not None
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

        raw = await asyncio.gather(*[_fetch_study_playlists(ch) for ch in top_channels])
        results = [r for r in raw if r is not None]

    finally:
        await crawler.close()

    return {
        "total_study_videos": len(liked),
        "channel_count":      len(results),
        "channels":           results,
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

    return {
        "channel_id":     cid,
        "channel_title":  channel_title,
        "playlist_count": len(playlists),
        "playlists":      playlists,
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
    access_token = await _get_access_token()
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
    access_token = await _get_access_token()
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
    선택한 플레이리스트 크롤링 → DB 저장.
    body: ["PLxxxxxx", "PLyyyyyy"]
    """
    access_token = await _get_access_token()
    crawler = YouTubeCrawler(api_key=settings.YOUTUBE_API_KEY)
    result = {}
    try:
        for pid in playlist_ids:
            videos = await crawler.fetch_playlist_videos(
                pid,
                filter_ai=True,
                access_token=access_token,
            )
            saved = await _save_lectures(videos)
            result[pid] = {"fetched": len(videos), "saved": saved}
    finally:
        await crawler.close()

    return {"result": result}
