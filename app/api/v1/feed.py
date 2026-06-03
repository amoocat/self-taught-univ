from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from datetime import datetime
from pydantic import BaseModel

from app.db.session import get_db
from app.models.models import FeedItem

router = APIRouter()


class FeedItemOut(BaseModel):
    id: str
    title: str
    url: str
    source: str
    source_type: str = ""
    badge: str = ""
    date: str = ""
    summary: str = ""
    keywords: list[str] = []
    category: str = "etc"
    color: str = ""
    courses: list = []
    related_paper: Optional[str] = None

_BADGE = {
    "personal": "badge-personal",
    "bigtech": "badge-bigtech",
    "korean": "badge-korean",
    "arxiv": "badge-bigtech",
    "blog": "badge-personal",
    "youtube": "badge-bigtech",
}

_COLOR = {
    "personal": "#8b1a1a",
    "bigtech": "#0a1628",
    "korean": "#2a5a2a",
    "arxiv": "#0a1628",
    "blog": "#8b1a1a",
    "youtube": "#884400",
}


def _badge(source_type: str) -> str:
    return _BADGE.get(source_type.lower(), "badge-bigtech")


def _color(source_type: str) -> str:
    return _COLOR.get(source_type.lower(), "#0a1628")


def _fmt_date(dt: Optional[datetime]) -> str:
    return dt.strftime("%Y.%m.%d") if dt else ""


def _to_out(item: FeedItem) -> dict:
    tags = item.tags if isinstance(item.tags, list) else []
    return {
        "id": item.id,
        "source": item.source_name,
        "source_type": item.source_type or "",
        "badge": _badge(item.source_type),
        "date": _fmt_date(item.published_at),
        "title": item.title,
        "url": item.url,
        "summary": item.summary or "",
        "keywords": tags,
        "category": item.category or "etc",
        "courses": [],
        "related_paper": None,
        "color": _color(item.source_type),
    }


@router.get("/", response_model=list[FeedItemOut])
async def list_feed(
    source_type: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(FeedItem)
        .order_by(FeedItem.fetched_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if source_type:
        stmt = stmt.where(FeedItem.source_type == source_type)

    items = (await db.execute(stmt)).scalars().all()
    return [_to_out(item) for item in items]
