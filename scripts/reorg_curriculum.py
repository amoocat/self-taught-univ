"""
커리큘럼 재정렬 스크립트 v2
1. 모든 강의를 _classify_video 키워드 분류기로 재분류
2. 오분류된 강의를 올바른 강좌로 이동
3. 학습 무관 강의(컨퍼런스 키노트, 광고성 세션) 삭제
4. 강좌 내 강의 번호 재정렬
"""
import asyncio
import sys
import re
sys.path.insert(0, '/app')

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, text
from app.models.models import Course, Lecture
from app.crawlers.youtube import _classify_video

DATABASE_URL = "postgresql+asyncpg://stu:stu@db:5432/stu"

# ── 쓰레기 강의 패턴 (삭제 대상) ──────────────────────────────────
_JUNK_PATTERNS = [
    r"^Keynote:",
    r"^Lightning Talk:",
    r"^Sponsored Session:",
    r"^State of PyTorch",
    r"^STATE OF PYTORCH",
    r"aws re:invent.*(?:s3|storage|ransomware|resilience|lens|exabyte|table)",
    r"netflix.*s3",
    r"^TORCHVISION \d{4}",
    r"I don't know a single thing",   # 노래
]
_JUNK_RE = [re.compile(p, re.IGNORECASE) for p in _JUNK_PATTERNS]

def is_junk(title: str) -> bool:
    for r in _JUNK_RE:
        if r.search(title):
            return True
    return False


# ── 이동 보호 규칙 ────────────────────────────────────────────────
# 이 강좌의 강의는 키워드가 달라도 이동하지 않음 (specialized domain)
_PROTECTED_CATS = {"actuary", "ie"}

# 제목에 이 패턴이 포함되면 현재 강좌 유지 (overkill 방지)
_KEEP_IN_CURRENT: list[tuple[str, set[str]]] = [
    # mlops 강좌에서 나가지 않을 것들
    ("mlops", {"ci/cd", "a/b test", "canary", "mlflow", "dvc", "airflow", "kubernetes for ml",
               "model registry", "feature store", "model serving", "model monitor",
               "drift detect", "experiment track"}),
    # llm 강좌에서 나가지 않을 것들 (실제 LLM 논문들)
    ("llm",   {"raptor", "kv cache", "kv-cache", "rag ", "retrieval augmented", "vllm",
               "flash attention", "prompt engineering", "chain of thought",
               "rlhf", "reinforcement learning from human feedback",
               "instruction tuning", "sft ", "dpo ", "lora", "qlora",
               "chinchilla", "gpt-4", "llama", "mistral", "gemma",
               "in-context learning", "few-shot", "zero-shot"}),
    # data 강좌에서 나가지 않을 것들
    ("data",  {"spark", "airflow", "kafka", "flink", "dbt ", "warehouse", "etl", "elt ",
               "data lake", "data engineer", "nosql", "sql", "database"}),
]

def should_keep(cur_cat: str, title: str) -> bool:
    t = title.lower()
    for cat, keywords in _KEEP_IN_CURRENT:
        if cur_cat == cat:
            if any(kw in t for kw in keywords):
                return True
    return False


async def main(dry_run: bool = True):
    engine = create_async_engine(DATABASE_URL)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:
        courses  = (await db.execute(select(Course))).scalars().all()
        course_map = {c.id: c for c in courses}
        cat_to_course: dict[str, Course] = {}
        for c in courses:
            if c.category not in cat_to_course:
                cat_to_course[c.category] = c

        lectures = (await db.execute(select(Lecture))).scalars().all()
        print(f"총 강의: {len(lectures)}개  |  강좌: {len(courses)}개\n")

        to_delete: list[Lecture] = []
        to_move:   list[tuple[Lecture, Course]] = []

        for lec in lectures:
            cur = course_map.get(lec.course_id)
            if not cur:
                continue

            # 1) 쓰레기 강의 삭제 (YouTube URL 있을 때만)
            if lec.youtube_url and is_junk(lec.title):
                to_delete.append(lec)
                print(f"[DEL] [{cur.category:8}] {lec.title[:70]}")
                continue

            # 2) YouTube URL 없는 강의(수동 생성)는 이동하지 않음
            if not lec.youtube_url:
                continue

            # 3) 전문 강좌(actuary, ie) 강의는 이동하지 않음
            if cur.category in _PROTECTED_CATS:
                continue

            # 4) keep-in-current 규칙 적용
            if should_keep(cur.category, lec.title):
                continue

            # 5) 키워드 재분류
            cat = _classify_video(lec.title, lec.subtitle or "")
            if cat and cat != cur.category and cat not in _PROTECTED_CATS:
                target = cat_to_course.get(cat)
                if target:
                    to_move.append((lec, target))
                    print(f"[MOV] {cur.category:8} → {cat:8}: {lec.title[:60]}")

        print(f"\n=== 요약 ===")
        print(f"삭제 대상: {len(to_delete)}개")
        print(f"이동 대상: {len(to_move)}개")

        # 이동 후 강좌별 예상 강의 수
        delta: dict[str, int] = {}
        for lec in to_delete:
            c = course_map.get(lec.course_id)
            if c: delta[c.category] = delta.get(c.category, 0) - 1
        for lec, target in to_move:
            c = course_map.get(lec.course_id)
            if c: delta[c.category] = delta.get(c.category, 0) - 1
            delta[target.category] = delta.get(target.category, 0) + 1

        print("\n강좌별 변화:")
        course_counts = {}
        for lec in lectures:
            c = course_map.get(lec.course_id)
            if c: course_counts[c.category] = course_counts.get(c.category, 0) + 1
        for c in sorted(courses, key=lambda x: x.category):
            cur_n = course_counts.get(c.category, 0)
            d     = delta.get(c.category, 0)
            new_n = cur_n + d
            sign  = f"+{d}" if d > 0 else str(d) if d < 0 else ""
            print(f"  {c.category:10} {cur_n:3}강 → {new_n:3}강  {sign}")

        if dry_run:
            print("\n[DRY RUN] 실제 변경 없음. --apply 로 다시 실행하세요.")
            return

        # ── 실제 변경 ──────────────────────────────────────────
        print("\n변경 시작...")

        for lec in to_delete:
            await db.execute(text("DELETE FROM lectures WHERE id = :id"), {"id": lec.id})
        print(f"  {len(to_delete)}개 삭제")

        for lec, target in to_move:
            await db.execute(
                text("UPDATE lectures SET course_id = :cid, module_name = NULL WHERE id = :id"),
                {"cid": target.id, "id": lec.id}
            )
        print(f"  {len(to_move)}개 이동")

        # 강의 번호 재정렬 (변경된 강좌 전부)
        affected = set()
        for lec in to_delete: affected.add(lec.course_id)
        for lec, tgt in to_move:
            affected.add(lec.course_id)
            affected.add(tgt.id)

        await db.flush()

        for cid in affected:
            rows = (await db.execute(
                select(Lecture.id).where(Lecture.course_id == cid)
                .order_by(Lecture.number, Lecture.id)
            )).all()
            for i, (lid,) in enumerate(rows, 1):
                await db.execute(
                    text("UPDATE lectures SET number = :n WHERE id = :id"),
                    {"n": i, "id": lid}
                )

        await db.commit()
        print(f"  번호 재정렬 완료 ({len(affected)}개 강좌)")
        print("\n완료!")


if __name__ == "__main__":
    dry = "--apply" not in sys.argv
    if not dry:
        print("=== APPLY 모드 — 실제 DB 변경 ===\n")
    asyncio.run(main(dry_run=dry))
