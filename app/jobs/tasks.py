from celery import Celery
from celery.schedules import crontab
import feedparser
from datetime import datetime

from app.core.config import settings

celery_app = Celery("stu", broker=settings.REDIS_URL, backend=settings.REDIS_URL)

celery_app.conf.beat_schedule = {
    "crawl-feeds-daily": {
        "task": "app.jobs.tasks.crawl_all_feeds",
        "schedule": crontab(hour=3, minute=0),
    },
}

RSS_SOURCES = [
    {"name": "Andrej Karpathy",   "type": "personal", "url": "https://karpathy.github.io/feed.xml"},
    {"name": "Sebastian Ruder",   "type": "personal", "url": "https://ruder.io/rss/index.rss"},
    {"name": "Chip Huyen",        "type": "personal", "url": "https://huyenchip.com/feed.xml"},
    {"name": "Google AI Blog",    "type": "bigtech",  "url": "https://blog.research.google/feeds/posts/default"},
    {"name": "DeepMind Blog",     "type": "bigtech",  "url": "https://deepmind.google/blog/rss.xml"},
    {"name": "OpenAI Blog",       "type": "bigtech",  "url": "https://openai.com/blog/rss/"},
    {"name": "Uber Engineering",  "type": "bigtech",  "url": "https://www.uber.com/en-KR/blog/engineering/rss/"},
    {"name": "Airbnb Tech",       "type": "bigtech",  "url": "https://medium.com/feed/airbnb-engineering"},
    {"name": "당근 Tech",         "type": "korean",   "url": "https://medium.com/feed/daangn"},
    {"name": "카카오 Tech",       "type": "korean",   "url": "https://tech.kakao.com/feed/"},
    {"name": "네이버 Tech",       "type": "korean",   "url": "https://d2.naver.com/d2.atom"},
    {"name": "LINE Engineering",  "type": "korean",   "url": "https://engineering.linecorp.com/ko/feed"},
    {"name": "토스 Tech",         "type": "korean",   "url": "https://toss.tech/rss.xml"},
]


@celery_app.task(name="app.jobs.tasks.crawl_all_feeds")
def crawl_all_feeds():
    from app.db.session import AsyncSessionLocal
    from app.models.models import FeedItem
    from sqlalchemy import select
    import asyncio

    async def _run():
        async with AsyncSessionLocal() as db:
            for source in RSS_SOURCES:
                try:
                    feed = feedparser.parse(source["url"])
                    for entry in feed.entries[:10]:
                        exists = (await db.execute(
                            select(FeedItem).where(FeedItem.url == entry.get("link", ""))
                        )).scalar_one_or_none()

                        if not exists and entry.get("link"):
                            item = FeedItem(
                                source_name=source["name"],
                                source_type=source["type"],
                                title=entry.get("title", "")[:500],
                                url=entry.get("link", "")[:1000],
                                summary=entry.get("summary", "")[:2000],
                                published_at=datetime(*entry.published_parsed[:6])
                                    if hasattr(entry, "published_parsed") and entry.published_parsed
                                    else None,
                            )
                            db.add(item)
                    await db.commit()
                except Exception as e:
                    print(f"[RSS] {source['name']} 수집 실패: {e}")

    asyncio.run(_run())


@celery_app.task(name="app.jobs.tasks.generate_embedding")
def generate_embedding(note_id: str):
    import asyncio

    async def _run():
        from app.db.session import AsyncSessionLocal
        from app.models.models import MyNote, NoteEmbedding
        import openai

        client = openai.AsyncOpenAI(api_key=settings.CHATGPT_API_KEY)

        async with AsyncSessionLocal() as db:
            note = await db.get(MyNote, note_id)
            if not note:
                return

            response = await client.embeddings.create(
                model="text-embedding-3-small",
                input=(note.title + " " + note.content_md)[:8000],
            )
            vector = response.data[0].embedding

            existing = await db.get(NoteEmbedding, note_id)
            if existing:
                existing.embedding = vector
            else:
                db.add(NoteEmbedding(note_id=note_id, embedding=vector))
            await db.commit()
            print(f"[Embedding] note_id={note_id} done")

    asyncio.run(_run())
