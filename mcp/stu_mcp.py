"""
STU (Self-Taught University) MCP Server
Claude Desktop이 STU DB에 직접 접근해서 커리큘럼을 분석·수정할 수 있게 해주는 MCP 서버.
"""

import json
import os
import re
from typing import Any

import httpx

from fastmcp import FastMCP
from sqlalchemy import create_engine, text

# DB 연결 — asyncpg 대신 psycopg2 (MCP는 동기 환경)
DB_URL = os.getenv(
    "STU_DB_URL",
    "postgresql+psycopg2://stu:stu@localhost:5432/stu",
)

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "")

engine = create_engine(
    DB_URL,
    connect_args={"options": "-c statement_timeout=8000 -c lock_timeout=5000"},
)
mcp = FastMCP("STU Curriculum")


def _query(sql: str, params: dict | None = None) -> list[dict]:
    with engine.connect() as conn:
        result = conn.execute(text(sql), params or {})
        cols = list(result.keys())
        return [dict(zip(cols, row)) for row in result.fetchall()]


def _execute(sql: str, params: dict | None = None) -> int:
    with engine.begin() as conn:
        result = conn.execute(text(sql), params or {})
        return result.rowcount


# ─── 조회 도구 ──────────────────────────────────────────────────────────────

@mcp.tool()
def list_courses() -> str:
    """모든 과목(course) 목록과 강의 수를 반환합니다."""
    rows = _query("""
        SELECT c.id, c.title, c.category, c.order_index,
               COUNT(l.id) AS lecture_count
        FROM courses c
        LEFT JOIN lectures l ON l.course_id = c.id
        GROUP BY c.id, c.title, c.category, c.order_index
        ORDER BY c.category, c.order_index
    """)
    return json.dumps(rows, ensure_ascii=False, default=str)


@mcp.tool()
def get_course_modules(course_id: str) -> str:
    """특정 과목의 모듈 요약(모듈명·강의 수·평균 난이도)만 반환합니다. 강의 목록은 get_module_lectures를 사용하세요."""
    rows = _query("""
        SELECT
            COALESCE(module_name, '(미분류)') AS module,
            COUNT(*) AS lecture_count,
            ROUND(AVG(difficulty), 1) AS avg_difficulty,
            MIN(number) AS first_number
        FROM lectures
        WHERE course_id = :cid
        GROUP BY COALESCE(module_name, '(미분류)')
        ORDER BY MIN(number)
    """, {"cid": course_id})
    return json.dumps(rows, ensure_ascii=False, default=str)


@mcp.tool()
def get_module_lectures(course_id: str, module_name: str) -> str:
    """특정 모듈의 강의 목록을 반환합니다. module_name에 '(미분류)' 전달 시 미분류 강의를 반환합니다."""
    if module_name == "(미분류)":
        rows = _query("""
            SELECT id, title, number, difficulty, duration_sec, tags, meta_source, youtube_url
            FROM lectures
            WHERE course_id = :cid AND module_name IS NULL
            ORDER BY number
        """, {"cid": course_id})
    else:
        rows = _query("""
            SELECT id, title, number, difficulty, duration_sec, tags, meta_source, youtube_url
            FROM lectures
            WHERE course_id = :cid AND module_name = :mod
            ORDER BY number
        """, {"cid": course_id, "mod": module_name})
    return json.dumps(rows, ensure_ascii=False, default=str)


@mcp.tool()
def get_curriculum_stats() -> str:
    """전체 커리큘럼 통계 — 카테고리별 강의 수, 모듈 수, 미분류 강의 수."""
    rows = _query("""
        SELECT
            c.category,
            c.title AS course_title,
            COUNT(l.id) AS total_lectures,
            COUNT(DISTINCT l.module_name) AS module_count,
            SUM(CASE WHEN l.module_name IS NULL THEN 1 ELSE 0 END) AS unclassified,
            AVG(l.difficulty) AS avg_difficulty
        FROM courses c
        LEFT JOIN lectures l ON l.course_id = c.id
        GROUP BY c.id, c.category, c.title
        ORDER BY c.category
    """)
    return json.dumps(rows, ensure_ascii=False, default=str)


