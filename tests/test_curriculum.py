import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete

from app.models.models import Course, Lecture, Progress


@pytest.fixture
async def course(db: AsyncSession):
    c = Course(title="선형대수학", source="MIT OCW", category="math", order_index=99)
    db.add(c)
    await db.commit()
    await db.refresh(c)
    yield c
    await db.execute(delete(Progress).where(Progress.course_id == c.id))
    await db.execute(delete(Lecture).where(Lecture.course_id == c.id))
    await db.delete(c)
    await db.commit()


@pytest.fixture
async def lecture(db: AsyncSession, course: Course):
    lec = Lecture(course_id=course.id, title="벡터와 공간", number=1)
    db.add(lec)
    await db.commit()
    await db.refresh(lec)
    return lec  # 삭제는 course 픽스처에서 cascade로 처리


async def test_list_courses(client):
    res = client.get("/api/v1/curriculum/")
    assert res.status_code == 200
    assert isinstance(res.json(), list)


async def test_list_courses_with_fixture(client, course: Course):
    res = client.get("/api/v1/curriculum/")
    assert res.status_code == 200
    ids = [c["id"] for c in res.json()]
    assert course.id in ids


async def test_course_response_schema(client, course: Course):
    res = client.get("/api/v1/curriculum/")
    found = next((c for c in res.json() if c["id"] == course.id), None)
    assert found is not None
    assert found["code"] == "MATH-101"   # category=math → MATH-101
    assert found["status"] == "todo"     # 진도 없으면 todo
    assert found["progress_pct"] == 0.0
    assert "lecture_count" in found


async def test_list_lectures(client, course: Course, lecture: Lecture):
    res = client.get(f"/api/v1/curriculum/{course.id}/lectures")
    assert res.status_code == 200
    ids = [l["id"] for l in res.json()]
    assert lecture.id in ids


async def test_lecture_completed_false_by_default(client, course: Course, lecture: Lecture):
    res = client.get(f"/api/v1/curriculum/{course.id}/lectures")
    found = next((l for l in res.json() if l["id"] == lecture.id), None)
    assert found is not None
    assert found["completed"] is False


async def test_mark_lecture_complete(client, course: Course, lecture: Lecture):
    res = client.post(
        f"/api/v1/curriculum/{course.id}/lectures/{lecture.id}/complete"
    )
    assert res.status_code == 201
    assert res.json()["ok"] is True

    # 완료 후 completed=True
    lectures_res = client.get(f"/api/v1/curriculum/{course.id}/lectures")
    found = next(l for l in lectures_res.json() if l["id"] == lecture.id)
    assert found["completed"] is True


async def test_mark_complete_idempotent(client, course: Course, lecture: Lecture):
    """같은 강의 두 번 완료 표시해도 에러 없음"""
    res1 = client.post(f"/api/v1/curriculum/{course.id}/lectures/{lecture.id}/complete")
    res2 = client.post(f"/api/v1/curriculum/{course.id}/lectures/{lecture.id}/complete")
    assert res1.status_code == 201
    assert res2.status_code == 201


async def test_get_lecture_detail(client, lecture: Lecture):
    res = client.get(f"/api/v1/curriculum/lectures/{lecture.id}")
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == lecture.id
    assert body["title"] == lecture.title
    assert "content" in body


async def test_get_lecture_detail_not_found(client):
    res = client.get("/api/v1/curriculum/lectures/00000000-0000-0000-0000-000000000000")
    assert res.status_code == 404
    assert res.json()["error"] == "NOT_FOUND"


async def test_get_lecture_detail_invalid_uuid(client):
    res = client.get("/api/v1/curriculum/lectures/bad-id")
    assert res.status_code == 404
    assert res.json()["error"] == "NOT_FOUND"


async def test_progress_pct_updates(client, course: Course, lecture: Lecture):
    """강의 완료 후 커리큘럼 progress_pct 업데이트 확인"""
    client.post(f"/api/v1/curriculum/{course.id}/lectures/{lecture.id}/complete")
    res = client.get("/api/v1/curriculum/")
    found = next(c for c in res.json() if c["id"] == course.id)
    assert found["progress_pct"] == 100.0
    assert found["status"] == "done"
