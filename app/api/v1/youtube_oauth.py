"""
YouTube OAuth 토큰 관리 + 인증 엔드포인트.

흐름:
  1. GET /youtube/oauth          → Google OAuth URL로 리디렉트
  2. GET /youtube/oauth/callback → 코드 → 토큰 교환 후 파일 저장
  3. GET /youtube/oauth/status   → 토큰 유효성 확인
"""
import json
import logging
import secrets
from pathlib import Path

import httpx
from fastapi import APIRouter
from fastapi.responses import RedirectResponse

from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

_TOKEN_FILE = Path("oauth_tokens/youtube.json")
_GOOGLE_AUTH_URL  = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_SCOPES = "https://www.googleapis.com/auth/youtube.readonly"

# CSRF 방지용 임시 state 저장 (단일 사용자 앱이라 메모리로 충분)
_pending_states: set[str] = set()


# ── 토큰 파일 헬퍼 ──────────────────────────────────────────────

def _load_token() -> dict | None:
    if _TOKEN_FILE.exists():
        return json.loads(_TOKEN_FILE.read_text())
    return None


def _save_token(data: dict):
    _TOKEN_FILE.parent.mkdir(exist_ok=True)
    _TOKEN_FILE.write_text(json.dumps(data, indent=2))


# ── 예외 / 에러 헬퍼 ────────────────────────────────────────────

class OAuthExpiredError(Exception):
    """refresh_token이 폐기/만료된 경우 — 재인증 필요"""
    pass


from fastapi import HTTPException  # noqa: E402 (circular-safe here)


def _auth_error() -> HTTPException:
    return HTTPException(
        status_code=401,
        detail={
            "code": "YOUTUBE_AUTH_REQUIRED",
            "message": "YouTube 인증이 필요합니다.",
            "auth_url": "/api/v1/youtube/oauth",
        },
    )


def _auth_expired_error() -> HTTPException:
    return HTTPException(
        status_code=401,
        detail={
            "code": "YOUTUBE_AUTH_EXPIRED",
            "message": "YouTube 인증이 만료됐습니다. 재인증이 필요합니다.",
            "auth_url": "/api/v1/youtube/oauth",
        },
    )


# ── 토큰 갱신 / 조회 ────────────────────────────────────────────

async def _refresh_if_needed(token: dict) -> str:
    """access_token 만료 시 refresh_token으로 재발급.
    invalid_grant(토큰 폐기) 시 파일 삭제 후 OAuthExpiredError 발생.
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


# ── OAuth 엔드포인트 ─────────────────────────────────────────────

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
async def youtube_oauth_callback(
    code: str,
    state: str,
):
    """Google에서 리디렉트되는 콜백. 코드 → 토큰 교환 후 파일에 저장."""
    from fastapi import Query  # noqa: F401
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
        return {"authenticated": True, "reason": "unverified"}
