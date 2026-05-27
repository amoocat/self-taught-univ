#!/usr/bin/env python3
"""
sync_titles.py — DB 강의 제목을 YouTube 실제 제목으로 일괄 덮어쓰기

사용법:
  python sync_titles.py                     # 전체 실행
  python sync_titles.py --course_id <uuid>  # 특정 과목만
  python sync_titles.py --dry-run           # 수정 없이 변경 목록만 출력
  python sync_titles.py --retry-failed      # 이전 실패 항목만 재시도
"""

import argparse
import json
import re
import sys
import time
from pathlib import Path

import httpx
import psycopg2
import psycopg2.extras

# ── 환경 설정 ─────────────────────────────────────────────────────────────────

def _load_dotenv(path: str = ".env") -> dict[str, str]:
    env: dict[str, str] = {}
    try:
        for line in Path(path).read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip()
    except FileNotFoundError:
        pass
    return env


_env = _load_dotenv()


def _getenv(key: str, default: str = "") -> str:
    import os
    return os.getenv(key) or _env.get(key, default)


_DB_URL_RAW = _getenv("DATABASE_URL", "postgresql://stu:stu@localhost:5432/stu")
# +asyncpg / +psycopg2 prefix 제거해서 psycopg2 DSN으로 변환
DB_DSN = re.sub(r"\+[a-z0-9]+", "", _DB_URL_RAW)
YOUTUBE_API_KEY = _getenv("YOUTUBE_API_KEY")

# ── 출력 파일 경로 ────────────────────────────────────────────────────────────

CHECKPOINT_FILE = Path("checkpoint.json")
FAILED_FILE = Path("failed.json")
SKIPPED_FILE = Path("skipped.json")
UPDATE_RESULT_FILE = Path("update_result.json")

# ── 유틸 ─────────────────────────────────────────────────────────────────────

_VIDEO_ID_RE = re.compile(r"(?:v=|youtu\.be/|/embed/|/shorts/)([A-Za-z0-9_-]{11})")


def extract_video_id(url: str) -> str | None:
    m = _VIDEO_ID_RE.search(url or "")
    return m.group(1) if m else None


def load_json(path: Path, default):
    if path.exists():
        try:
            return json.loads(path.read_text())
        except Exception:
            pass
    return default


def save_json(path: Path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))


# ── DB ───────────────────────────────────────────────────────────────────────

def get_conn():
    return psycopg2.connect(DB_DSN)


def fetch_all_lectures(conn, course_id: str | None) -> list[dict]:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        if course_id:
            cur.execute(
                "SELECT id, title, youtube_url, youtube_video_id "
                "FROM lectures WHERE course_id = %s ORDER BY number",
                (course_id,),
            )
        else:
            cur.execute(
                "SELECT id, title, youtube_url, youtube_video_id FROM lectures ORDER BY id"
            )
        return [dict(r) for r in cur.fetchall()]


def update_title_db(conn, lecture_id: str, new_title: str):
    with conn.cursor() as cur:
        cur.execute("UPDATE lectures SET title = %s WHERE id = %s", (new_title, lecture_id))
    conn.commit()


# ── YouTube Data API v3 ───────────────────────────────────────────────────────

def batch_fetch_yt_titles(video_ids: list[str]) -> dict[str, str]:
    """최대 50개 video_id를 videos.list 1회 호출로 조회. {video_id: title} 반환."""
    result: dict[str, str] = {}
    for i in range(0, len(video_ids), 50):
        batch = video_ids[i : i + 50]
        resp = httpx.get(
            "https://www.googleapis.com/youtube/v3/videos",
            params={
                "part": "snippet",
                "id": ",".join(batch),
                "key": YOUTUBE_API_KEY,
                "fields": "items(id,snippet/title)",
            },
            timeout=15,
        )
        resp.raise_for_status()
        for item in resp.json().get("items", []):
            result[item["id"]] = item["snippet"]["title"]
    return result


