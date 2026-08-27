import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.cluster import StoryCluster

async def find_frankenstein():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(StoryCluster))
        cls = res.scalars().all()
        found = []
        for c in cls:
            if "амулет" in c.title.lower() or "рюгу" in c.title.lower() or "находки" in c.title.lower():
                found.append(c)
                print(f"Cluster #{c.id}: '{c.title}'")
        print(f"Total found: {len(found)}")

if __name__ == "__main__":
    asyncio.run(find_frankenstein())
