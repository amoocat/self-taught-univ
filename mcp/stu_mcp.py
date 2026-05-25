"""
STU (Self-Taught University) MCP Server
Claude Desktop이 STU DB에 직접 접근해서 커리큘럼을 분석·수정할 수 있게 해주는 MCP 서버.
"""

import json
import os
from typing import Any

from fastmcp import FastMCP
from sqlalchemy import create_engine, text

# DB 연결 — asyncpg 대신 psycopg2 (MCP는 동기 환경)
DB_URL = os.getenv(
    "STU_DB_URL",
    "postgresql+psycopg2://stu:stu@localhost:5432/stu",
)

engine = create_engine(DB_URL, pool_pre_ping=True)
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
    """특정 과목의 모듈별 강의 수와 강의 목록을 반환합니다."""
    rows = _query("""
        SELECT
            COALESCE(module_name, '(미분류)') AS module,
            COUNT(*) AS lecture_count,
            AVG(difficulty) AS avg_difficulty,
            json_agg(
                json_build_object(
                    'id', id,
                    'title', title,
                    'number', number,
                    'difficulty', difficulty,
                    'duration_sec', duration_sec,
                    'tags', tags,
                    'meta_source', meta_source
                ) ORDER BY number
            ) AS lectures
        FROM lectures
        WHERE course_id = :cid
        GROUP BY COALESCE(module_name, '(미분류)')
        ORDER BY MIN(number)
    """, {"cid": course_id})
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


if __name__ == "__main__":
    mcp.run()