@mcp.tool()
def search_lectures(keyword: str, course_id: str = "") -> str:
    """제목·태그로 강의를 검색합니다. course_id 지정 시 해당 과목만 검색."""
    base = """
        SELECT l.id, l.title, l.module_name, l.number, l.difficulty,
               l.tags, c.title AS course_title, c.category
        FROM lectures l
        JOIN courses c ON c.id = l.course_id
        WHERE (l.title ILIKE :kw OR l.tags::text ILIKE :kw)
    """
    params: dict[str, Any] = {"kw": f"%{keyword}%"}
    if course_id:
        base += " AND l.course_id = :cid"
        params["cid"] = course_id
    base += " ORDER BY c.category, l.number LIMIT 50"
    rows = _query(base, params)
    return json.dumps(rows, ensure_ascii=False, default=str)


@mcp.tool()
def get_unclassified_lectures(course_id: str = "") -> str:
    """module_name이 없는 강의 목록을 반환합니다."""
    sql = """
        SELECT l.id, l.title, l.number, l.tags, l.difficulty,
               c.title AS course_title, c.category
        FROM lectures l
        JOIN courses c ON c.id = l.course_id
        WHERE l.module_name IS NULL
    """
    params: dict[str, Any] = {}
    if course_id:
        sql += " AND l.course_id = :cid"
        params["cid"] = course_id
    sql += " ORDER BY c.category, l.number"
    rows = _query(sql, params)
    return json.dumps(rows, ensure_ascii=False, default=str)


@mcp.tool()
def get_module_list(course_id: str) -> str:
    """특정 과목의 모듈 이름 목록만 반환합니다."""
    rows = _query("""
        SELECT DISTINCT module_name
        FROM lectures
        WHERE course_id = :cid AND module_name IS NOT NULL
        ORDER BY module_name
    """, {"cid": course_id})
    return json.dumps([r["module_name"] for r in rows], ensure_ascii=False)


# ─── 수정 도구 ──────────────────────────────────────────────────────────────

@mcp.tool()
def update_lecture_module(lecture_id: str, module_name: str, order_number: int = -1) -> str:
    """강의의 모듈명(과 순서 번호)을 변경합니다. order_number=-1이면 순서 유지."""
    if order_number >= 0:
        cnt = _execute(
            "UPDATE lectures SET module_name = :m, number = :n WHERE id = :id",
            {"m": module_name, "n": order_number, "id": lecture_id},
        )
    else:
        cnt = _execute(
            "UPDATE lectures SET module_name = :m WHERE id = :id",
            {"m": module_name, "id": lecture_id},
        )
    return f"업데이트됨: {cnt}개 강의"


@mcp.tool()
def bulk_update_modules(updates: list[dict]) -> str:
    """
    여러 강의의 모듈명을 한 번에 변경합니다.
    updates 형식: [{"id": "...", "module_name": "...", "number": 1}, ...]
    number는 선택사항.
    """
    updated = 0
    errors = []
    for u in updates:
        try:
            if "number" in u:
                _execute(
                    "UPDATE lectures SET module_name = :m, number = :n WHERE id = :id",
                    {"m": u["module_name"], "n": u["number"], "id": u["id"]},
                )
            else:
                _execute(
                    "UPDATE lectures SET module_name = :m WHERE id = :id",
                    {"m": u["module_name"], "id": u["id"]},
                )
            updated += 1
        except Exception as e:
            errors.append({"id": u.get("id"), "error": str(e)})
    return json.dumps({"updated": updated, "errors": errors}, ensure_ascii=False)


@mcp.tool()
def move_lecture_to_course(lecture_id: str, target_course_id: str, module_name: str = "") -> str:
    """강의를 다른 과목으로 이동합니다. module_name은 선택사항."""
    params: dict[str, Any] = {"cid": target_course_id, "id": lecture_id}
    if module_name:
        params["m"] = module_name
        cnt = _execute(
            "UPDATE lectures SET course_id = :cid, module_name = :m WHERE id = :id",
            params,
        )
    else:
        cnt = _execute(
            "UPDATE lectures SET course_id = :cid WHERE id = :id",
            params,
        )
    return f"이동됨: {cnt}개 강의"


