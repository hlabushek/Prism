import asyncio
import logging
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Set
from sqlalchemy import select, func, and_, delete, update
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.models.article import Article
from app.models.cluster import StoryCluster
from app.models.source import NewsSource
from app.services.cleaner import TextCleaner
from app.services.ai_service import ai_service
from app.services.pipeline import is_near_duplicate_text, cosine_sim

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("cleanup_duplicates")


async def run_cleanup():
    logger.info("Starting Database Deduplication & Cluster Merging Process...")

    async with AsyncSessionLocal() as db:
        # 1. Clean intra-source article duplicates
        logger.info("--- Step 1: Scanning articles for intra-source duplicates ---")
        sources_res = await db.execute(select(NewsSource))
        sources = sources_res.scalars().all()

        total_deleted_articles = 0

        for src in sources:
            arts_res = await db.execute(
                select(Article).where(Article.source_id == src.id).order_by(Article.published_at.desc())
            )
            arts = list(arts_res.scalars().all())
            if len(arts) < 2:
                continue

            deleted_ids = set()
            for i in range(len(arts)):
                a1 = arts[i]
                if a1.id in deleted_ids:
                    continue

                for j in range(i + 1, len(arts)):
                    a2 = arts[j]
                    if a2.id in deleted_ids:
                        continue

                    time_diff = abs((a1.published_at - a2.published_at).total_seconds()) if (a1.published_at and a2.published_at) else 0
                    if time_diff > 86400:
                        continue

                    is_dup = is_near_duplicate_text(a1.title, a2.title, a1.clean_content or "", a2.clean_content or "")
                    if not is_dup and a1.embedding and a2.embedding:
                        sim = cosine_sim(a1.embedding, a2.embedding)
                        if sim >= 0.85:
                            is_dup = True

                    if is_dup:
                        primary = a1 if (a1.cluster_id or len(a1.clean_content or "") >= len(a2.clean_content or "")) else a2
                        secondary = a2 if primary == a1 else a1

                        if not primary.media_url and secondary.media_url:
                            primary.media_url = secondary.media_url
                        if secondary.cluster_id and not primary.cluster_id:
                            primary.cluster_id = secondary.cluster_id

                        deleted_ids.add(secondary.id)
                        logger.info(f"Duplicate article in '{src.name}': keeping #{primary.id} ('{primary.title[:40]}...'), removing #{secondary.id}")

            if deleted_ids:
                for d_id in deleted_ids:
                    await db.execute(delete(Article).where(Article.id == d_id))
                await db.commit()
                total_deleted_articles += len(deleted_ids)

        logger.info(f"Step 1 Complete: Removed {total_deleted_articles} duplicate article records.")

        # 2. Merge duplicate StoryClusters
        logger.info("--- Step 2: Scanning StoryClusters for duplicates ---")
        clusters_res = await db.execute(
            select(StoryCluster).options(selectinload(StoryCluster.articles)).order_by(StoryCluster.created_at.asc())
        )
        clusters = list(clusters_res.scalars().all())
        logger.info(f"Total StoryClusters in database: {len(clusters)}")

        cluster_embeddings = {}
        for c in clusters:
            embed_text = f"{c.title}\n{c.title}\n\n{c.summary or ''}"
            cluster_embeddings[c.id] = await ai_service.get_embedding(embed_text)

        merged_cluster_ids = set()
        total_merged_clusters = 0

        for i in range(len(clusters)):
            c1 = clusters[i]
            if c1.id in merged_cluster_ids:
                continue

            for j in range(i + 1, len(clusters)):
                c2 = clusters[j]
                if c2.id in merged_cluster_ids:
                    continue

                sim = 0.0
                e1 = cluster_embeddings.get(c1.id)
                e2 = cluster_embeddings.get(c2.id)
                if e1 and e2:
                    sim = cosine_sim(e1, e2)

                text_dup = is_near_duplicate_text(c1.title, c2.title)

                if sim >= 0.52 or text_dup:
                    logger.info(f"Duplicate Clusters matched (sim={sim:.3f}): #{c1.id} ('{c1.title[:45]}...') vs #{c2.id} ('{c2.title[:45]}...')")

                    if c2.tg_channel_message_id and not c1.tg_channel_message_id:
                        primary, secondary = c2, c1
                    else:
                        primary, secondary = c1, c2

                    await db.execute(
                        update(Article).where(Article.cluster_id == secondary.id).values(cluster_id=primary.id)
                    )

                    p_media = list(primary.media or [])
                    s_media = list(secondary.media or [])
                    for m in s_media:
                        if not any(x.get("url") == m.get("url") for x in p_media):
                            p_media.append(m)
                    primary.media = p_media[:5]

                    merged_cluster_ids.add(secondary.id)
                    await db.execute(delete(StoryCluster).where(StoryCluster.id == secondary.id))
                    await db.commit()
                    total_merged_clusters += 1
                    logger.info(f"Merged cluster #{secondary.id} into #{primary.id} and deleted #{secondary.id}.")

        rem_res = await db.execute(select(StoryCluster).options(selectinload(StoryCluster.articles)))
        rem_clusters = rem_res.scalars().all()
        for cl in rem_clusters:
            cl.article_count = len(cl.articles)
            cl.sources_count = len(set(a.source_id for a in cl.articles if a.source_id))
        await db.commit()

        logger.info(f"Step 2 Complete: Merged and removed {total_merged_clusters} duplicate StoryClusters. Remaining clean clusters: {len(rem_clusters)}")

        from app.services.pipeline import news_pipeline
        await news_pipeline.recalculate_sources_rating(db)
        logger.info("Database Cleanup & Deduplication successfully completed!")


if __name__ == "__main__":
    asyncio.run(run_cleanup())
