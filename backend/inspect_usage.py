import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.ai_usage import AITokenUsage
from app.models.cluster import StoryCluster

async def inspect():
    async with AsyncSessionLocal() as session:
        print("=== AI TOKEN USAGE (story_synthesis) ===")
        res = await session.execute(
            select(AITokenUsage).where(AITokenUsage.stage == "story_synthesis").order_by(AITokenUsage.id.desc()).limit(15)
        )
        usages = res.scalars().all()
        for u in usages:
            print(f"Usage #{u.id}: Model={u.model_name} | TotalToks={u.total_tokens} | Cost={u.estimated_cost_rub} | At={u.created_at}")

        print("\n=== LATEST STORY CLUSTERS IN DB ===")
        c_res = await session.execute(
            select(StoryCluster).order_by(StoryCluster.id.desc()).limit(10)
        )
        clusters = c_res.scalars().all()
        for c in clusters:
            print(f"Cluster #{c.id}: TG={c.tg_channel_message_id} | Score={c.importance_score} | Articles={c.article_count} | Title={c.title}")

if __name__ == "__main__":
    asyncio.run(inspect())
