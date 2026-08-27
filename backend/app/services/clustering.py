import logging
from datetime import datetime, timedelta
from typing import List, Optional
import numpy as np
from sqlalchemy import select, and_, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.article import Article
from app.models.cluster import StoryCluster
from app.core.config import settings

logger = logging.getLogger(__name__)


class ClusteringService:
    def __init__(self, similarity_threshold: float = None, lookback_hours: int = None):
        self._threshold = similarity_threshold
        self._lookback_hours = lookback_hours

    @property
    def threshold(self) -> float:
        return self._threshold or getattr(settings, "SIMILARITY_THRESHOLD", 0.52)

    @property
    def lookback_hours(self) -> int:
        return self._lookback_hours or getattr(settings, "LOOKBACK_HOURS", 48)

    async def find_matching_cluster(
        self,
        db: AsyncSession,
        article_embedding: List[float],
        cutoff_time: datetime
    ) -> Optional[int]:
        """
        Uses pgvector cosine distance `<=>` to find if any article in the last 24 hours
        is within the similarity threshold (cosine_distance <= 1 - threshold).
        Returns existing cluster_id if found, or None.
        """
        if not article_embedding:
            return None

        # Cosine distance cutoff (distance = 1 - similarity)
        max_distance = 1.0 - self.threshold

        if "postgresql" not in settings.DATABASE_URL:
            return await self._fallback_match_cluster(db, article_embedding, cutoff_time, max_distance)

        try:
            # PostgreSQL pgvector query for nearest article with existing ACTIVE cluster (created within update window)
            query = (
                select(Article.cluster_id, Article.embedding.cosine_distance(article_embedding).label("dist"))
                .join(StoryCluster, Article.cluster_id == StoryCluster.id)
                .where(
                    and_(
                        StoryCluster.created_at >= cutoff_time,
                        Article.cluster_id.isnot(None),
                        Article.embedding.isnot(None)
                    )
                )
                .order_by("dist")
                .limit(1)
            )

            result = await db.execute(query)
            row = result.first()

            if row and row.dist <= max_distance:
                logger.info(f"Matched article to active cluster #{row.cluster_id} (cosine distance: {row.dist:.3f})")
                return row.cluster_id

        except Exception as e:
            logger.warning(f"pgvector query fallback to Python cosine comparison: {e}")
            return await self._fallback_match_cluster(db, article_embedding, cutoff_time, max_distance)

        return None

    async def _fallback_match_cluster(
        self,
        db: AsyncSession,
        embedding: List[float],
        cutoff_time: datetime,
        max_distance: float
    ) -> Optional[int]:
        """Fallback in-memory cosine comparison if pgvector operator is unavailable."""
        query = (
            select(Article)
            .join(StoryCluster, Article.cluster_id == StoryCluster.id)
            .where(
                and_(
                    StoryCluster.created_at >= cutoff_time,
                    Article.cluster_id.isnot(None),
                    Article.embedding.isnot(None)
                )
            )
        )
        result = await db.execute(query)
        articles = result.scalars().all()

        target_vec = np.array(embedding, dtype=float)
        best_cluster_id = None
        min_dist = float("inf")

        for art in articles:
            if art.embedding is not None:
                art_vec = np.array(art.embedding, dtype=float)
                norm_prod = (np.linalg.norm(target_vec) * np.linalg.norm(art_vec))
                if norm_prod > 0:
                    cos_sim = np.dot(target_vec, art_vec) / norm_prod
                    cos_dist = 1.0 - cos_sim
                    if cos_dist <= max_distance and cos_dist < min_dist:
                        min_dist = cos_dist
                        best_cluster_id = art.cluster_id

        return best_cluster_id


clustering_service = ClusteringService()
