import asyncio
import pytest
import requests as _requests
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool

# NullPool: 연결을 재사용하지 않아 이벤트 루프 바인딩 문제 없음
_test_engine = create_async_engine(
    "postgresql+asyncpg://stu:stu@db:5432/stu",
    poolclass=NullPool,
    echo=False,
)
_TestSession = async_sessionmaker(_test_engine, expire_on_commit=False)


@pytest.fixture
async def db() -> AsyncSession:
    """직접 DB 조작용 비동기 세션"""
    async with _TestSession() as session:
        yield session


@pytest.fixture
def client():
    """라이브 서버에 동기 HTTP 요청을 보내는 클라이언트"""
    base = "http://localhost:8000"

    class _Client:
        def get(self, path, **kw):
            return _requests.get(f"{base}{path}", **kw)

        def post(self, path, **kw):
            return _requests.post(f"{base}{path}", **kw)

        def put(self, path, **kw):
            return _requests.put(f"{base}{path}", **kw)

        def delete(self, path, **kw):
            return _requests.delete(f"{base}{path}", **kw)

    return _Client()
