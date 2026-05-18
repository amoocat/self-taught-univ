"""
arXiv 논문 크롤러
- arXiv API (무료, 키 불필요)
- AI/ML 관련 최신 논문 수집
- Semantic Scholar API로 인용 수 보강 (선택)
"""
import httpx
import logging
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

ARXIV_API = "https://export.arxiv.org/api/query"

# 수집할 카테고리 + 검색어
ARXIV_QUERIES = [
    # 카테고리 기반
    {"query": "cat:cs.LG",  "label": "Machine Learning"},
    {"query": "cat:cs.AI",  "label": "AI"},
    {"query": "cat:cs.CL",  "label": "NLP"},
    {"query": "cat:cs.CV",  "label": "Computer Vision"},
    # 저명 논문 키워드
    {"query": "ti:transformer AND cat:cs.LG", "label": "Transformer"},
    {"query": "ti:diffusion AND cat:cs.CV",   "label": "Diffusion"},
    {"query": "ti:llm OR ti:large language",  "label": "LLM"},
]

# 수동 등록할 저명 논문 arXiv ID (항상 수집)
MUST_HAVE_PAPERS = [
    "1706.03762",  # Attention Is All You Need
    "2005.14165",  # GPT-3
    "2010.11929",  # ViT
    "2006.11239",  # DDPM (Diffusion)
    "2307.09288",  # Llama 2
    "2302.13971",  # LLaMA
    "1810.04805",  # BERT
    "2304.01196",  # Instruction Tuning survey
]


@dataclass
class ArxivPaper:
    arxiv_id: str
    title: str
    authors: str
    abstract: str
    published_at: datetime
    categories: list[str] = field(default_factory=list)
    pdf_url: str = ""
    label: str = ""     # 어떤 쿼리에서 수집됐는지


class ArxivCrawler:

    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30)

    async def fetch_recent(
        self,
        days_back: int = 7,
        max_per_query: int = 20,
    ) -> list[ArxivPaper]:
        """최근 N일 논문 수집"""
        papers: dict[str, ArxivPaper] = {}

        for q in ARXIV_QUERIES:
            try:
                new = await self._query(
                    search_query=q["query"],
                    max_results=max_per_query,
                    label=q["label"],
                )
                cutoff = datetime.utcnow() - timedelta(days=days_back)
                for p in new:
                    if p.published_at >= cutoff and p.arxiv_id not in papers:
                        papers[p.arxiv_id] = p
                logger.info(f"[arXiv] {q['label']}: {len(new)}개 수집")
            except Exception as e:
                logger.warning(f"[arXiv] {q['query']} 실패: {e}")

        return list(papers.values())

    async def fetch_must_have(self) -> list[ArxivPaper]:
        """저명 논문 목록 수집"""
        try:
            params = {
                "id_list":    ",".join(MUST_HAVE_PAPERS),
                "max_results": len(MUST_HAVE_PAPERS),
            }
            resp = await self.client.get(ARXIV_API, params=params)
            resp.raise_for_status()
            papers = _parse_arxiv_xml(resp.text, "must-have")
            logger.info(f"[arXiv] 저명 논문 {len(papers)}개 수집")
            return papers
        except Exception as e:
            logger.error(f"[arXiv] 저명 논문 수집 실패: {e}")
            return []

    async def _query(
        self,
        search_query: str,
        max_results: int = 20,
        label: str = "",
    ) -> list[ArxivPaper]:
        params = {
            "search_query": search_query,
            "max_results":  max_results,
            "sortBy":       "submittedDate",
            "sortOrder":    "descending",
        }
        resp = await self.client.get(ARXIV_API, params=params)
        resp.raise_for_status()
        return _parse_arxiv_xml(resp.text, label)

    async def close(self):
        await self.client.aclose()


def _parse_arxiv_xml(xml_text: str, label: str) -> list[ArxivPaper]:
    NS = {
        "atom":  "http://www.w3.org/2005/Atom",
        "arxiv": "http://arxiv.org/schemas/atom",
    }
    root    = ET.fromstring(xml_text)
    papers  = []

    for entry in root.findall("atom:entry", NS):
        # arXiv ID 추출 (예: http://arxiv.org/abs/1706.03762v5 → 1706.03762)
        id_url  = entry.findtext("atom:id", "", NS)
        arxiv_id = id_url.split("/abs/")[-1].split("v")[0]

        title   = (entry.findtext("atom:title", "", NS) or "").strip().replace("\n", " ")
        abstract = (entry.findtext("atom:summary", "", NS) or "").strip().replace("\n", " ")[:1000]

        authors = ", ".join(
            a.findtext("atom:name", "", NS)
            for a in entry.findall("atom:author", NS)
        )[:500]

        published_str = entry.findtext("atom:published", "", NS)
        try:
            published_at = datetime.fromisoformat(published_str.replace("Z", "+00:00"))
            published_at = published_at.replace(tzinfo=None)
        except Exception:
            published_at = datetime.utcnow()

        categories = [
            t.get("term", "")
            for t in entry.findall("atom:category", NS)
        ]

        pdf_url = ""
        for link in entry.findall("atom:link", NS):
            if link.get("type") == "application/pdf":
                pdf_url = link.get("href", "")
                break

        papers.append(ArxivPaper(
            arxiv_id=arxiv_id,
            title=title,
            authors=authors,
            abstract=abstract,
            published_at=published_at,
            categories=categories,
            pdf_url=pdf_url,
            label=label,
        ))

    return papers
