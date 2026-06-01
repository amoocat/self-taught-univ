from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.db.session import get_db
from app.models.models import Lecture, MyNote, Paper

router = APIRouter()


@router.get("/")
async def search(
    q: str,
    type: Optional[str] = None,  # "lecture" | "note" | "paper" | None(전체)
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """강의·노트·논문 통합 검색. ?q=키워드&type=lecture|note|paper"""
    pattern = f"%{q}%"
    results: list[dict] = []

    if type in (None, "lecture"):
        rows = (await db.execute(
            select(Lecture)
            .where(Lecture.title.ilike(pattern) | Lecture.subtitle.ilike(pattern))
            .limit(limit)
        )).scalars().all()
        for r in rows:
            results.append({
                "type": "lecture",
                "id": r.id,
                "title": r.title,
                "subtitle": r.subtitle,
                "category": r.category,
                "course_id": r.course_id,
            })

    if type in (None, "note"):
        rows = (await db.execute(
            select(MyNote)
            .where(MyNote.title.ilike(pattern) | MyNote.content_md.ilike(pattern))
            .order_by(MyNote.updated_at.desc())
            .limit(limit)
        )).scalars().all()
        for r in rows:
            results.append({
                "type": "note",
                "id": r.id,
                "title": r.title,
                "preview": (r.content_md or "")[:120],
            })

    if type in (None, "paper"):
        rows = (await db.execute(
            select(Paper)
            .where(Paper.title.ilike(pattern) | Paper.abstract.ilike(pattern))
            .limit(limit)
        )).scalars().all()
        for r in rows:
            results.append({
                "type": "paper",
                "id": r.id,
                "title": r.title,
                "authors": r.authors or [],
                "arxiv_id": r.arxiv_id,
            })

    return {"q": q, "total": len(results), "results": results}
