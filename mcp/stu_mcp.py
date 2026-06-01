"""
STU Curriculum MCP Server

FastMCP server for managing the self-taught university curriculum database.
Uses psycopg2 (sync) for direct DB access — avoids asyncpg in stdio context.
"""
import os
import json
import uuid
from datetime import datetime
from typing import Optional

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

# Load .env from project root
_ENV_PATH = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(_ENV_PATH)

# Build sync DSN from DATABASE_URL (strip asyncpg driver)
_db_url = os.getenv("DATABASE_URL", "postgresql://stu:stu@localhost:5432/stu")
_DSN = _db_url.replace("postgresql+asyncpg://", "postgresql://").replace("postgresql+psycopg2://", "postgresql://")

mcp = FastMCP("stu-curriculum")


def _conn():
    return psycopg2.connect(_DSN, cursor_factory=psycopg2.extras.RealDictCursor)


# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------

@mcp.tool()
def list_courses() -> str:
    """List all courses with lecture count."""
    with _conn() as con:
        with con.cursor() as cur:
            cur.execute("""
                SELECT c.id, c.title, c.source, c.category, c.order_index,
                       COUNT(l.id) AS lecture_count
                FROM courses c
                LEFT JOIN lectures l ON l.course_id = c.id
                GROUP BY c.id
                ORDER BY c.category, c.order_index, c.title
            """)
            rows = cur.fetchall()
    return json.dumps([dict(r) for r in rows], ensure_ascii=False, default=str)


@mcp.tool()
def create_course(title: str, source: str, category: str, description: Optional[str] = None) -> str:
    """Create a new course."""
    new_id = str(uuid.uuid4())
    with _conn() as con:
        with con.cursor() as cur:
            cur.execute(
                """
                INSERT INTO courses (id, title, source, category, description, objectives, order_index, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, 0, %s)
                RETURNING id, title
                """,
                (new_id, title, source, category, description, json.dumps([]), datetime.utcnow()),
            )
            row = cur.fetchone()
        con.commit()
    return json.dumps(dict(row), ensure_ascii=False)


@mcp.tool()
def get_course_modules(course_id: str) -> str:
    """Get all module names and lecture counts for a course."""
    with _conn() as con:
        with con.cursor() as cur:
            cur.execute("""
                SELECT module_name, COUNT(*) AS lecture_count
                FROM lectures
                WHERE course_id = %s
                GROUP BY module_name
                ORDER BY module_name NULLS LAST
            """, (course_id,))
            rows = cur.fetchall()
    return json.dumps([dict(r) for r in rows], ensure_ascii=False)


# ---------------------------------------------------------------------------
# Lectures
# ---------------------------------------------------------------------------

@mcp.tool()
def get_module_lectures(course_id: str, module_name: Optional[str] = None) -> str:
    """Get lectures in a course, optionally filtered by module."""
    with _conn() as con:
        with con.cursor() as cur:
            if module_name is None:
                cur.execute("""
                    SELECT id, title, number, module_name, difficulty, duration_sec,
                           youtube_url, is_available, tags
                    FROM lectures
                    WHERE course_id = %s
                    ORDER BY number
                """, (course_id,))
            else:
                cur.execute("""
                    SELECT id, title, number, module_name, difficulty, duration_sec,
                           youtube_url, is_available, tags
                    FROM lectures
                    WHERE course_id = %s AND module_name = %s
                    ORDER BY number
                """, (course_id, module_name))
            rows = cur.fetchall()
    return json.dumps([dict(r) for r in rows], ensure_ascii=False, default=str)


@mcp.tool()
def get_lecture_detail(lecture_id: str) -> str:
    """Get full details of a lecture."""
    with _conn() as con:
        with con.cursor() as cur:
            cur.execute("SELECT * FROM lectures WHERE id = %s", (lecture_id,))
            row = cur.fetchone()
    if not row:
        return json.dumps({"error": "not found"})
    return json.dumps(dict(row), ensure_ascii=False, default=str)


@mcp.tool()
def search_lectures(query: str, course_id: Optional[str] = None, limit: int = 20) -> str:
    """Search lectures by title (case-insensitive substring match)."""
    with _conn() as con:
        with con.cursor() as cur:
            if course_id:
                cur.execute("""
                    SELECT id, title, number, course_id, module_name
                    FROM lectures
                    WHERE course_id = %s AND title ILIKE %s
                    ORDER BY number
                    LIMIT %s
                """, (course_id, f"%{query}%", limit))
            else:
                cur.execute("""
                    SELECT id, title, number, course_id, module_name
                    FROM lectures
                    WHERE title ILIKE %s
                    ORDER BY title
                    LIMIT %s
                """, (f"%{query}%", limit))
            rows = cur.fetchall()
    return json.dumps([dict(r) for r in rows], ensure_ascii=False, default=str)


