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
from app.core.errors import get_or_404

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
    meta_source: Optional[str] = None
    completed: bool = False

    class Config:
        from_attributes = True


class HeatmapDay(BaseModel):
    date: str
    count: int

class HeatmapOut(BaseModel):
    heatmap: list[HeatmapDay]

class RecentActivity(BaseModel):
    lecture_title: str
    course_title: str
    completed_at: str
    duration_sec: int

class StatsOut(BaseModel):
    streak: int
    longest_streak: int
    total_lectures: int
    total_minutes: int
    this_week: int
    today: int
    recent: list[RecentActivity]

class OkOut(BaseModel):
    ok: bool = True

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
async def list_courses(
    q: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Course).order_by(Course.order_index)
    if q:
        stmt = stmt.where(Course.title.ilike(f"%{q}%"))
    if category:
        stmt = stmt.where(Course.category.ilike(category))
    stmt = stmt.offset(offset).limit(limit)
    courses = (await db.execute(stmt)).scalars().all()

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


@router.get("/heatmap", response_model=HeatmapOut)
async def get_heatmap(db: AsyncSession = Depends(get_db)):
    """최근 365일간 날짜별 완료 강의 수를 반환합니다."""
    from datetime import timedelta
    from sqlalchemy import cast, Date
    cutoff = datetime.utcnow() - timedelta(days=365)
    rows = (await db.execute(
        select(cast(Progress.completed_at, Date).label("day"), func.count().label("count"))
        .where(Progress.completed_at >= cutoff)
        .group_by(cast(Progress.completed_at, Date))
        .order_by(cast(Progress.completed_at, Date))
    )).all()
    return {"heatmap": [{"date": str(r.day), "count": r.count} for r in rows]}


@router.get("/stats", response_model=StatsOut)
async def get_stats(db: AsyncSession = Depends(get_db)):
    """연속 학습일·총 완료·학습 시간·이번 주·최근 활동 등 스터디 통계를 반환합니다."""
    from datetime import timedelta, date
    from sqlalchemy import cast, Date

    # 완료 기록 전체 (최신순)
    rows = (await db.execute(
        select(Progress.completed_at, Progress.lecture_id, Progress.course_id)
        .order_by(Progress.completed_at.desc())
    )).all()

    total_lectures = len(rows)

    # 날짜별 집합
    day_set: set[date] = {r.completed_at.date() for r in rows}
    today = datetime.utcnow().date()

    # 연속 학습일 (오늘 or 어제부터)
    streak = 0
    check = today if today in day_set else today - timedelta(days=1)
    while check in day_set:
        streak += 1
        check -= timedelta(days=1)

    # 최장 연속 학습일
    sorted_days = sorted(day_set)
    longest = cur = 0
    for i, d in enumerate(sorted_days):
        if i == 0 or d - sorted_days[i-1] == timedelta(days=1):
            cur += 1
        else:
            cur = 1
        longest = max(longest, cur)

    # 이번 주 (월요일 기준)
    week_start = today - timedelta(days=today.weekday())
    this_week = sum(1 for r in rows if r.completed_at.date() >= week_start)

    # 오늘
    today_count = sum(1 for r in rows if r.completed_at.date() == today)

    # 총 학습 시간 (완료 강의의 duration_sec 합산)
    lecture_ids = [r.lecture_id for r in rows]
    total_sec = 0
    if lecture_ids:
        dur_rows = (await db.execute(
            select(func.sum(Lecture.duration_sec)).where(Lecture.id.in_(lecture_ids))
        )).scalar() or 0
        total_sec = int(dur_rows)

    # 최근 활동 5개
    recent = []
    for r in rows[:5]:
        lec = await db.get(Lecture, r.lecture_id)
        course = await db.get(Course, r.course_id)
        if lec:
            recent.append({
                "lecture_title": lec.title,
                "course_title": course.title if course else "",
                "completed_at": r.completed_at.isoformat(),
                "duration_sec": lec.duration_sec or 0,
            })

    return {
        "streak": streak,
        "longest_streak": longest,
        "total_lectures": total_lectures,
        "total_minutes": total_sec // 60,
        "this_week": this_week,
        "today": today_count,
        "recent": recent,
    }


