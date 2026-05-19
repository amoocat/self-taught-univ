"""
크롤러 수동 트리거 API
- 개발/테스트 시 스케줄 기다리지 않고 즉시 실행
- 나중에 Airflow로 마이그레이션하면 이 엔드포인트 → Airflow trigger API로 교체
"""
from fastapi import APIRouter, BackgroundTasks
from app.crawlers.scheduler import (
    job_crawl_blogs,
    job_crawl_arxiv,
    job_crawl_youtube,
    job_seed_papers,
)
from app.db.session import AsyncSessionLocal
from app.db.seed import seed_courses

router = APIRouter()


@router.post("/blogs", status_code=202)
async def trigger_blog_crawl(bg: BackgroundTasks):
    """블로그 크롤링 즉시 실행"""
    bg.add_task(job_crawl_blogs)
    return {"message": "블로그 크롤링 시작됨 (백그라운드)"}


@router.post("/arxiv", status_code=202)
async def trigger_arxiv_crawl(bg: BackgroundTasks):
    """arXiv 논문 수집 즉시 실행"""
    bg.add_task(job_crawl_arxiv)
    return {"message": "arXiv 크롤링 시작됨 (백그라운드)"}


@router.post("/youtube", status_code=202)
async def trigger_youtube_crawl(bg: BackgroundTasks):
    """YouTube 강의 수집 즉시 실행"""
    bg.add_task(job_crawl_youtube)
    return {"message": "YouTube 크롤링 시작됨 (백그라운드)"}


@router.post("/seed", status_code=202)
async def trigger_seed(bg: BackgroundTasks):
    """저명 논문 초기 데이터 수집"""
    bg.add_task(job_seed_papers)
    return {"message": "논문 seed 시작됨 (백그라운드)"}


@router.post("/seed-courses", status_code=200)
async def trigger_seed_courses():
    """Course/Lecture 초기 데이터 삽입 (이미 있으면 스킵)"""
    async with AsyncSessionLocal() as db:
        result = await seed_courses(db)
    return {"message": f"Course {result['courses']}개, Lecture {result['lectures']}개 삽입 완료"}
