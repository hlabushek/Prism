import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.cluster import StoryCluster
from app.models.article import Article

async def cleanup_server_db():
    print("Connecting to the database to remove bad clusters...")
    async with AsyncSessionLocal() as db:
        query = select(StoryCluster).where(StoryCluster.summary.like("%Произошло согласование основных параметров%"))
        result = await db.execute(query)
        bad_clusters = result.scalars().all()
        
        if not bad_clusters:
            print("No bad clusters found in the database. (They might have already been deleted or you are querying the wrong database).")
            return
            
        print(f"Found {len(bad_clusters)} bad clusters. Deleting...")
        for cluster in bad_clusters:
            # Unlink articles
            arts_res = await db.execute(select(Article).where(Article.cluster_id == cluster.id))
            arts = arts_res.scalars().all()
            for art in arts:
                art.cluster_id = None
            
            # Delete cluster
            await db.delete(cluster)
            print(f"Deleted cluster #{cluster.id} ('{cluster.title}')")
            
        await db.commit()
        print("Database cleanup complete. The unlinked articles will be re-processed correctly on the next pipeline run.")

if __name__ == "__main__":
    asyncio.run(cleanup_server_db())
