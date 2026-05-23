import json
import logging
import openai
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.core.config import settings
from app.db.session import get_db
from app.models.models import Course, Lecture, LectureNote, Progress
from app.core.errors import NotFoundError, get_or_404

logger = logging.getLogger(__name__)

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
    "mlops":   "OPS-602",
    "actuary": "ACT-701",
    "ie":      "IE-702",
}


class LectureOut(BaseModel):
    id: str
    title: str
    subtitle: Optional[str] = None
    number: int
    category: Optional[str] = None
    tags: list[str] = []
    prerequisites: list[str] = []
    youtube_url: Optional[str] = None
    youtube_video_id: Optional[str] = None
    thumbnail_url: Optional[str] = None
    is_available: bool = True
    duration_sec: Optional[int] = None
    difficulty: Optional[int] = None
    module_name: Optional[str] = None
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
    youtube_url: Optional[str] = None
    youtube_video_id: Optional[str] = None
    thumbnail_url: Optional[str] = None
    is_available: bool = True
    duration_sec: Optional[int] = None
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
    description: Optional[str] = None
    objectives: list[str] = []
    lecture_count: int = 0
    completed_count: int = 0
    progress_pct: float = 0.0
    status: str = "todo"

    class Config:
        from_attributes = True


class CourseUpdateIn(BaseModel):
    description: Optional[str] = None
    objectives: Optional[list[str]] = None


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
            description=c.description, objectives=c.objectives or [],
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
            youtube_url=l.youtube_url, youtube_video_id=l.youtube_video_id,
            thumbnail_url=l.thumbnail_url, is_available=l.is_available,
            duration_sec=l.duration_sec, difficulty=l.difficulty,
            module_name=l.module_name, completed=l.id in completed_ids,
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
        youtube_video_id=lecture.youtube_video_id,
        thumbnail_url=lecture.thumbnail_url,
        is_available=lecture.is_available,
        duration_sec=lecture.duration_sec,
        content=note.content_md if note else "",
    )


@router.patch("/{course_id}", status_code=200)
async def update_course(course_id: str, body: CourseUpdateIn, db: AsyncSession = Depends(get_db)):
    course = await get_or_404(db, Course, course_id, "Course")
    if body.description is not None:
        course.description = body.description
    if body.objectives is not None:
        course.objectives = body.objectives
    await db.commit()
    return {"ok": True}


@router.delete("/lectures/{lecture_id}", status_code=200)
async def delete_lecture(lecture_id: str, db: AsyncSession = Depends(get_db)):
    lecture = await get_or_404(db, Lecture, lecture_id, "Lecture")
    await db.delete(lecture)
    await db.commit()
    return {"ok": True, "deleted": lecture_id}


@router.post("/backfill-metadata", status_code=200)
async def backfill_metadata(reset: bool = False, db: AsyncSession = Depends(get_db)):
    """GPT-4o-mini로 전체 강의에 difficulty(1~3) + module_name 일괄 배정.

    reset=true: 기존 값 무시하고 전체 재배정.
    각 과목별로 배치 처리 — 같은 과목 강의끼리 묶어야 모듈명이 일관성 있음.
    """
    if reset:
        courses_q = (await db.execute(select(Lecture.course_id).distinct())).scalars().all()
    else:
        courses_q = (
            await db.execute(
                select(Lecture.course_id).where(Lecture.module_name.is_(None)).distinct()
            )
        ).scalars().all()

    if not courses_q:
        return {"updated": 0, "message": "모든 강의에 메타데이터가 이미 배정되어 있습니다."}

    # course 이름 조회
    courses = {
        c.id: c for c in (await db.execute(select(Course))).scalars().all()
    }

    gpt = openai.AsyncOpenAI(api_key=settings.CHATGPT_API_KEY)
    updated = 0

    for course_id in courses_q:
        course = courses.get(course_id)
        if reset:
            lectures = (await db.execute(
                select(Lecture).where(Lecture.course_id == course_id).order_by(Lecture.number)
            )).scalars().all()
        else:
            lectures = (await db.execute(
                select(Lecture).where(
                    Lecture.course_id == course_id,
                    Lecture.module_name.is_(None),
                ).order_by(Lecture.number)
            )).scalars().all()

        if not lectures:
            continue

        course_name = course.title if course else "Unknown"
        payload = [{"id": l.id, "title": l.title} for l in lectures]

        prompt = (
            f"You are organizing lectures for the '{course_name}' course in an AI/ML curriculum.\n\n"
            "For each lecture, assign:\n"
            '1. "module_name": a short topic group name in Korean (2-6 chars, e.g. "선형대수 기초", "경사하강법", "트랜스포머")\n'
            "   - Group related lectures under the SAME module_name\n"
            "   - Aim for 3-7 distinct modules total for this course\n"
            '2. "difficulty": 1 (beginner/intro), 2 (intermediate), 3 (advanced/research)\n\n'
            "Lectures:\n"
            + json.dumps(payload, ensure_ascii=False)
            + '\n\nReturn JSON: {"results": [{"id": "...", "module_name": "...", "difficulty": 2}]}'
        )

        try:
            resp = await gpt.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
            )
            raw = json.loads(resp.choices[0].message.content)
            results = raw.get("results", [])
            id_map = {r["id"]: r for r in results}
            for lec in lectures:
                r = id_map.get(lec.id, {})
                lec.module_name = r.get("module_name") or lec.module_name or "기타"
                lec.difficulty  = r.get("difficulty") or lec.difficulty or 2
                updated += 1
        except Exception as e:
            logger.error("backfill_metadata course %s error: %s", course_id, e)
            for lec in lectures:
                lec.module_name = lec.module_name or "기타"
                lec.difficulty  = lec.difficulty or 2
            updated += len(lectures)

    await db.commit()
    return {"updated": updated}
