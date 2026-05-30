import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool

from app.main import app

_DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://stu:stu@db:5432/stu")

# NullPool: 연결을 재사용하지 않아 이벤트 루프 바인딩 문제 없음
_test_engine = create_async_engine(_DATABASE_URL, poolclass=NullPool, echo=False)
_TestSession = async_sessionmaker(_test_engine, expire_on_commit=False)


@pytest.fixture
async def db() -> AsyncSession:
    async with _TestSession() as session:
        yield session


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c
