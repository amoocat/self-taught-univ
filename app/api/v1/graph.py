import json
import logging
import openai
from collections import defaultdict
from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.session import get_db
from app.models.models import (
    Course, FeedItem, GraphEdge, GraphNode, Lecture, LectureNote, MyNote, Paper,
)

router = APIRouter()
logger = logging.getLogger(__name__)

_COLOR = {
    "MATH": "#0a1628",
    "STATS": "#884400",
    "STAT":  "#884400",
    "ML":   "#2a5a2a",
    "DL":   "#2a5a2a",
    "OPT":  "#884400",
    "CV":   "#884400",
    "NLP":  "#884400",
    "LLM":  "#6a0a6a",
}


@router.get("/")
async def get_graph(db: AsyncSession = Depends(get_db)):
    nodes = (await db.execute(select(GraphNode))).scalars().all()
    edges = (await db.execute(select(GraphEdge))).scalars().all()

    node_labels: dict[str, str] = {n.id: n.label for n in nodes}
    outgoing: dict[str, list[str]] = defaultdict(list)
    degree: dict[str, int] = defaultdict(int)

    for e in edges:
        outgoing[e.source_id].append(e.target_id)
        degree[e.source_id] += 1
        degree[e.target_id] += 1

    return {
        "nodes": [
            {
                "id": n.id,
                "label": n.label,
                "connected": n.has_content or degree[n.id] > 0,
                "color": _COLOR.get(n.category.upper(), "#666666"),
                "r": min(32, max(14, 14 + degree[n.id] * 3)),
                "tag": n.category.upper(),
                "desc": n.description or "",
                "links": [node_labels.get(tid, tid) for tid in outgoing[n.id]],
            }
            for n in nodes
        ],
        "edges": [[e.source_id, e.target_id] for e in edges],
    }


@router.post("/generate")
async def generate_concept_nodes(db: AsyncSession = Depends(get_db)):
    """강좌 목록을 GPT가 읽고 핵심 개념 노드 최대 50개를 생성합니다."""
    # 강좌 + 강의 수집
    courses = (
        await db.execute(select(Course).options(selectinload(Course.lectures)))
    ).scalars().all()

    course_lines = []
    for c in courses:
        sample = [l.title for l in c.lectures[:15]]
        if sample:
            course_lines.append(f"[{c.category}] {c.title}: {', '.join(sample)}")

    if not course_lines:
        return {"created": 0, "message": "강좌 데이터가 없습니다."}

    # GPT 호출
    gpt = openai.AsyncOpenAI(api_key=settings.CHATGPT_API_KEY)
    prompt = (
        "아래는 AI/ML 자기주도 학습 플랫폼의 강좌 및 강의 목록입니다.\n\n"
        + "\n".join(course_lines)
        + "\n\n"
        "위 강의들을 기반으로 핵심 개념 키워드 상위 50개를 추출해주세요.\n"
        "조건:\n"
        "- 불용어·조사·일반동사 제외\n"
        "- ML/DL/NLP/수학/통계 등 기술 개념 중심\n"
        "- 영어 또는 한국어 혼용 가능\n"
        "- 각 개념의 카테고리도 포함 (MATH, STATS, ML, DL, NLP, LLM, CV, OPT 중 하나)\n"
        '- JSON으로만 반환: {"concepts": [{"label": "개념명", "category": "카테고리"}]}'
    )

    try:
        resp = await gpt.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )
        raw = json.loads(resp.choices[0].message.content)
        concepts = raw.get("concepts", [])[:50]
    except Exception as e:
        logger.error("Graph generate GPT error: %s", e)
        return {"created": 0, "message": f"GPT 오류: {e}"}

    # 연결 여부 판단 — 콘텐츠 전체 텍스트에서 키워드 검색
    notes = (await db.execute(select(MyNote.title, MyNote.content_md))).all()
    lnotes = (await db.execute(select(LectureNote.content_md))).all()
    papers = (await db.execute(select(Paper.title, Paper.abstract))).all()
    feeds = (await db.execute(select(FeedItem.title, FeedItem.summary))).all()
    lectures = (await db.execute(
        select(Lecture.title, Lecture.subtitle, Lecture.tags)
    )).all()

    all_text = " ".join([
        f"{r.title or ''} {r.content_md or ''}" for r in notes
    ] + [r.content_md or "" for r in lnotes
    ] + [f"{r.title or ''} {r.abstract or ''}" for r in papers
    ] + [f"{r.title or ''} {r.summary or ''}" for r in feeds
    ] + [f"{r.title or ''} {r.subtitle or ''} {' '.join(r.tags or [])}" for r in lectures
    ]).lower()

    # note_id가 없는 기존 자동생성 노드 전체 삭제
    await db.execute(delete(GraphNode).where(GraphNode.note_id.is_(None)))

    created = 0
    for c in concepts:
        label = (c.get("label") or "").strip()
        cat = (c.get("category") or "ML").upper()
        if not label:
            continue
        has_content = label.lower() in all_text
        db.add(GraphNode(label=label, category=cat, has_content=has_content))
        created += 1

    await db.commit()
    return {"created": created, "message": f"{created}개의 개념 노드가 생성되었습니다."}
