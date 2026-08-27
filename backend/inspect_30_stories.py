import asyncio
import logging
import numpy as np
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from app.core.database import AsyncSessionLocal
from app.models.cluster import StoryCluster
from app.services.ai_service import ai_service
from app.services.pipeline import cosine_sim

logging.basicConfig(level=logging.INFO)

async def check_30():
    async with AsyncSessionLocal() as db:
        res = await db.execute(
            select(StoryCluster)
            .options(selectinload(StoryCluster.articles))
            .order_by(desc(StoryCluster.created_at))
            .limit(30)
        )
        clusters = res.scalars().all()
        print(f"================================================================================")
        print(f"LOADED {len(clusters)} MOST RECENT ACTIVE STORIES (CLUSTERS):")
        print(f"================================================================================\n")

        for i, c in enumerate(clusters, 1):
            src_names = list({a.source.name for a in c.articles if a.source}) if c.articles else []
            tg_info = f"TG Msg #{c.tg_channel_message_id}" if c.tg_channel_message_id else "Not on TG"
            print(f"[{i:02d}] ID: #{c.id:<3} | {c.created_at.strftime('%d.%m %H:%M')} | {c.category:<10} | {tg_info:<12} | Sources: {len(src_names)} ({', '.join(src_names[:3])})")
            print(f"     Title: {c.title}")
            print(f"     Lead:  {(c.summary or '')[:130]}...")
            print()

        print(f"================================================================================")
        print(f"PAIRWISE SEMANTIC COMPARISON AMONG ALL 30 ACTIVE STORIES (CANDIDATE MATRIX):")
        print(f"================================================================================\n")

        embeddings = {}
        for c in clusters:
            embed_text = f"{c.title}\n{c.title}\n\n{c.summary or ''}"
            embeddings[c.id] = await ai_service.get_embedding(embed_text)

        high_sim_pairs = []
        for i in range(len(clusters)):
            for j in range(i + 1, len(clusters)):
                c1 = clusters[i]
                c2 = clusters[j]
                e1 = embeddings.get(c1.id)
                e2 = embeddings.get(c2.id)
                if e1 and e2:
                    sim = cosine_sim(e1, e2)
                    if sim >= 0.35:
                        high_sim_pairs.append((sim, c1, c2, i+1, j+1))

        high_sim_pairs.sort(key=lambda x: x[0], reverse=True)
        if not high_sim_pairs:
            print(">>> EXCELLENT: All 30 stories are 100% distinct! (Zero pairs with similarity >= 0.35)")
        else:
            print(f"Pairs with similarity >= 0.35 (highest similarities between any two stories):\n")
            for sim, c1, c2, idx1, idx2 in high_sim_pairs:
                print(f"  Similarity: {sim:.3f} ({sim*100:.1f}%) | Story [{idx1:02d}] #{c1.id} vs Story [{idx2:02d}] #{c2.id}")
                print(f"    - [{idx1:02d}] #{c1.id}: {c1.title}")
                print(f"    - [{idx2:02d}] #{c2.id}: {c2.title}")
                print()

if __name__ == "__main__":
    asyncio.run(check_30())
