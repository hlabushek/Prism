import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.cluster import StoryCluster
from app.models.article import Article

async def check_all_recent():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(StoryCluster).order_by(StoryCluster.id.desc()).limit(20))
        clusters = res.scalars().all()
        print(f"Recent {len(clusters)} clusters in DB:")
        for c in clusters:
            print(f"[{c.id}] Title: '{c.title}' (articles={c.article_count}, sources={c.sources_count})")
            
        # Check articles with "амулет" or "Рюгу" or "Турци"
        arts_res = await db.execute(select(Article).where(Article.title.like("%амулет%") | Article.title.like("%Рюгу%") | Article.title.like("%Турци%")))
        arts = arts_res.scalars().all()
        print(f"\nArticles matching keywords ({len(arts)}):")
        for a in arts:
            print(f"  - [{a.id}] (cluster_id={a.cluster_id}) Title: '{a.title}'")

if __name__ == "__main__":
    asyncio.run(check_all_recent())