@mcp.tool()
def rename_module(course_id: str, old_name: str, new_name: str) -> str:
    """특정 과목 내 모듈 이름을 일괄 변경합니다."""
    cnt = _execute(
        "UPDATE lectures SET module_name = :new WHERE course_id = :cid AND module_name = :old",
        {"new": new_name, "cid": course_id, "old": old_name},
    )
    return f"업데이트됨: {cnt}개 강의"


@mcp.tool()
def reorder_lectures_in_module(course_id: str, module_name: str, lecture_ids_in_order: list[str]) -> str:
    """
    모듈 내 강의 순서를 재정렬합니다.
    lecture_ids_in_order: 원하는 순서대로 lecture id 목록
    """
    updated = 0
    for i, lid in enumerate(lecture_ids_in_order, start=1):
        updated += _execute(
            "UPDATE lectures SET number = :n WHERE id = :id AND course_id = :cid",
            {"n": i, "id": lid, "cid": course_id},
        )
    return f"재정렬 완료: {updated}개 강의"



# ─── YouTube 조회 도구 ──────────────────────────────────────────────────────

def _extract_video_id(url: str) -> str:
    patterns = [
        r"(?:v=|youtu\.be/|/embed/|/shorts/)([A-Za-z0-9_-]{11})",
    ]
    for pat in patterns:
        m = re.search(pat, url)
        if m:
            return m.group(1)
    return ""


@mcp.tool()
def get_youtube_title(youtube_url: str) -> str:
    """YouTube URL로 실제 영상 제목을 조회합니다. DB 제목과 비교할 때 사용하세요."""
    if not YOUTUBE_API_KEY:
        return json.dumps({"error": "YOUTUBE_API_KEY 환경변수가 설정되지 않았습니다"}, ensure_ascii=False)
    video_id = _extract_video_id(youtube_url)
    if not video_id:
        return json.dumps({"error": "YouTube URL에서 video_id를 추출할 수 없습니다"}, ensure_ascii=False)
    resp = httpx.get(
        "https://www.googleapis.com/youtube/v3/videos",
        params={"part": "snippet", "id": video_id, "key": YOUTUBE_API_KEY},
        timeout=10,
    )
    data = resp.json()
    items = data.get("items", [])
    if not items:
        return json.dumps({"error": "영상을 찾을 수 없습니다 (삭제되었거나 비공개일 수 있음)", "video_id": video_id}, ensure_ascii=False)
    snippet = items[0]["snippet"]
    return json.dumps({
        "video_id": video_id,
        "youtube_title": snippet["title"],
        "channel": snippet["channelTitle"],
        "published_at": snippet.get("publishedAt"),
    }, ensure_ascii=False)


# ─── 강의 상세 조회 ──────────────────────────────────────────────────────────

@mcp.tool()
def get_lecture_detail(lecture_id: str) -> str:
    """강의 상세 정보를 반환합니다 (YouTube URL, 태그, 난이도 등 전체 필드)."""
    rows = _query("""
        SELECT l.*, c.title AS course_title, c.category
        FROM lectures l
        JOIN courses c ON c.id = l.course_id
        WHERE l.id = :id
    """, {"id": lecture_id})
    if not rows:
        return json.dumps({"error": "강의를 찾을 수 없습니다"}, ensure_ascii=False)
    return json.dumps(rows[0], ensure_ascii=False, default=str)


@mcp.tool()
def get_lecture_note(lecture_id: str) -> str:
    """강의에 연결된 AI 노트(lecture_notes)를 반환합니다."""
    rows = _query("""
        SELECT ln.content_md, ln.updated_at, l.title AS lecture_title
        FROM lecture_notes ln
        JOIN lectures l ON l.id = ln.lecture_id
        WHERE ln.lecture_id = :id
    """, {"id": lecture_id})
    if not rows:
        return json.dumps({"content_md": "", "message": "노트 없음"}, ensure_ascii=False)
    return json.dumps(rows[0], ensure_ascii=False, default=str)


