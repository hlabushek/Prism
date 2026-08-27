import asyncio
from sqlalchemy import select, delete
from app.core.database import AsyncSessionLocal
from app.models.cluster import StoryCluster
from app.models.article import Article

async def cleanup():
    async with AsyncSessionLocal() as session:
        # Check cluster 129
        c129 = await session.get(StoryCluster, 129)
        if c129:
            print(f"Deleting duplicate empty cluster 129 (TG={c129.tg_channel_message_id})")
            await session.delete(c129)
            await session.commit()
            print("Cluster 129 deleted.")
        else:
            print("Cluster 129 not found.")

if __name__ == "__main__":
    asyncio.run(cleanup())
