from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from collections import defaultdict

from app.db.session import get_db
from app.models.models import GraphNode, GraphEdge

router = APIRouter()

_COLOR = {
    "MATH": "#0a1628",
    "STATS": "#884400",
    "STAT": "#884400",
    "ML": "#2a5a2a",
    "DL": "#2a5a2a",
    "OPT": "#884400",
    "CV": "#884400",
    "NLP": "#884400",
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
