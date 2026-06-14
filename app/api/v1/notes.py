from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, model_validator
from datetime import datetime
import openai
import json
import logging

from app.db.session import get_db
from app.models.models import MyNote, GraphNode, GraphEdge
from app.core.errors import NotFoundError, get_or_404
from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

_gpt = openai.AsyncOpenAI(api_key=settings.CHATGPT_API_KEY)

_KEYWORD_PROMPT = """다음 노트의 제목과 내용을 읽고 핵심 개념/키워드 3~5개를 추출하세요.
각 키워드는 지식 그래프의 노드가 됩니다.

반드시 아래 JSON 배열 형식으로만 응답하세요 (다른 텍스트 없이):
[
  {{"keyword": "개념명", "category": "MATH|STATS|ML|DL|CV|NLP|ETC", "description": "한 줄 설명"}},
  ...
]

노트 제목: {title}
노트 내용: {content}"""


def _relative_time(dt: datetime) -> str:
    now = datetime.utcnow()
    diff = now - dt.replace(tzinfo=None) if dt.tzinfo else now - dt
    days = diff.days
    if days == 0:
        hours = diff.seconds // 3600
        if hours == 0:
            minutes = diff.seconds // 60
            return f"{minutes}분 전" if minutes > 0 else "방금"
        return f"{hours}시간 전"
    elif days < 7:
        return f"{days}일 전"
    elif days < 30:
        return f"{days // 7}주 전"
    elif days < 365:
        return f"{days // 30}달 전"
    else:
        return f"{days // 365}년 전"


class NoteCreate(BaseModel):
    title: str
    content_md: str = ""
    content: str = ""  # alias for content_md from frontend
    lecture_id: str | None = None
    tags: list[str] = []

    @model_validator(mode='after')
    def sync_content(self):
        if self.content and not self.content_md:
            self.content_md = self.content
        return self


class NoteUpdate(BaseModel):
    title: str | None = None
    content_md: str | None = None
    content: str | None = None  # alias for content_md
    tags: list[str] | None = None

    @model_validator(mode='after')
    def sync_content(self):
        if self.content is not None and self.content_md is None:
            self.content_md = self.content
        return self


class NoteOut(BaseModel):
    id: str
    title: str
    content_md: str
    content: str = ""
    lecture_id: str | None
    tags: list
    created_at: datetime
    updated_at: datetime
    updated: str = ""

    model_config = {"from_attributes": True}

    @model_validator(mode='after')
    def compute_extras(self):
        self.content = self.content_md
        self.updated = _relative_time(self.updated_at)
        return self


@router.get("/", response_model=list[NoteOut])
async def list_notes(
    q: str | None = None,
    lecture_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(MyNote).order_by(MyNote.updated_at.desc())
    if lecture_id:
        stmt = stmt.where(MyNote.lecture_id == lecture_id)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(MyNote.title.ilike(pattern) | MyNote.content_md.ilike(pattern))
    stmt = stmt.offset(offset).limit(limit)
    return (await db.execute(stmt)).scalars().all()


@router.get("/{note_id}", response_model=NoteOut)
async def get_note(note_id: str, db: AsyncSession = Depends(get_db)):
    return await get_or_404(db, MyNote, note_id, "Note")


_NOTE_FIELDS = {"title", "content_md", "lecture_id", "tags"}


async def _extract_and_save_graph_nodes(note_id: str, title: str, content: str):
    """노트 저장 후 GPT로 키워드 추출 → GraphNode 생성 (백그라운드)"""
    if not content.strip() or len(content) < 50:
        return
    try:
        resp = await _gpt.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": _KEYWORD_PROMPT.format(
                title=title,
                content=content[:2000],
            )}],
            temperature=0.3,
            max_tokens=600,
        )
        raw = resp.choices[0].message.content.strip()
        items: list[dict] = json.loads(raw)
    except Exception as e:
        logger.warning("keyword extraction failed for note %s: %s", note_id, e)
        return

    from app.db.session import async_session_factory
    async with async_session_factory() as db:
        node_ids = []
        for item in items:
            kw = item.get("keyword", "").strip()
            cat = item.get("category", "ETC").strip().upper()
            desc = item.get("description", "").strip()
            if not kw:
                continue

            # 같은 label의 노드가 없으면 생성
            existing = (await db.execute(
                select(GraphNode).where(GraphNode.label == kw)
            )).scalar_one_or_none()

            if existing:
                node_ids.append(existing.id)
            else:
                node = GraphNode(label=kw, category=cat, note_id=note_id, description=desc)
                db.add(node)
                await db.flush()
                node_ids.append(node.id)

        # 이번 노트에서 추출된 노드끼리 연결 (없는 엣지만)
        for i in range(len(node_ids)):
            for j in range(i + 1, len(node_ids)):
                src, tgt = node_ids[i], node_ids[j]
                exists = (await db.execute(
                    select(GraphEdge).where(
                        GraphEdge.source_id == src,
                        GraphEdge.target_id == tgt,
                    )
                )).scalar_one_or_none()
                if not exists:
                    db.add(GraphEdge(source_id=src, target_id=tgt, relation_type="co-occurs"))

        await db.commit()
        logger.info("graph nodes updated for note %s: %s", note_id, [item.get("keyword") for item in items])


@router.post("/", response_model=NoteOut, status_code=201)
async def create_note(
    body: NoteCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    note = MyNote(**{k: v for k, v in body.model_dump().items() if k in _NOTE_FIELDS})
    db.add(note)
    await db.commit()
    await db.refresh(note)

    if note.content_md:
        background_tasks.add_task(
            _extract_and_save_graph_nodes, note.id, note.title, note.content_md
        )

    return note


@router.put("/{note_id}", response_model=NoteOut)
async def update_note(
    note_id: str,
    body: NoteUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    note = await get_or_404(db, MyNote, note_id, "Note")
    for field, value in body.model_dump(exclude_none=True).items():
        if field == 'content':
            continue
        setattr(note, field, value)
    await db.commit()
    await db.refresh(note)

    if note.content_md:
        background_tasks.add_task(
            _extract_and_save_graph_nodes, note.id, note.title, note.content_md
        )

    return note


@router.delete("/{note_id}", status_code=204)
async def delete_note(note_id: str, db: AsyncSession = Depends(get_db)):
    note = await get_or_404(db, MyNote, note_id, "Note")
    await db.delete(note)
    await db.commit()
