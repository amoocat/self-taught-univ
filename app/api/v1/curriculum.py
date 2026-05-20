from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.db.session import get_db
from app.models.models import Course, Lecture, LectureNote, Progress
from app.core.errors import NotFoundError, get_or_404

router = APIRouter()

_CATEGORY_CODE = {
    "math":  "MATH-101",
    "stat":  "STAT-201",
    "ml":    "ML-301",
    "dl":    "DL-401",
    "cv":    "CV-402",
    "nlp":   "NLP-403",
    "llm":   "LLM-501",
    "rl":    "RL-502",
    "data":  "DATA-601",
    "mlops": "OPS-602",
}


class LectureOut(BaseModel):
    id: str
    title: str
    subtitle: Optional[str] = None
    number: int
    category: Optional[str] = None
    tags: list[str] = []
    prerequisites: list[str] = []
    youtube_url: Optional[str]
    duration_sec: Optional[int]
    completed: bool = False

    class Config:
        from_attributes = True


class LectureDetailOut(BaseModel):
    id: str
    title: str
    subtitle: Optional[str] = None
    number: int
    category: Optional[str] = None
    tags: list[str] = []
    prerequisites: list[str] = []
    youtube_url: Optional[str]
    duration_sec: Optional[int]
    content: str = ""

    class Config:
        from_attributes = True


class CourseOut(BaseModel):
    id: str
    code: str = ""
    title: str
    source: str
    category: str
    order_index: int
    lecture_count: int = 0
    completed_count: int = 0
    progress_pct: float = 0.0
    status: str = "todo"

    class Config:
        from_attributes = True


@router.get("/", response_model=list[CourseOut])
async def list_courses(db: AsyncSession = Depends(get_db)):
    courses = (await db.execute(select(Course).order_by(Course.order_index))).scalars().all()

    result = []
    for c in courses:
        lec_count = (await db.execute(
            select(func.count()).where(Lecture.course_id == c.id)
        )).scalar() or 0

        done_count = (await db.execute(
            select(func.count()).where(Progress.course_id == c.id)
        )).scalar() or 0

        pct = round(done_count / lec_count * 100, 1) if lec_count > 0 else 0.0

        code = _CATEGORY_CODE.get(c.category.lower(), c.category.upper())
        status = "done" if pct >= 100 else ("active" if pct > 0 else "todo")
        result.append(CourseOut(
            id=c.id, code=code, title=c.title, source=c.source,
            category=c.category, order_index=c.order_index,
            lecture_count=lec_count, completed_count=done_count,
            progress_pct=pct, status=status,
        ))
    return result


@router.get("/{course_id}/lectures", response_model=list[LectureOut])
async def list_lectures(course_id: str, db: AsyncSession = Depends(get_db)):
    lectures = (await db.execute(
        select(Lecture).where(Lecture.course_id == course_id).order_by(Lecture.number)
    )).scalars().all()

    completed_ids = set(
        (await db.execute(
            select(Progress.lecture_id).where(Progress.course_id == course_id)
        )).scalars().all()
    )

    return [
        LectureOut(
            id=l.id, title=l.title, subtitle=l.subtitle, number=l.number,
            category=l.category, tags=l.tags or [], prerequisites=l.prerequisites or [],
            youtube_url=l.youtube_url, duration_sec=l.duration_sec,
            completed=l.id in completed_ids,
        )
        for l in lectures
    ]


@router.post("/{course_id}/lectures/{lecture_id}/complete", status_code=201)
async def mark_complete(course_id: str, lecture_id: str, db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(
        select(Progress).where(
            Progress.course_id == course_id,
            Progress.lecture_id == lecture_id,
        )
    )).scalar_one_or_none()

    if not existing:
        db.add(Progress(course_id=course_id, lecture_id=lecture_id))
        await db.commit()

    return {"ok": True}


@router.get("/lectures/{lecture_id}", response_model=LectureDetailOut)
async def get_lecture_detail(lecture_id: str, db: AsyncSession = Depends(get_db)):
    lecture = await get_or_404(db, Lecture, lecture_id, "Lecture")

    note = (await db.execute(
        select(LectureNote).where(LectureNote.lecture_id == lecture_id)
    )).scalar_one_or_none()

    return LectureDetailOut(
        id=lecture.id,
        title=lecture.title,
        subtitle=lecture.subtitle,
        number=lecture.number,
        category=lecture.category,
        tags=lecture.tags or [],
        prerequisites=lecture.prerequisites or [],
        youtube_url=lecture.youtube_url,
        duration_sec=lecture.duration_sec,
        content=note.content_md if note else "",
    )
