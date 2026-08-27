import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.cluster import StoryCluster

async def run():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(StoryCluster).order_by(StoryCluster.id.desc()).limit(10))
        clusters = res.scalars().all()
        for c in clusters:
            print(f"ID: {c.id} | Title: {c.title} | TG: {c.tg_channel_message_id}")
            print(f"Summary: {c.summary[:100]}...")
            print("-" * 40)

if __name__ == "__main__":
    asyncio.run(run())
