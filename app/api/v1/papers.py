from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import openai
import httpx
import json
import re
import logging
import xml.etree.ElementTree as ET

from app.db.session import get_db
from app.models.models import Paper, PaperAnnotation
from app.core.errors import get_or_404, BadRequestError, ConflictError
from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


def _paper_to_out(paper: Paper, annotations: list | None = None) -> "PaperOut":
    """Paper ORM → PaperOut 변환. 관계 속성 접근 없이 명시적으로 필드 설정."""
    return PaperOut(
        id=str(paper.id),
        title=paper.title,
        authors=paper.authors or "",
        year=paper.year,
        venue=paper.venue,
        abstract=paper.abstract,
        arxiv_id=paper.arxiv_id,
        category=getattr(paper, "category", None),
        created_at=paper.created_at,
        annotations=[AnnotationOut.model_validate(a) for a in (annotations or [])],
    )

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
    category: Optional[str] = None
    created_at: datetime
    annotations: list[AnnotationOut] = []

    class Config:
        from_attributes = True


_ARXIV_NS = "http://www.w3.org/2005/Atom"


def _normalize_arxiv_id(raw: str) -> str:
    """URL이나 앞뒤 공백 포함한 입력에서 arXiv ID만 추출."""
    raw = raw.strip()
    # https://arxiv.org/abs/2312.12345 또는 https://arxiv.org/pdf/2312.12345
    m = re.search(r"arxiv\.org/(?:abs|pdf)/([^\s?#]+)", raw)
    if m:
        return m.group(1).removesuffix(".pdf")
    return raw


class AddPaperIn(BaseModel):
    arxiv_id: str


@router.post("/", response_model=PaperOut, status_code=201)
async def add_paper(body: AddPaperIn, db: AsyncSession = Depends(get_db)):
    arxiv_id = _normalize_arxiv_id(body.arxiv_id)
    if not arxiv_id:
        raise BadRequestError("arXiv ID를 입력해주세요.")

    # 중복 체크
    existing = (await db.execute(
        select(Paper).where(Paper.arxiv_id == arxiv_id)
    )).scalar_one_or_none()
    if existing:
        raise ConflictError(f"이미 추가된 논문입니다: {arxiv_id}")

    # arXiv Atom API 호출
    url = f"https://export.arxiv.org/api/query?id_list={arxiv_id}&max_results=1"
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(url)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            logger.error("arXiv API error: %s", e)
            raise BadRequestError("arXiv 서버에 연결할 수 없습니다.")

    root = ET.fromstring(resp.text)
    entry = root.find(f"{{{_ARXIV_NS}}}entry")
    if entry is None:
        raise BadRequestError(f"arXiv에서 논문을 찾을 수 없습니다: {arxiv_id}")

    title_el = entry.find(f"{{{_ARXIV_NS}}}title")
    abstract_el = entry.find(f"{{{_ARXIV_NS}}}summary")
    published_el = entry.find(f"{{{_ARXIV_NS}}}published")

    title = " ".join((title_el.text or "").split()) if title_el is not None else "Unknown"
    abstract = (abstract_el.text or "").strip() if abstract_el is not None else None
    year = int(published_el.text[:4]) if published_el is not None and published_el.text else 0

    # 저자 목록
    authors = ", ".join(
        (a.find(f"{{{_ARXIV_NS}}}name").text or "").strip()
        for a in entry.findall(f"{{{_ARXIV_NS}}}author")
        if a.find(f"{{{_ARXIV_NS}}}name") is not None
    )

    # 카테고리 (arXiv primary_category)
    cat_ns = "http://arxiv.org/schemas/atom"
    cat_el = entry.find(f"{{{cat_ns}}}primary_category")
    venue = cat_el.attrib.get("term") if cat_el is not None else None

    paper = Paper(
        title=title,
        authors=authors or "Unknown",
        year=year,
        venue=venue,
        abstract=abstract,
        arxiv_id=arxiv_id,
    )
    db.add(paper)
    await db.commit()
    await db.refresh(paper)

    return _paper_to_out(paper, annotations=[])


@router.delete("/{paper_id}", status_code=204)
async def delete_paper(paper_id: str, db: AsyncSession = Depends(get_db)):
    paper = await get_or_404(db, Paper, paper_id, "Paper")
    await db.delete(paper)
    await db.commit()


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
        result.append(_paper_to_out(p, annotations=list(anns)))
    return result


@router.get("/{paper_id}", response_model=PaperOut)
async def get_paper(paper_id: str, db: AsyncSession = Depends(get_db)):
    paper = await get_or_404(db, Paper, paper_id, "Paper")
    anns = (await db.execute(
        select(PaperAnnotation).where(PaperAnnotation.paper_id == paper_id)
    )).scalars().all()
    return _paper_to_out(paper, annotations=list(anns))


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
