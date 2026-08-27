import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.cluster import StoryCluster
from app.models.article import Article

async def check():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(StoryCluster).order_by(StoryCluster.id.desc()).limit(5))
        clusters = res.scalars().all()
        for c in clusters:
            print(f"Cluster ID={c.id} | TG={c.tg_channel_message_id} | Created={c.created_at} | Score={c.importance_score} | Title={c.title}")
            art_res = await session.execute(select(Article.id, Article.title, Article.source_id, Article.created_at).where(Article.cluster_id == c.id))
            for a in art_res.all():
                print(f"   -> Art {a[0]} (src {a[2]}, at {a[3]}): {a[1]}")

if __name__ == "__main__":
    asyncio.run(check())
