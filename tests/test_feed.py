import pytest
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import FeedItem


@pytest.fixture
async def feed_items(db: AsyncSession):
    items = [
        FeedItem(
            source_name="Google AI Blog",
            source_type="bigtech",
            title="Attention Mechanisms in Transformers",
            url="https://blog.google/test-attn-001",
            summary="Deep dive into attention",
            tags=["ML", "Transformer"],
            published_at=datetime(2024, 3, 15),
        ),
        FeedItem(
            source_name="카카오 Tech",
            source_type="korean",
            title="추천 시스템 딥러닝 적용기",
            url="https://tech.kakao.com/test-rec-001",
            summary="카카오 추천 시스템 개선",
            tags=["딥러닝", "추천"],
            published_at=datetime(2024, 3, 10),
        ),
        FeedItem(
            source_name="Andrej Karpathy",
            source_type="personal",
            title="Let's build GPT from scratch",
            url="https://karpathy.ai/test-gpt-001",
            summary="Building GPT step by step",
            tags=["GPT", "LLM"],
        ),
    ]
    for item in items:
        db.add(item)
    await db.commit()
    for item in items:
        await db.refresh(item)
    yield items
    for item in items:
        await db.delete(item)
    await db.commit()


async def test_list_feed(client):
    res = client.get("/api/v1/feed/")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


async def test_list_feed_with_items(client, feed_items: list):
    res = client.get("/api/v1/feed/")
    assert res.status_code == 200
    ids = {item["id"] for item in res.json()}
    for item in feed_items:
        assert item.id in ids


async def test_feed_response_schema(client, feed_items: list):
    res = client.get("/api/v1/feed/")
    assert res.status_code == 200
    item = next(i for i in res.json() if i["id"] == feed_items[0].id)

    required_fields = {"id", "source", "badge", "date", "title", "url", "summary", "keywords", "courses", "related_paper", "color"}
    assert required_fields.issubset(item.keys())
    assert isinstance(item["keywords"], list)
    assert isinstance(item["courses"], list)
    assert item["related_paper"] is None


async def test_feed_badge_mapping(client, feed_items: list):
    res = client.get("/api/v1/feed/")
    by_id = {i["id"]: i for i in res.json()}

    assert by_id[feed_items[0].id]["badge"] == "badge-bigtech"
    assert by_id[feed_items[1].id]["badge"] == "badge-korean"
    assert by_id[feed_items[2].id]["badge"] == "badge-personal"


async def test_feed_color_mapping(client, feed_items: list):
    res = client.get("/api/v1/feed/")
    by_id = {i["id"]: i for i in res.json()}
    assert by_id[feed_items[1].id]["color"] == "#2a5a2a"   # korean


async def test_feed_source_filter(client, feed_items: list):
    res = client.get("/api/v1/feed/", params={"source_type": "bigtech"})
    assert res.status_code == 200
    ids = [i["id"] for i in res.json()]
    assert feed_items[0].id in ids
    assert feed_items[1].id not in ids   # korean — 필터되어야 함


async def test_feed_limit(client, feed_items: list):
    res = client.get("/api/v1/feed/", params={"limit": 2})
    assert res.status_code == 200
    assert len(res.json()) <= 2


async def test_feed_date_format(client, feed_items: list):
    res = client.get("/api/v1/feed/")
    by_id = {i["id"]: i for i in res.json()}

    assert by_id[feed_items[0].id]["date"] == "2024.03.15"

    # published_at 없는 항목은 빈 문자열
    assert by_id[feed_items[2].id]["date"] == ""
