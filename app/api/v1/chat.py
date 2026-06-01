from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
import openai
import json

from app.db.session import get_db
from app.core.config import settings
from app.models.models import ChatSession, Paper, PaperAnnotation, Lecture, LectureNote
from app.core.errors import get_or_404

router = APIRouter()
client = openai.AsyncOpenAI(api_key=settings.CHATGPT_API_KEY)


class SessionOut(BaseModel):
    session_id: str

class SaveMessagesOut(BaseModel):
    ok: bool

STUDY_SYSTEM = """
너는 STU(Self-Taught University)의 AI 학습 튜터야.
학생이 AI/ML 개념을 공부할 수 있도록 도와줘.
- 어려운 개념은 직관적인 비유와 예시로 설명해
- 수식이 필요하면 LaTeX 없이 텍스트로 표현해
- 모르는 걸 모른다고 하는 게 부끄럽지 않다고 격려해
- 한국어로 대화해
현재 진행 중인 과목: {subject}
"""

TEST_SYSTEM = """
너는 STU의 AI 시험관이야.
학생이 학습한 내용을 테스트하는 문제를 출제해.
- 한 번에 하나의 문제만 내
- 학생 답변을 채점하고 피드백을 줘
- 틀렸을 때는 힌트를 주되 바로 정답은 알려주지 마
- 한국어로 진행해
테스트 과목: {subject}
"""


HINT_SYSTEM = """
너는 STU의 강의 힌트 도우미야. 학생이 아래 강의를 수강하는 중이야.

강의 제목: {title}
강의 내용:
{content}

- 학생이 막히는 부분에 단계적인 힌트를 줘. 정답은 바로 알려주지 말고 스스로 이해할 수 있도록 유도해.
- 개념 설명이 필요하면 직관적인 비유와 코드 예시를 활용해.
- 강의 내용에 없는 질문이면 "이 강의 범위 밖이지만..." 이라고 먼저 말해줘.
- 한국어로 답해줘.
"""

PAPER_SYSTEM = """
너는 STU의 논문 독해 도우미야. 아래 논문을 학생과 함께 읽고 있어.

논문 제목: {title}
저자: {authors}
초록: {abstract}

핵심 키워드 & 설명:
{annotations}

- 학생의 질문에 이 논문 내용을 기반으로 한국어로 답해줘
- 초록에 없는 내용은 "이 초록에는 나와 있지 않지만..."이라고 명시해
- 배경 지식이 필요한 경우 간단히 보충 설명해줘
- 수식은 LaTeX 없이 텍스트로 표현해
"""


class ChatRequest(BaseModel):
    session_id: Optional[str] = None
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