@router.get("/{course_id}", response_model=CourseOut)
async def get_course(course_id: str, db: AsyncSession = Depends(get_db)):
    course = await get_or_404(db, Course, course_id, "Course")

    lec_count = (await db.execute(
        select(func.count()).where(Lecture.course_id == course.id)
    )).scalar() or 0

    done_count = (await db.execute(
        select(func.count()).where(Progress.course_id == course.id)
    )).scalar() or 0

    pct = round(done_count / lec_count * 100, 1) if lec_count > 0 else 0.0
    code = _CATEGORY_CODE.get(course.category.lower(), course.category.upper())
    status = "done" if pct >= 100 else ("active" if pct > 0 else "todo")

    return CourseOut(
        id=course.id, code=code, title=course.title, source=course.source,
        category=course.category, order_index=course.order_index,
        description=course.description, objectives=course.objectives or [],
        lecture_count=lec_count, completed_count=done_count,
        progress_pct=pct, status=status,
    )


@router.get("/{course_id}/lectures", response_model=list[LectureOut])
async def list_lectures(
    course_id: str,
    q: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Lecture).where(Lecture.course_id == course_id).order_by(Lecture.number)
    if q:
        stmt = stmt.where(Lecture.title.ilike(f"%{q}%") | Lecture.subtitle.ilike(f"%{q}%"))
    stmt = stmt.offset(offset).limit(limit)
    lectures = (await db.execute(stmt)).scalars().all()

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
            module_name=l.module_name, meta_source=l.meta_source,
            completed=l.id in completed_ids,
        )
        for l in lectures
    ]


@router.post("/{course_id}/lectures/{lecture_id}/complete", status_code=201, response_model=OkOut)
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


class CourseReorderItem(BaseModel):
    id: str
    order_index: int


@router.put("/reorder", status_code=200)
async def reorder_courses(items: list[CourseReorderItem], db: AsyncSession = Depends(get_db)):
    for item in items:
        course = (await db.execute(select(Course).where(Course.id == item.id))).scalar_one_or_none()
        if course:
            course.order_index = item.order_index
    await db.commit()
    return {"ok": True, "updated": len(items)}


@router.patch("/{course_id}", status_code=200)
async def update_course(course_id: str, body: CourseUpdateIn, db: AsyncSession = Depends(get_db)):
    course = await get_or_404(db, Course, course_id, "Course")
    if body.description is not None:
        course.description = body.description
    if body.objectives is not None:
        course.objectives = body.objectives
    await db.commit()
    return {"ok": True}


class LectureMetaPatch(BaseModel):
    id: str
    module_name: Optional[str] = None
    difficulty: Optional[int] = None
    meta_source: Optional[str] = None
    number: Optional[int] = None


@router.patch("/lectures/batch-meta", status_code=200)
async def batch_update_lecture_meta(
    items: list[LectureMetaPatch],
    source: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """강의 module_name / difficulty / meta_source 일괄 업데이트.

    source 쿼리 파라미터로 meta_source를 일괄 지정 가능 (예: ?source=manual).
    각 item에 meta_source 필드가 있으면 item별 값 우선.
    """
    ids = [i.id for i in items]
    lectures = (await db.execute(select(Lecture).where(Lecture.id.in_(ids)))).scalars().all()
    lec_map = {l.id: l for l in lectures}
    for item in items:
        lec = lec_map.get(item.id)
        if not lec:
            continue
        if item.module_name is not None:
            lec.module_name = item.module_name
        if item.difficulty is not None:
            lec.difficulty = item.difficulty
        if item.number is not None:
            lec.number = item.number
        effective_source = item.meta_source if item.meta_source is not None else source
        if effective_source is not None:
            lec.meta_source = effective_source
    await db.commit()
    return {"updated": len(lectures)}


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
                lec.meta_source = "llm"
                updated += 1
        except Exception as e:
            logger.error("backfill_metadata course %s error: %s", course_id, e)
            for lec in lectures:
                lec.module_name = lec.module_name or "기타"
                lec.difficulty  = lec.difficulty or 2
                lec.meta_source = lec.meta_source or "llm"
            updated += len(lectures)

    await db.commit()
    return {"updated": updated}


@router.post("/reorganize", status_code=200)
async def reorganize_curriculum(
    course_ids: list[str] | None = None,
    db: AsyncSession = Depends(get_db),
):
    """강좌 내 강의를 (module_name → difficulty → published_at) 순으로 재정렬 후 번호 재부여.

    - course_ids 미전달: 전체 강좌 재정렬
    - course_ids 전달: 지정 강좌만 재정렬

    신규 영상 추가 후 자동으로도 호출되지만, 수동으로도 언제든지 실행 가능.
    """
    from app.services.curriculum_organizer import reorganize_courses, reorganize_all_courses

    if course_ids:
        result = await reorganize_courses(db, course_ids)
    else:
        result = await reorganize_all_courses(db)

    return result
