import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from prometheus_fastapi_instrumentator import Instrumentator

from app.api.v1 import router as api_router
from app.core.config import settings
from app.core.errors import STUError, stu_error_handler
from app.crawlers.scheduler import init_scheduler, shutdown_scheduler
from app.db.seed import seed_courses
from app.db.session import AsyncSessionLocal


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with AsyncSessionLocal() as db:
        await seed_courses(db)
    init_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(
    title="Self-Taught University API",
    version="0.1.0",
    docs_url="/docs" if settings.DEBUG else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Instrumentator().instrument(app).expose(app)
app.add_exception_handler(STUError, stu_error_handler)

app.include_router(api_router, prefix="/api/v1")


@app.get("/healthz")
def health_check():
    return {"status": "ok"}


# SPA catch-all: 실제 파일이면 서빙, 아니면 index.html (클린 URL 지원)
@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    if full_path:
        static_file = os.path.join("frontend", full_path)
        if os.path.isfile(static_file):
            return FileResponse(static_file)
    return FileResponse("frontend/index.html")