# ─── 내 노트 조회 ────────────────────────────────────────────────────────────

@mcp.tool()
def get_my_notes(limit: int = 20, offset: int = 0) -> str:
    """내가 작성한 노트 목록을 반환합니다 (최신순)."""
    rows = _query("""
        SELECT n.id, n.title, n.tags, n.created_at, n.updated_at,
               l.title AS linked_lecture
        FROM my_notes n
        LEFT JOIN lectures l ON l.id = n.lecture_id
        ORDER BY n.updated_at DESC
        LIMIT :lim OFFSET :off
    """, {"lim": limit, "off": offset})
    return json.dumps(rows, ensure_ascii=False, default=str)


@mcp.tool()
def search_my_notes(keyword: str) -> str:
    """제목·태그·본문으로 내 노트를 검색합니다."""
    rows = _query("""
        SELECT n.id, n.title, n.tags, n.updated_at,
               LEFT(n.content_md, 200) AS preview
        FROM my_notes n
        WHERE n.title ILIKE :kw
           OR n.content_md ILIKE :kw
           OR n.tags::text ILIKE :kw
        ORDER BY n.updated_at DESC
        LIMIT 30
    """, {"kw": f"%{keyword}%"})
    return json.dumps(rows, ensure_ascii=False, default=str)


@mcp.tool()
def get_my_note_content(note_id: str) -> str:
    """특정 노트의 전체 내용을 반환합니다."""
    rows = _query("""
        SELECT n.*, l.title AS linked_lecture
        FROM my_notes n
        LEFT JOIN lectures l ON l.id = n.lecture_id
        WHERE n.id = :id
    """, {"id": note_id})
    if not rows:
        return json.dumps({"error": "노트를 찾을 수 없습니다"}, ensure_ascii=False)
    return json.dumps(rows[0], ensure_ascii=False, default=str)


# ─── 지식 그래프 / 취약 개념 ─────────────────────────────────────────────────

@mcp.tool()
def get_knowledge_graph_nodes(category: str = "", only_with_content: bool = False) -> str:
    """
    지식 그래프 노드(개념) 목록을 반환합니다.
    category: 카테고리 필터 (빈 문자열이면 전체)
    only_with_content: True면 has_content=true인 노드만 반환
    """
    cond = "1=1"
    params: dict[str, Any] = {}
    if category:
        cond += " AND category = :cat"
        params["cat"] = category
    if only_with_content:
        cond += " AND has_content = true"
    rows = _query(f"""
        SELECT n.id, n.label, n.category, n.has_content, n.description,
               COUNT(DISTINCT e1.id) + COUNT(DISTINCT e2.id) AS edge_count
        FROM graph_nodes n
        LEFT JOIN graph_edges e1 ON e1.source_id = n.id
        LEFT JOIN graph_edges e2 ON e2.target_id = n.id
        WHERE {cond}
        GROUP BY n.id, n.label, n.category, n.has_content, n.description
        ORDER BY edge_count DESC, n.label
    """, params)
    return json.dumps(rows, ensure_ascii=False, default=str)


@mcp.tool()
def get_graph_node_neighbors(node_id: str) -> str:
    """특정 개념 노드의 연결된 이웃 노드와 관계 타입을 반환합니다."""
    rows = _query("""
        SELECT
            e.relation_type,
            CASE WHEN e.source_id = :id THEN 'outgoing' ELSE 'incoming' END AS direction,
            n.id AS neighbor_id, n.label AS neighbor_label, n.category AS neighbor_category
        FROM graph_edges e
        JOIN graph_nodes n ON n.id = CASE
            WHEN e.source_id = :id THEN e.target_id
            ELSE e.source_id
        END
        WHERE e.source_id = :id OR e.target_id = :id
        ORDER BY e.relation_type
    """, {"id": node_id})
    return json.dumps(rows, ensure_ascii=False, default=str)


if __name__ == "__main__":
    mcp.run()
