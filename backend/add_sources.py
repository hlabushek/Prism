import asyncio
import logging
from sqlalchemy import select
from app.core.database import AsyncSessionLocal, init_db
from app.models.source import NewsSource, FeedType, PoliticalCamp

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

NEW_OPPOSITION_SOURCES = [
    {
        "name": "ASTRA",
        "url": "https://t.me/astrapress",
        "feed_type": FeedType.TELEGRAM,
        "default_camp": PoliticalCamp.LIBERAL_OPPOSITION.value,
        "is_active": True
    },
    {
        "name": "RusNews",
        "url": "https://t.me/rusnews",
        "feed_type": FeedType.TELEGRAM,
        "default_camp": PoliticalCamp.LIBERAL_OPPOSITION.value,
        "is_active": True
    },
    {
        "name": "SVTV News",
        "url": "https://t.me/svtvnews",
        "feed_type": FeedType.TELEGRAM,
        "default_camp": PoliticalCamp.LIBERAL_OPPOSITION.value,
        "is_active": True
    },
    {
        "name": "SOTA",
        "url": "https://t.me/sotavisionmedia",
        "feed_type": FeedType.TELEGRAM,
        "default_camp": PoliticalCamp.LIBERAL_OPPOSITION.value,
        "is_active": True
    }
]


async def add_opposition_sources():
    """Adds or updates the 4 liberal-opposition Telegram channels in the database."""
    await init_db()
    
    async with AsyncSessionLocal() as session:
        added_count = 0
        for s in NEW_OPPOSITION_SOURCES:
            stmt = select(NewsSource).where(NewsSource.url == s["url"])
            result = await session.execute(stmt)
            existing = result.scalar_one_or_none()

            if not existing:
                source = NewsSource(
                    name=s["name"],
                    url=s["url"],
                    feed_type=s["feed_type"],
                    default_camp=s["default_camp"],
                    is_active=s["is_active"]
                )
                session.add(source)
                added_count += 1
                logger.info(f"Added source: {s['name']} ({s['url']}) [{s['default_camp']}]")
            else:
                existing.default_camp = s["default_camp"]
                existing.is_active = True
                logger.info(f"Source already exists (updated): {s['name']}")

        await session.commit()
        logger.info(f"Successfully finished adding sources. Newly created: {added_count}")


if __name__ == "__main__":
    asyncio.run(add_opposition_sources())
