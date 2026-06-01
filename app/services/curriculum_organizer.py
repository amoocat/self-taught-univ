"""
커리큘럼 자동 재구성 서비스

신규 영상이 강좌에 추가된 후 호출됨:
  1. 강좌 내 강의를 (module_name → difficulty → published_at) 순으로 재정렬
  2. 1부터 number 재부여

정렬 기준 설명:
  - module_name : 같은 모듈끼리 묶임. None은 "미분류" 처리 → 뒤로
  - difficulty  : 1 입문 → 2 중급 → 3 고급. None은 2(중급)로 간주
  - published_at: 같은 난이도 내에서 오래된 것 먼저 (강의 시리즈 순서 존중)
                  None은 가장 뒤
"""
import logging
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import Lecture, Course

logger = logging.getLogger(__name__)

_SENTINEL_DATE = datetime(9999, 12, 31)
_UNCLASSIFIED_MODULE = "￿_unclassified"  # 유니코드 마지막 문자 → 정렬 시 뒤로


def _lecture_sort_key(lec: Lecture) -> tuple:
    """강의 정렬 키: (module_name, difficulty, published_at)"""
    module = lec.module_name or _UNCLASSIFIED_MODULE
    diff   = lec.difficulty if lec.difficulty in (1, 2, 3) else 2
    pub    = lec.published_at or _SENTINEL_DATE
    return (module, diff, pub)


async def reorder_course_lectures(db: AsyncSession, course_id: str) -> int:
    """강좌 내 강의를 재정렬 후 number 1부터 재부여.

    Returns:
        변경된 강의 수 (이미 올바른 순서면 0)
    """
    rows = (await db.execute(
        select(Lecture)
        .where(Lecture.course_id == course_id)
        .order_by(Lecture.number)
    )).scalars().all()

    if not rows:
        return 0

    sorted_lecs = sorted(rows, key=_lecture_sort_key)

    changed = 0
    for i, lec in enumerate(sorted_lecs, start=1):
        if lec.number != i:
            lec.number = i
            changed += 1

    return changed


async def reorganize_courses(db: AsyncSession, course_ids: list[str]) -> dict:
    """지정 강좌들을 재정렬. 신규 영상이 추가된 강좌만 처리할 때 사용.

    Returns:
        {
          "courses_checked": n,
          "courses_reordered": n,
          "lectures_renumbered": n,
          "details": [{"course_id": ..., "title": ..., "renumbered": n}]
        }
    """
    if not course_ids:
        return {"courses_checked": 0, "courses_reordered": 0, "lectures_renumbered": 0, "details": []}

    courses = (await db.execute(
        select(Course).where(Course.id.in_(course_ids))
    )).scalars().all()

    total_changed = 0
    details = []

    for course in courses:
        changed = await reorder_course_lectures(db, course.id)
        if changed:
            total_changed += changed
            details.append({
                "course_id": course.id,
                "title": course.title,
                "renumbered": changed,
            })
            logger.info(f"[Reorganize] {course.title}: {changed}개 강의 번호 재부여")

    if total_changed:
        await db.commit()
        logger.info(f"[Reorganize] 완료 — {len(details)}개 강좌, {total_changed}개 강의 재정렬")

    return {
        "courses_checked": len(courses),
        "courses_reordered": len(details),
        "lectures_renumbered": total_changed,
        "details": details,
    }


async def reorganize_all_courses(db: AsyncSession) -> dict:
    """모든 강좌 재정렬. 수동 트리거 또는 전체 재구성 시 사용."""
    courses = (await db.execute(select(Course))).scalars().all()
    course_ids = [c.id for c in courses]
    return await reorganize_courses(db, course_ids)
