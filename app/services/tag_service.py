"""
강의/영상 태그 추출 서비스
- GPT-4o-mini로 제목+설명 → 핵심 태그 추출
- API 키 없으면 rule-based fallback
"""
import json
import logging
import openai

from app.core.config import settings

logger = logging.getLogger(__name__)

_STOPWORDS = {
    "and", "of", "the", "a", "an", "in", "for", "with", "to", "into",
    "via", "using", "from", "at", "by", "on", "is", "are", "how", "why",
    "what", "when", "part", "review", "quiz", "lecture", "introduction",
}

_client: openai.AsyncOpenAI | None = None


def _get_client() -> openai.AsyncOpenAI:
    global _client
    if _client is None:
        _client = openai.AsyncOpenAI(api_key=settings.CHATGPT_API_KEY)
    return _client


async def extract_tags(title: str, description: str = "", category: str = "") -> list[str]:
    """강의 제목/설명에서 태그 추출. GPT 실패 시 rule-based fallback."""
    if not settings.CHATGPT_API_KEY:
        return _rule_based(title, category)

    context = f"제목: {title}\n카테고리: {category}"
    if description:
        context += f"\n설명: {description[:400]}"

    prompt = (
        f"{context}\n\n"
        "위 강의의 핵심 개념·기술 태그를 영어 소문자로 최대 6개 추출해줘.\n"
        "JSON 배열만 응답. 예: [\"eigenvalues\", \"matrix decomposition\", \"linear algebra\"]"
    )

    try:
        resp = await _get_client().chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=120,
        )
        raw = resp.choices[0].message.content.strip()
        tags = json.loads(raw)
        if isinstance(tags, list):
            return [str(t).lower().strip() for t in tags if t][:6]
    except Exception as e:
        logger.warning(f"[TagService] GPT 실패 ({title[:40]}): {e}")

    return _rule_based(title, category)


async def extract_prerequisites(title: str, category: str = "") -> list[str]:
    """이 강의를 듣기 전에 알아야 할 선수 개념 추출. GPT 실패 시 빈 리스트."""
    if not settings.CHATGPT_API_KEY:
        return []

    prompt = (
        f"강의 제목: {title}\n카테고리: {category}\n\n"
        "이 강의를 이해하기 위해 미리 알아야 할 핵심 선수 개념을 한국어로 최대 4개 추출해줘.\n"
        "짧은 명사 형태로. JSON 배열만 응답.\n"
        "예: [\"행렬 연산\", \"편미분\", \"확률 기초\"]"
    )

    try:
        resp = await _get_client().chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=100,
        )
        raw = resp.choices[0].message.content.strip()
        result = json.loads(raw)
        if isinstance(result, list):
            return [str(r).strip() for r in result if r][:4]
    except Exception as e:
        logger.warning(f"[TagService] prerequisites GPT 실패 ({title[:40]}): {e}")

    return []


async def extract_all(
    title: str,
    description: str = "",
    category: str = "",
) -> dict:
    """tags + prerequisites 한 번에 추출 (API 호출 최소화)."""
    if not settings.CHATGPT_API_KEY:
        return {"tags": _rule_based(title, category), "prerequisites": []}

    context = f"제목: {title}\n카테고리: {category}"
    if description:
        context += f"\n설명: {description[:400]}"

    prompt = (
        f"{context}\n\n"
        "아래 두 가지를 JSON으로 응답해줘 (다른 텍스트 없이):\n"
        "1. tags: 핵심 개념·기술 태그 영어 소문자 최대 6개\n"
        "2. prerequisites: 이 강의 이해에 필요한 선수 개념 한국어 최대 4개\n\n"
        '예: {"tags": ["eigenvalues", "matrix decomposition"], "prerequisites": ["행렬 연산", "벡터 공간"]}'
    )

    try:
        resp = await _get_client().chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=200,
        )
        raw = resp.choices[0].message.content.strip()
        data = json.loads(raw)
        return {
            "tags":          [str(t).lower().strip() for t in data.get("tags", []) if t][:6],
            "prerequisites": [str(p).strip() for p in data.get("prerequisites", []) if p][:4],
        }
    except Exception as e:
        logger.warning(f"[TagService] extract_all GPT 실패 ({title[:40]}): {e}")

    return {"tags": _rule_based(title, category), "prerequisites": []}


def _rule_based(title: str, category: str) -> list[str]:
    words = title.lower().replace(":", " ").replace(",", " ").replace(";", " ").split()
    tags = [w for w in words if len(w) > 3 and w not in _STOPWORDS]
    seen: set[str] = set()
    result: list[str] = []
    if category:
        result.append(category)
        seen.add(category)
    for w in tags:
        if w not in seen:
            result.append(w)
            seen.add(w)
    return result[:6]
