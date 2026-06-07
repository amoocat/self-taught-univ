"""
YouTube API 라우터 facade.

실제 구현은 두 모듈로 분리되어 있음:
  - youtube_oauth.py     : OAuth 토큰 관리 + 인증 엔드포인트
  - youtube_playlists.py : 플레이리스트 관리 + 동기화 엔드포인트

외부 import 호환성 유지:
  - app.crawlers.scheduler 가 _get_access_token, OAuthExpiredError 를 직접 임포트함
"""
from fastapi import APIRouter

from app.api.v1.youtube_oauth import router as _oauth_router
from app.api.v1.youtube_playlists import router as _playlists_router

# scheduler.py 호환성 — `from app.api.v1.youtube import _get_access_token, OAuthExpiredError`
from app.api.v1.youtube_oauth import _get_access_token, OAuthExpiredError  # noqa: F401

router = APIRouter()
router.include_router(_oauth_router)
router.include_router(_playlists_router)