# ── 단계별 처리 ───────────────────────────────────────────────────────────────

def step1_collect(conn, args) -> tuple[list[dict], list[dict]]:
    """DB 강의 조회 → (처리 대상 목록, 스킵 목록) 반환."""
    print("📋 강의 목록 조회 중...")

    if args.retry_failed:
        prev = load_json(FAILED_FILE, {"failed": []})
        failed_ids = {f["lecture_id"] for f in prev.get("failed", [])}
        if not failed_ids:
            print("  재시도할 실패 항목이 없습니다.")
            sys.exit(0)
        all_lectures = fetch_all_lectures(conn, args.course_id)
        lectures = [l for l in all_lectures if l["id"] in failed_ids]
        # 재시도 시 해당 video_id를 checkpoint cache에서 제거해 재조회 강제
        checkpoint = load_json(CHECKPOINT_FILE, {"fetched": {}})
        retry_vids = {l.get("youtube_video_id") or extract_video_id(l.get("youtube_url") or "") for l in lectures}
        checkpoint["fetched"] = {k: v for k, v in checkpoint.get("fetched", {}).items() if k not in retry_vids}
        save_json(CHECKPOINT_FILE, checkpoint)
    else:
        lectures = fetch_all_lectures(conn, args.course_id)

    skipped: list[dict] = []
    to_process: list[dict] = []

    for lec in lectures:
        url = (lec.get("youtube_url") or "").strip()
        if not url:
            skipped.append({"lecture_id": lec["id"], "db_title": lec["title"], "reason": "no_url"})
            continue
        vid = lec.get("youtube_video_id") or extract_video_id(url)
        if not vid:
            skipped.append({
                "lecture_id": lec["id"], "db_title": lec["title"],
                "youtube_url": url, "reason": "video_id_parse_failed",
            })
            continue
        to_process.append({
            "lecture_id": lec["id"],
            "db_title": lec["title"],
            "video_id": vid,
            "youtube_url": url,
        })

    save_json(SKIPPED_FILE, {"count": len(skipped), "skipped": skipped})
    print(f"  전체: {len(lectures)}개 | 처리 대상: {len(to_process)}개 | 스킵: {len(skipped)}개")
    return to_process, skipped


