import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Paper


@pytest.fixture
async def paper(db: AsyncSession):
    """DB에 직접 논문 삽입 — 테스트 후 삭제"""
    p = Paper(
        title="Attention Is All You Need",
        authors="Vaswani et al.",
        year=2017,
        venue="NeurIPS",
        abstract="The dominant sequence transduction models are based on complex recurrent...",
        arxiv_id="test-1706.03762",
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    yield p
    await db.delete(p)
    await db.commit()


async def test_list_papers(client):
    res = client.get("/api/v1/papers/")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


async def test_list_papers_with_fixture(client, paper: Paper):
    res = client.get("/api/v1/papers/")
    assert res.status_code == 200
    ids = [p["id"] for p in res.json()]
    assert paper.id in ids


async def test_get_paper(client, paper: Paper):
    res = client.get(f"/api/v1/papers/{paper.id}")
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == paper.id
    assert body["title"] == paper.title
    assert body["year"] == paper.year
    assert body["authors"] == paper.authors


async def test_search_papers(client, paper: Paper):
    # 제목으로 검색
    res = client.get("/api/v1/papers/", params={"q": "Attention"})
    assert res.status_code == 200
    assert any(p["id"] == paper.id for p in res.json())

    # 저자로 검색
    res = client.get("/api/v1/papers/", params={"q": "Vaswani"})
    assert res.status_code == 200
    assert any(p["id"] == paper.id for p in res.json())

    # 매칭 안 되는 검색어
    res = client.get("/api/v1/papers/", params={"q": "절대없는제목xyz"})
    assert res.status_code == 200
    assert not any(p["id"] == paper.id for p in res.json())


async def test_get_paper_not_found(client):
    res = client.get("/api/v1/papers/00000000-0000-0000-0000-000000000000")
    assert res.status_code == 404
    body = res.json()
    assert body["error"] == "NOT_FOUND"
    assert "detail" in body


async def test_get_paper_invalid_uuid(client):
    res = client.get("/api/v1/papers/not-a-uuid")
    assert res.status_code == 404
    assert res.json()["error"] == "NOT_FOUND"


async def test_paper_response_schema(client, paper: Paper):
    res = client.get(f"/api/v1/papers/{paper.id}")
    body = res.json()
    required_fields = {"id", "title", "authors", "year", "created_at"}
    assert required_fields.issubset(body.keys())
