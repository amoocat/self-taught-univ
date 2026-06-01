import json
import logging
import openai
from collections import defaultdict
from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Any

from app.core.config import settings
from app.db.session import get_db
from app.models.models import (
    Course, FeedItem, GraphEdge, GraphNode, Lecture, LectureNote, MyNote, Paper, Progress,
)

router = APIRouter()
logger = logging.getLogger(__name__)


class GraphNodeOut(BaseModel):
    id: str
    label: str
    connected: bool
    color: str
    r: int
    tag: str
    desc: str
    links: list[str]

class GraphOut(BaseModel):
    nodes: list[GraphNodeOut]
    edges: list[list[str]]

class CleanupOut(BaseModel):
    deleted: int

class FromLectureOut(BaseModel):
    created: int
    lecture: str = ""
    concepts: list[str] = []
    error: str = ""

class FromCourseOut(BaseModel):
    created: int
    lectures_processed: int
    results: list[dict]

class GenerateOut(BaseModel):
    created: int
    message: str

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


@router.get("/", response_model=GraphOut)
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


# 불용어 — 제목에 자주 나오지만 학문 개념이 아닌 것들
_STOPWORDS = {
    "the","a","an","of","in","and","or","with","for","to","by","on","at","is","are",
    "this","that","from","as","be","it","its","but","not","also","how","why",
    "what","which","when","where","who","math","lecture","quiz","review","final","course",
    "spring","fall","mit","stanford","kaist","part","chapter","episode","video","series",
    "18.06","cs229","cs231n","cs224n","intro","introduction","overview","explained","explain",
    "understanding","understand","fast","simple","easy","hard","deep","basic","advanced",
    "using","used","use","learn","learning","study","tutorial","guide","complete","full",
    "exp","let","get","set","new","old","all","any","some","more","less","very","just",
    "powers","found","given","based","called","known","said","made","used","done",
}

# 학문 개념으로 인정할 최소 단어 길이
_MIN_LEN = 4

def _extract_concepts_from_text(title: str, subtitle: str, module_name: str, cat: str) -> list[dict]:
    """GPT 없이 모듈명 우선, 제목에서 의미 있는 개념 추출 (fallback)."""
    import re
    result, seen = [], set()

    # 1. 모듈명이 있으면 최우선 사용 (·로 구분된 경우 분리)
    if module_name:
        for part in re.split(r"[·,/]", module_name):
            part = part.strip()
            if part and part.lower() not in seen:
                seen.add(part.lower())
                result.append({"label": part, "category": cat})

    # 2. 부제목에서 명사구 추출 (모듈명으로 부족할 때)
    if len(result) < 2 and subtitle:
        words = re.findall(r"[A-Z][A-Za-z\-]{3,}|[가-힣]{2,}", subtitle)
        for w in words:
            if w.lower() not in seen and w.lower() not in _STOPWORDS and len(w) >= _MIN_LEN:
                seen.add(w.lower())
                result.append({"label": w, "category": cat})
                if len(result) >= 4:
                    break

    # 3. 제목에서 대문자 시작 전문 용어만 추출 (마지막 수단)
    if len(result) < 2:
        words = re.findall(r"[A-Z][A-Za-z\-]{3,}|[가-힣]{2,}", title)
        for w in words:
            if w.lower() not in seen and w.lower() not in _STOPWORDS and len(w) >= _MIN_LEN:
                seen.add(w.lower())
                result.append({"label": w, "category": cat})
                if len(result) >= 4:
                    break

    return result[:4]


async def _extract_concepts_gpt(lecture: Lecture, cat: str) -> list[dict]:
    context = f"강의 제목: {lecture.title or ''}\n부제목: {lecture.subtitle or ''}\n모듈: {lecture.module_name or ''}"
    gpt = openai.AsyncOpenAI(api_key=settings.CHATGPT_API_KEY)
    prompt = (
        f"{context}\n\n"
        "위 강의에서 배우는 핵심 수학·AI·ML 개념 키워드를 3~5개 추출하세요.\n"
        "조건: 불용어·연도·강의번호 제외, 실제 학문 개념 중심, 영어 또는 한국어 가능\n"
        f"카테고리: {cat} 또는 하위 분류 (MATH/STATS/ML/DL/NLP/LLM/CV/OPT 중 하나)\n"
        '- JSON으로만 반환: {"concepts": [{"label": "개념명", "category": "카테고리"}]}'
    )
    resp = await gpt.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )
    return json.loads(resp.choices[0].message.content).get("concepts", [])[:5]