def step2_fetch_titles(to_process: list[dict]) -> tuple[dict[str, str], list[dict]]:
    """YouTube titles 배치 조회 → (fetched dict, failed_items) 반환."""
    checkpoint = load_json(CHECKPOINT_FILE, {"fetched": {}})
    fetched: dict[str, str] = checkpoint.get("fetched", {})

    all_vids = list({p["video_id"] for p in to_process})
    unfetched = [v for v in all_vids if v not in fetched]
    failed_vids: set[str] = set()

    if unfetched:
        total_batches = -(-len(unfetched) // 50)
        print(f"\n🎬 YouTube 제목 조회 중... ({len(unfetched)}개 video_id, {total_batches}회 API 호출)")
        for i in range(0, len(unfetched), 50):
            batch = unfetched[i : i + 50]
            batch_num = i // 50 + 1
            try:
                titles = batch_fetch_yt_titles(batch)
                fetched.update(titles)
                not_found = len(batch) - len([v for v in batch if v in titles])
                for vid in batch:
                    if vid not in titles:
                        failed_vids.add(vid)
                checkpoint["fetched"] = fetched
                save_json(CHECKPOINT_FILE, checkpoint)
                print(f"  배치 {batch_num}/{total_batches} 완료  "
                      f"(조회 {len(titles)}개, 미응답/삭제 {not_found}개)")
            except Exception as e:
                print(f"  ⚠️  배치 {batch_num}/{total_batches} 실패: {e}")
                failed_vids.update(batch)
    else:
        print("\n✅ 체크포인트에서 YouTube 제목 전부 로드 (API 호출 생략)")

    failed_items = [
        {
            "lecture_id": p["lecture_id"],
            "video_id": p["video_id"],
            "youtube_url": p["youtube_url"],
        }
        for p in to_process if p["video_id"] in failed_vids
    ]
    save_json(FAILED_FILE, {"count": len(failed_items), "failed": failed_items})

    return fetched, failed_items


def step3_update(conn, to_process: list[dict], fetched: dict[str, str],
                 failed_vids: set[str], dry_run: bool) -> tuple[list, list, list]:
    """제목 업데이트 → (updated, no_change, update_failed) 반환."""
    targets = [p for p in to_process if p["video_id"] not in failed_vids]
    label = "🔍 dry-run — 실제 수정 없음" if dry_run else "✏️  제목 업데이트 중..."
    print(f"\n{label} ({len(targets)}개 대상)")

    updated: list[dict] = []
    no_change: list[dict] = []
    update_failed: list[dict] = []

    for p in targets:
        yt_title = fetched.get(p["video_id"])
        if not yt_title:
            update_failed.append({**p, "reason": "title_not_in_cache"})
            continue

        if p["db_title"] == yt_title:
            no_change.append({"lecture_id": p["lecture_id"], "title": yt_title})
            continue

        entry = {
            "lecture_id": p["lecture_id"],
            "db_title": p["db_title"],
            "youtube_title": yt_title,
        }
        if dry_run:
            updated.append(entry)
        else:
            try:
                update_title_db(conn, p["lecture_id"], yt_title)
                updated.append(entry)
                time.sleep(0.05)
            except Exception as e:
                update_failed.append({**entry, "reason": str(e)})

    save_json(UPDATE_RESULT_FILE, {
        "updated": updated,
        "no_change": no_change,
        "failed": update_failed,
    })
    return updated, no_change, update_failed


# ── 진입점 ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="YouTube 제목으로 강의 제목 일괄 동기화")
    parser.add_argument("--course_id", default=None, metavar="UUID", help="특정 과목만 처리")
    parser.add_argument("--dry-run", action="store_true", help="수정 없이 변경 목록만 출력")
    parser.add_argument("--retry-failed", action="store_true", help="failed.json 항목만 재시도")
    args = parser.parse_args()

    if not YOUTUBE_API_KEY:
        print("❌ YOUTUBE_API_KEY 환경변수가 설정되지 않았습니다.")
        sys.exit(1)

    conn = get_conn()
    try:
        # Step 1
        to_process, skipped = step1_collect(conn, args)
        if not to_process:
            print("처리할 강의가 없습니다.")
            return

        # Step 2
        fetched, failed_items = step2_fetch_titles(to_process)
        failed_vids = {f["video_id"] for f in failed_items}

        # Step 3
        updated, no_change, update_failed = step3_update(
            conn, to_process, fetched, failed_vids, args.dry_run
        )

        # 완료 시 checkpoint 삭제 (실패 없고 dry-run 아닐 때)
        if not args.dry_run and not failed_vids and CHECKPOINT_FILE.exists():
            CHECKPOINT_FILE.unlink()

    finally:
        conn.close()

    # Step 4: 결과 리포트
    action = "변경 예정" if args.dry_run else "업데이트 완료"
    print(f"""
✅ {action}: {len(updated)}개
⏭️  변경 없음 (이미 일치): {len(no_change)}개
⚠️  YouTube 조회 실패: {len(failed_items)}개
⏩ URL 없음 (스킵): {len(skipped)}개
📁 상세 결과: {UPDATE_RESULT_FILE}""")

    if args.dry_run and updated:
        print("\n--- dry-run 변경 예정 목록 (최대 20개) ---")
        for item in updated[:20]:
            print(f"  [{item['lecture_id'][:8]}…] {item['db_title']!r}")
            print(f"           → {item['youtube_title']!r}")
        if len(updated) > 20:
            print(f"  … 외 {len(updated) - 20}개 (전체 목록: {UPDATE_RESULT_FILE})")


if __name__ == "__main__":
    main()
