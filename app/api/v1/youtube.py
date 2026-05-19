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
import secrets
from pathlib import Path

import httpx
from fastapi import APIRouter, Query
from fastapi.responses import RedirectResponse

from app.core.config import settings
from app.crawlers.youtube import YouTubeCrawler
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
