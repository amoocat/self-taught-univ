from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
import openai
import json

from app.db.session import get_db
from app.core.config import settings
from app.models.models import ChatSession, Paper, PaperAnnotation, Lecture, LectureNote
from app.core.errors import get_or_404
from app.core.prompts import STUDY_SYSTEM, TEST_SYSTEM, HINT_SYSTEM, PAPER_SYSTEM

router = APIRouter()
client = openai.AsyncOpenAI(api_key=settings.CHATGPT_API_KEY)


class SessionOut(BaseModel):
    session_id: str

class SaveMessagesOut(BaseModel):
    ok: bool


class ChatRequest(BaseModel):
    session_id: str | None = None
    mode: str = "study"
    subject: str = "선형대수학"
    message: str
    history: list[dict] = []


async def stream_gpt(messages: list[dict], system: str):
    stream = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "system", "content": system}] + messages,
        stream=True,
    )
    async for chunk in stream:
        text = chunk.choices[0].delta.content
        if text:
            yield f"data: {json.dumps({'text': text})}\n\n"
    yield "data: [DONE]\n\n"


@router.post("/stream")
async def chat_stream(body: ChatRequest, db: AsyncSession = Depends(get_db)):
    system = (STUDY_SYSTEM if body.mode == "study" else TEST_SYSTEM).format(
        subject=body.subject
    )
    messages = body.history + [{"role": "user", "content": body.message}]
    return StreamingResponse(
        stream_gpt(messages, system),
        media_type="text/event-stream",
    )


@router.post("/lecture/{lecture_id}/stream")
async def chat_lecture_hint(
    lecture_id: str,
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    lecture = await get_or_404(db, Lecture, lecture_id, "Lecture")
    note = (await db.execute(
        select(LectureNote).where(LectureNote.lecture_id == lecture_id)
    )).scalar_one_or_none()

    content = note.content_md[:4000] if note and note.content_md else "(강의 노트 없음)"
    system = HINT_SYSTEM.format(title=lecture.title, content=content)
    messages = body.history + [{"role": "user", "content": body.message}]
    return StreamingResponse(
        stream_gpt(messages, system),
        media_type="text/event-stream",
    )


@router.post("/paper/{paper_id}/stream")
async def chat_paper_stream(
    paper_id: str,
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    paper = await get_or_404(db, Paper, paper_id, "Paper")
    annotations = (await db.execute(
        select(PaperAnnotation).where(PaperAnnotation.paper_id == paper_id)
    )).scalars().all()

    ann_text = "\n".join(
        f"- {a.keyword}: {a.explanation}" for a in annotations
    ) or "(주석 없음 — 먼저 주석 생성 버튼을 눌러주세요)"

    system = PAPER_SYSTEM.format(
        title=paper.title,
        authors=paper.authors or "",
        abstract=paper.abstract[:3000] if paper.abstract else "(초록 없음)",
        annotations=ann_text,
    )
    messages = body.history + [{"role": "user", "content": body.message}]
    return StreamingResponse(
        stream_gpt(messages, system),
        media_type="text/event-stream",
    )


@router.post("/sessions", response_model=SessionOut)
async def create_session(
    mode: str = "study",
    subject: str = "선형대수학",
    db: AsyncSession = Depends(get_db),
):
    session = ChatSession(mode=mode, subject=subject)
    db.add(session)
    await db.flush()
    await db.refresh(session)
    return {"session_id": session.id}


@router.put("/sessions/{session_id}/messages", response_model=SaveMessagesOut)
async def save_messages(
    session_id: str,
    messages: list[dict],
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(ChatSession, session_id)
    if session:
        session.messages = messages
    return {"ok": True}
