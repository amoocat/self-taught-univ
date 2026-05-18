from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import openai
import json
import logging

from app.db.session import get_db
from app.models.models import Paper, PaperAnnotation
from app.core.errors import get_or_404, BadRequestError
from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

_gpt = openai.AsyncOpenAI(api_key=settings.CHATGPT_API_KEY)

_ANNOTATE_PROMPT = """다음 논문의 제목과 초록을 읽고, 독자가 논문을 이해하는 데 필요한 핵심 개념 5~7개를 추출하세요.
각 개념에 대해 이 논문에서 어떤 맥락으로 등장하는지 2~3문장으로 한국어로 설명해주세요.

반드시 아래 JSON 배열 형식으로만 응답하세요 (다른 텍스트 없이):
[
  {{"keyword": "개념명", "explanation": "설명"}},
  ...
]

논문 제목: {title}
저자: {authors}
초록: {abstract}"""


class AnnotationOut(BaseModel):
    id: str
    keyword: str
    explanation: str

    class Config:
        from_attributes = True


class PaperOut(BaseModel):
    id: str
    title: str
    authors: str
    year: int
    venue: Optional[str]
    abstract: Optional[str]
    arxiv_id: Optional[str]
    created_at: datetime
    annotations: list[AnnotationOut] = []

    class Config:
        from_attributes = True


@router.get("/", response_model=list[PaperOut])
async def list_papers(
    q: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    papers = (await db.execute(
        select(Paper).order_by(Paper.year.desc(), Paper.created_at.desc())
    )).scalars().all()

    if q:
        q_lower = q.lower()
        papers = [
            p for p in papers
            if q_lower in p.title.lower()
            or q_lower in (p.authors or "").lower()
            or q_lower in (p.abstract or "").lower()
        ]

    result = []
    for p in papers:
        anns = (await db.execute(
            select(PaperAnnotation).where(PaperAnnotation.paper_id == p.id)
        )).scalars().all()
        out = PaperOut.model_validate(p)
        out.annotations = [AnnotationOut.model_validate(a) for a in anns]
        result.append(out)
    return result


@router.get("/{paper_id}", response_model=PaperOut)
async def get_paper(paper_id: str, db: AsyncSession = Depends(get_db)):
    paper = await get_or_404(db, Paper, paper_id, "Paper")
    anns = (await db.execute(
        select(PaperAnnotation).where(PaperAnnotation.paper_id == paper_id)
    )).scalars().all()
    out = PaperOut.model_validate(paper)
    out.annotations = [AnnotationOut.model_validate(a) for a in anns]
    return out


@router.post("/{paper_id}/annotate", response_model=list[AnnotationOut])
async def annotate_paper(
    paper_id: str,
    db: AsyncSession = Depends(get_db),
):
    paper = await get_or_404(db, Paper, paper_id, "Paper")

    if not paper.abstract:
        raise BadRequestError("초록이 없는 논문은 주석을 생성할 수 없습니다.")

    # 기존 주석 삭제 후 재생성
    existing = (await db.execute(
        select(PaperAnnotation).where(PaperAnnotation.paper_id == paper_id)
    )).scalars().all()
    for ann in existing:
        await db.delete(ann)

    prompt = _ANNOTATE_PROMPT.format(
        title=paper.title,
        authors=paper.authors,
        abstract=paper.abstract[:3000],
    )

    try:
        resp = await _gpt.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=1500,
        )
        raw = resp.choices[0].message.content.strip()
        items: list[dict] = json.loads(raw)
    except json.JSONDecodeError:
        raise BadRequestError("GPT 응답 파싱 실패 — 다시 시도해주세요.")
    except Exception as e:
        logger.error("annotate_paper GPT error: %s", e)
        raise BadRequestError("GPT 호출 실패")

    annotations = []
    for item in items:
        kw = item.get("keyword", "").strip()
        ex = item.get("explanation", "").strip()
        if not kw or not ex:
            continue
        ann = PaperAnnotation(paper_id=paper_id, keyword=kw, explanation=ex)
        db.add(ann)
        annotations.append(ann)

    await db.commit()
    for ann in annotations:
        await db.refresh(ann)

    return [AnnotationOut.model_validate(a) for a in annotations]
