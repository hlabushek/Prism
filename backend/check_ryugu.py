import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.cluster import StoryCluster
from app.models.article import Article

async def check_clusters():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(StoryCluster).where(StoryCluster.title.like("%Рюгу%")).order_by(StoryCluster.id.desc()))
        clusters = res.scalars().all()
        print(f"Found {len(clusters)} clusters mentioning Рюгу:")
        for c in clusters:
            print(f"\n--- Cluster #{c.id} (created_at: {c.created_at}, updated_at: {c.updated_at}) ---")
            print(f"Title: {c.title}")
            print(f"Summary: {c.summary[:120]}...")
            print(f"Article count: {c.article_count}, Sources count: {c.sources_count}")
            
            # Fetch articles in this cluster
            art_res = await db.execute(select(Article).where(Article.cluster_id == c.id))
            arts = art_res.scalars().all()
            print(f"Articles ({len(arts)}):")
            for a in arts:
                print(f"  - [{a.id}] (Source #{a.source_id}, pub_at: {a.published_at}) Title: '{a.title}'")
                print(f"    URL: {a.url}")

if __name__ == "__main__":
    asyncio.run(check_clusters())