@router.post("/from-lecture/{lecture_id}", response_model=FromLectureOut)
async def add_nodes_from_lecture(lecture_id: str, db: AsyncSession = Depends(get_db)):
    """강의 완료 시 핵심 개념 3~5개를 그래프 노드로 등록합니다. GPT 실패 시 rule-based fallback."""
    lecture = (await db.execute(
        select(Lecture).where(Lecture.id == lecture_id)
    )).scalar_one_or_none()
    if not lecture:
        return {"created": 0}

    cat = (lecture.category or "ML").upper()

    # GPT 우선, 쿼터 초과 시 rule-based fallback
    try:
        concepts = await _extract_concepts_gpt(lecture, cat)
    except Exception as e:
        logger.warning("from-lecture GPT fallback (%s): %s", lecture.title, e)
        concepts = _extract_concepts_from_text(
            lecture.title or "", lecture.subtitle or "", lecture.module_name or "", cat
        )

    existing_labels = {
        r[0].lower()
        for r in (await db.execute(select(GraphNode.label))).all()
    }

    created = 0
    new_nodes = []
    for c in concepts:
        label = (c.get("label") or "").strip()
        node_cat = (c.get("category") or cat).upper()
        if not label or label.lower() in existing_labels:
            continue
        node = GraphNode(label=label, category=node_cat, has_content=True,
                         description=f"출처: {lecture.title}")
        db.add(node)
        new_nodes.append(node)
        existing_labels.add(label.lower())
        created += 1

    await db.flush()

    # 같은 강의에서 나온 노드끼리 chain 연결
    for i in range(len(new_nodes) - 1):
        db.add(GraphEdge(source_id=new_nodes[i].id, target_id=new_nodes[i + 1].id))

    await db.commit()
    return {"created": created, "lecture": lecture.title, "concepts": [n.label for n in new_nodes]}


@router.delete("/nodes/cleanup", response_model=CleanupOut)
async def cleanup_auto_nodes(db: AsyncSession = Depends(get_db)):
    """note_id 없는 자동생성 노드와 연결된 엣지를 전부 삭제합니다."""
    auto_node_ids = (await db.execute(
        select(GraphNode.id).where(GraphNode.note_id.is_(None))
    )).scalars().all()

    if auto_node_ids:
        await db.execute(
            delete(GraphEdge).where(
                GraphEdge.source_id.in_(auto_node_ids) | GraphEdge.target_id.in_(auto_node_ids)
            )
        )
        await db.execute(delete(GraphNode).where(GraphNode.note_id.is_(None)))

    await db.commit()
    return {"deleted": len(auto_node_ids)}


@router.post("/from-course/{course_id}/completed", response_model=FromCourseOut)
async def add_nodes_from_completed_lectures(course_id: str, db: AsyncSession = Depends(get_db)):
    """강좌의 완료된 강의들에서 GPT로 개념 노드를 일괄 생성합니다."""
    completed_ids = (await db.execute(
        select(Progress.lecture_id).where(Progress.course_id == course_id)
    )).scalars().all()

    if not completed_ids:
        return {"created": 0, "message": "완료된 강의가 없습니다."}

    total_created = 0
    results = []
    for lecture_id in completed_ids:
        # 개별 from-lecture 로직 재사용 (내부 호출)
        lecture = (await db.execute(
            select(Lecture).where(Lecture.id == lecture_id)
        )).scalar_one_or_none()
        if not lecture:
            continue

        cat = (lecture.category or "ML").upper()
        try:
            concepts = await _extract_concepts_gpt(lecture, cat)
        except Exception as e:
            logger.warning("from-course GPT fallback (%s): %s", lecture.title, e)
            concepts = _extract_concepts_from_text(
                lecture.title or "", lecture.subtitle or "", lecture.module_name or "", cat
            )

        existing_labels = {
            r[0].lower()
            for r in (await db.execute(select(GraphNode.label))).all()
        }

        new_nodes = []
        for c in concepts:
            label = (c.get("label") or "").strip()
            node_cat = (c.get("category") or cat).upper()
            if not label or label.lower() in existing_labels:
                continue
            node = GraphNode(label=label, category=node_cat, has_content=True,
                             description=f"출처: {lecture.title}")
            db.add(node)
            new_nodes.append(node)
            existing_labels.add(label.lower())
            total_created += 1

        await db.flush()
        for i in range(len(new_nodes) - 1):
            db.add(GraphEdge(source_id=new_nodes[i].id, target_id=new_nodes[i + 1].id))

        if new_nodes:
            results.append({"lecture": lecture.title, "concepts": [n.label for n in new_nodes]})

    await db.commit()
    return {"created": total_created, "lectures_processed": len(results), "results": results}


@router.post("/generate", response_model=GenerateOut)
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
