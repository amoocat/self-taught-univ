"""LLM-based video classifier.

GPT-4o-mini가 영상 제목 + 설명을 읽고:
  1. 기존 강좌 중 가장 적합한 곳 선택 (course_id)
  2. 난이도 판단 (1=입문 / 2=중급 / 3=고급)
  3. 기존 강좌에 맞지 않으면 새 강좌 제안

사용: POST /api/v1/youtube/inbox/classify-llm
"""
import json
import logging
import openai
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.core.config import settings
from app.models.models import Course, Lecture, VideoInbox


def _parse_yt_date(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return None

logger = logging.getLogger(__name__)

_BATCH = 15  # GPT 한 번에 처리할 영상 수


async def classify_and_promote(db: AsyncSession) -> dict:
    """VideoInbox 전체를 LLM으로 분류 → Lecture 승격.

    Returns: {"classified": n, "promoted": n, "new_courses": [...], "skipped": n}
    """
    inbox = (await db.execute(select(VideoInbox))).scalars().all()
    if not inbox:
        return {"classified": 0, "promoted": 0, "new_courses": [], "skipped": 0}

    # 5분(300초) 이하 영상 사전 필터링
    MIN_DURATION_SEC = 300
    short_videos = [v for v in inbox if (v.duration_sec or 0) < MIN_DURATION_SEC]
    if short_videos:
        for v in short_videos:
            await db.execute(text("DELETE FROM video_inbox WHERE id = :id"), {"id": v.id})
        await db.flush()
        short_id_set = {v.id for v in short_videos}
        inbox = [v for v in inbox if v.id not in short_id_set]

    if not inbox:
        return {"classified": 0, "promoted": 0, "new_courses": [], "skipped": len(short_videos)}

    courses = (await db.execute(select(Course))).scalars().all()
    course_map = {c.id: c for c in courses}
    course_list = [
        {"id": c.id, "name": c.title, "category": c.category.upper()}
        for c in courses
    ]

    gpt = openai.AsyncOpenAI(api_key=settings.CHATGPT_API_KEY)
    all_results: list[dict] = []

    for i in range(0, len(inbox), _BATCH):
        batch = inbox[i : i + _BATCH]
        videos_payload = [
            {
                "id": v.video_id,
                "title": v.title,
                "description": (v.description or "")[:400],
            }
            for v in batch
        ]

        prompt = (
            "You are a curriculum organizer for an AI/ML self-learning platform.\n\n"
            "Existing courses:\n"
            + json.dumps(course_list, ensure_ascii=False)
            + "\n\n"
            "For each video, return:\n"
            '  "course_id": matching course ID from the list (EXACT ID string)\n'
            '  "difficulty": 1 (beginner) | 2 (intermediate) | 3 (advanced)\n'
            '  "new_course": null, or {"name":"...", "category":"MATH|STAT|ML|DL|CV|NLP|LLM|RL|DATA|MLOPS"} '
            "if no existing course fits\n\n"
            "Rules:\n"
            "- Prefer existing courses whenever possible\n"
            "- Only suggest new_course if the video is clearly outside all existing categories\n"
            "- Music, personal vlogs, unrelated content → set course_id to null and new_course to null\n\n"
            "Videos:\n"
            + json.dumps(videos_payload, ensure_ascii=False)
            + "\n\n"
            'Return JSON: {"results": [{"id":"video_id","course_id":"...","difficulty":2,"new_course":null}]}'
        )

        try:
            resp = await gpt.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
            )
            raw = json.loads(resp.choices[0].message.content)
            batch_results = raw.get("results", raw if isinstance(raw, list) else [])
            all_results.extend(batch_results)
        except Exception as e:
            logger.error("LLM classify batch %d error: %s", i // _BATCH, e)
            for v in batch:
                all_results.append({"id": v.video_id, "course_id": None, "difficulty": 2, "new_course": None})

    # GPT 실패 폴백: course_id 없는 영상은 제목 키워드로 재분류 시도
    from app.crawlers.youtube import _classify_video as _kw_classify
    cat_to_course = {}
    for c in courses:
        if c.category not in cat_to_course:
            cat_to_course[c.category] = c
    inbox_by_vid = {v.video_id: v for v in inbox}

    for item in all_results:
        if not item.get("course_id"):
            v = inbox_by_vid.get(item["id"])
            if v:
                cat = _kw_classify(v.title, v.description or "")
                if cat and cat in cat_to_course:
                    item["course_id"] = cat_to_course[cat].id
                    item["difficulty"] = item.get("difficulty") or 2

    # video_id → classification 매핑
    result_map = {r["id"]: r for r in all_results}

    promoted = 0
    skipped = 0
    new_courses_created: list[str] = []
    affected_course_ids: set[str] = set()
    inbox_to_delete = list(inbox)

    for v in inbox:
        info = result_map.get(v.video_id)
        if not info:
            skipped += 1
            continue

        course_id = info.get("course_id")
        difficulty = info.get("difficulty") or 2
        new_course_data = info.get("new_course")

        # 새 강좌 생성
        if not course_id and new_course_data and new_course_data.get("name"):
            cat = (new_course_data.get("category") or "MISC").lower()
            existing_new = (await db.execute(
                select(Course).where(Course.category == cat)
            )).scalar_one_or_none()

            if existing_new:
                course_id = existing_new.id
            else:
                new_course = Course(
                    title=new_course_data["name"],
                    category=cat,
                    description=f"자동 생성 강좌 — {new_course_data['name']}",
                )
                db.add(new_course)
                await db.flush()
                course_id = new_course.id
                new_courses_created.append(new_course_data["name"])
                course_map[course_id] = new_course

        if not course_id:
            skipped += 1
            continue

        # 중복 확인 (video_id 기준)
        dup = (await db.execute(
            select(Lecture).where(Lecture.youtube_video_id == v.video_id)
        )).scalar_one_or_none()
        if dup:
            skipped += 1
            continue

        # 강의 번호: 해당 강좌의 현재 마지막 번호 + 1 (재정렬 후 덮어씌워짐)
        max_num_row = (await db.execute(
            select(Lecture.number).where(Lecture.course_id == course_id)
            .order_by(Lecture.number.desc()).limit(1)
        )).scalar_one_or_none()
        next_num = (max_num_row or 0) + 1

        db.add(Lecture(
            course_id=course_id,
            title=v.title,
            number=next_num,
            difficulty=difficulty,  # GPT가 판단한 난이도 저장 (이전엔 누락됐음)
            category=(course_map.get(course_id).category if course_id in course_map else "misc"),
            youtube_url=f"https://youtube.com/watch?v={v.video_id}",
            youtube_video_id=v.video_id,
            thumbnail_url=v.thumbnail_url,
            playlist_id=v.playlist_id,
            duration_sec=v.duration_sec,
            published_at=_parse_yt_date(v.published_at),
            is_available=True,
        ))
        affected_course_ids.add(course_id)
        promoted += 1

    # 처리한 inbox 전부 삭제 (id는 varchar — text() 사용으로 UUID 캐스팅 우회)
    for v in inbox_to_delete:
        await db.execute(text("DELETE FROM video_inbox WHERE id = :id"), {"id": v.id})
    await db.commit()

    return {
        "classified": len(inbox),
        "promoted": promoted,
        "new_courses": new_courses_created,
        "skipped": skipped,
        "affected_course_ids": list(affected_course_ids),  # 재정렬이 필요한 강좌 목록
    }