@mcp.tool()
def update_lecture(
    lecture_id: str,
    title: Optional[str] = None,
    module_name: Optional[str] = None,
    difficulty: Optional[int] = None,
    tags: Optional[list] = None,
    subtitle: Optional[str] = None,
    is_available: Optional[bool] = None,
) -> str:
    """Update fields of a lecture."""
    updates = {}
    if title is not None:
        updates["title"] = title
    if module_name is not None:
        updates["module_name"] = module_name
    if difficulty is not None:
        updates["difficulty"] = difficulty
    if tags is not None:
        updates["tags"] = json.dumps(tags)
    if subtitle is not None:
        updates["subtitle"] = subtitle
    if is_available is not None:
        updates["is_available"] = is_available

    if not updates:
        return json.dumps({"error": "no fields to update"})

    set_clause = ", ".join(f"{k} = %s" for k in updates)
    values = list(updates.values()) + [lecture_id]

    with _conn() as con:
        with con.cursor() as cur:
            cur.execute(
                f"UPDATE lectures SET {set_clause} WHERE id = %s RETURNING id, title",
                values,
            )
            row = cur.fetchone()
        con.commit()

    if not row:
        return json.dumps({"error": "not found"})
    return json.dumps(dict(row), ensure_ascii=False)


@mcp.tool()
def move_lecture_to_course(lecture_id: str, target_course_id: str) -> str:
    """Move a single lecture to a different course."""
    with _conn() as con:
        with con.cursor() as cur:
            # Get max number in target course
            cur.execute(
                "SELECT COALESCE(MAX(number), 0) FROM lectures WHERE course_id = %s",
                (target_course_id,),
            )
            max_num = cur.fetchone()["coalesce"]
            cur.execute(
                "UPDATE lectures SET course_id = %s, number = %s WHERE id = %s RETURNING id, title, course_id",
                (target_course_id, max_num + 1, lecture_id),
            )
            row = cur.fetchone()
        con.commit()
    if not row:
        return json.dumps({"error": "lecture not found"})
    return json.dumps(dict(row), ensure_ascii=False)


@mcp.tool()
def bulk_move_lectures(lecture_ids: list, target_course_id: str) -> str:
    """Move multiple lectures to a different course."""
    if not lecture_ids:
        return json.dumps({"moved": 0})

    with _conn() as con:
        with con.cursor() as cur:
            cur.execute(
                "SELECT COALESCE(MAX(number), 0) FROM lectures WHERE course_id = %s",
                (target_course_id,),
            )
            base_num = cur.fetchone()["coalesce"]

            moved = 0
            for i, lid in enumerate(lecture_ids):
                cur.execute(
                    "UPDATE lectures SET course_id = %s, number = %s WHERE id = %s",
                    (target_course_id, base_num + i + 1, lid),
                )
                moved += cur.rowcount
        con.commit()
    return json.dumps({"moved": moved})


@mcp.tool()
def delete_lecture(lecture_id: str) -> str:
    """Delete a single lecture."""
    with _conn() as con:
        with con.cursor() as cur:
            cur.execute("DELETE FROM lectures WHERE id = %s RETURNING id, title", (lecture_id,))
            row = cur.fetchone()
        con.commit()
    if not row:
        return json.dumps({"error": "not found"})
    return json.dumps({"deleted": dict(row)}, ensure_ascii=False)


@mcp.tool()
def bulk_delete_lectures(lecture_ids: list) -> str:
    """Delete multiple lectures."""
    if not lecture_ids:
        return json.dumps({"deleted": 0})

    with _conn() as con:
        with con.cursor() as cur:
            cur.execute(
                "DELETE FROM lectures WHERE id = ANY(%s) RETURNING id",
                (lecture_ids,),
            )
            deleted = cur.rowcount
        con.commit()
    return json.dumps({"deleted": deleted})


# ---------------------------------------------------------------------------
# YouTube helpers
# ---------------------------------------------------------------------------

@mcp.tool()
def get_youtube_title(youtube_url: str) -> str:
    """Fetch a YouTube video title via yt-dlp (no API key needed)."""
    import subprocess
    try:
        result = subprocess.run(
            ["yt-dlp", "--get-title", "--no-playlist", youtube_url],
            capture_output=True, text=True, timeout=20,
        )
        title = result.stdout.strip()
        if not title:
            return json.dumps({"error": result.stderr.strip() or "empty title"})
        return json.dumps({"title": title})
    except FileNotFoundError:
        return json.dumps({"error": "yt-dlp not installed"})
    except subprocess.TimeoutExpired:
        return json.dumps({"error": "timeout fetching title"})


if __name__ == "__main__":
    mcp.run()
