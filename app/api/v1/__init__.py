from fastapi import APIRouter
from app.api.v1 import curriculum, notes, chat, crawl, papers, feed, graph

router = APIRouter()
router.include_router(curriculum.router, prefix="/curriculum", tags=["curriculum"])
router.include_router(notes.router, prefix="/notes", tags=["notes"])
router.include_router(chat.router, prefix="/chat", tags=["chat"])
router.include_router(crawl.router, prefix="/crawl", tags=["crawl"])
router.include_router(papers.router, prefix="/papers", tags=["papers"])
router.include_router(feed.router, prefix="/feed", tags=["feed"])
router.include_router(graph.router, prefix="/graph", tags=["graph"])
