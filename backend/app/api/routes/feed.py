import logging
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException, BackgroundTasks
from sqlalchemy import select, func, and_, or_, not_, desc, cast, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db, AsyncSessionLocal
from app.models.cluster import StoryCluster
from app.models.article import Article
from app.models.source import NewsSource
from app.models.social import Comment, Favorite, Reaction
from app.schemas.feed import FeedResponse, StoryClusterResponse, ArticleSnippet, ReactionSummarySchema, MediaItemSchema, TimelineEventSchema
from app.api.routes.auth import get_current_user_optional
from app.models.user import User
from app.services.pipeline import news_pipeline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/feed", tags=["Feed"])


@router.get("", response_model=FeedResponse)
async def get_feed(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=50, description="Items per page"),
    sentiment: Optional[str] = Query(None, description="Sentiment filter: 'positive_only', 'negative_only', 'neutral', or 'all'"),
    category: Optional[str] = Query(None, description="Category filter (e.g. 'Политика', 'Экономика', 'Технологии', or 'all')"),
    political_vector: Optional[str] = Query(None, description="Filter by political camp presence"),
    source_ids: Optional[str] = Query(None, description="Comma-separated list of source IDs"),
    search: Optional[str] = Query(None, description="Search query"),
    sort_by: Optional[str] = Query("latest", description="Sort by: 'latest', 'importance', 'consensus', 'polarization', 'comments'"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """
    Returns paginated AI story cards with filtering by sentiment, category, political camp, sources, keywords, and flexible sorting.
    """
    filters = []

    # 1. Category filter
    if category and category != "all":
        filters.append(StoryCluster.category.ilike(f"%{category.strip()}%"))

    # 2. Sentiment filter
    if sentiment and sentiment != "all":
        if sentiment == "positive_only":
            filters.append(StoryCluster.sentiment >= 0.15)
        elif sentiment == "negative_only":
            filters.append(StoryCluster.sentiment <= -0.15)
        elif sentiment == "neutral":
            filters.append(and_(StoryCluster.sentiment > -0.15, StoryCluster.sentiment < 0.15))

    # 3. Search query in title, summary, or verified facts
    if search and search.strip():
        search_term = f"%{search.strip()}%"
        filters.append(
            or_(
                StoryCluster.title.ilike(search_term),
                StoryCluster.summary.ilike(search_term),
                cast(StoryCluster.verified_facts, String).ilike(search_term)
            )
        )

    # 4. Political vector filtering (checks that specified camp is present with active position / tone != 'нет данных')
    if political_vector and political_vector != "all":
        camp_term = political_vector.strip()
        filters.append(
            and_(
                cast(StoryCluster.political_vectors, String).ilike(f"%{camp_term}%"),
                not_(cast(StoryCluster.political_vectors, String).ilike(f"%{camp_term}%нет данных%"))
            )
        )

    # 5. Source IDs filter at SQL level
    if source_ids and source_ids.strip():
        target_ids = [int(s.strip()) for s in source_ids.split(",") if s.strip().isdigit()]
        if target_ids:
            filters.append(StoryCluster.articles.any(Article.source_id.in_(target_ids)))

    # Base query for count
    count_query = select(func.count(StoryCluster.id))
    if filters:
        count_query = count_query.where(and_(*filters))
    
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Dynamic order by
    offset = (page - 1) * page_size

    if sort_by == "comments":
        comment_subq = (
            select(Comment.cluster_id, func.count(Comment.id).label("comment_cnt"))
            .group_by(Comment.cluster_id)
            .subquery()
        )
        query = (
            select(StoryCluster)
            .outerjoin(comment_subq, StoryCluster.id == comment_subq.c.cluster_id)
            .options(selectinload(StoryCluster.articles).selectinload(Article.source))
            .order_by(desc(func.coalesce(comment_subq.c.comment_cnt, 0)), desc(StoryCluster.created_at))
            .offset(offset)
            .limit(page_size)
        )
    else:
        order_clause = [desc(StoryCluster.created_at)]
        if sort_by == "importance":
            order_clause = [desc(StoryCluster.sources_count), desc(StoryCluster.created_at)]
        elif sort_by == "consensus":
            order_clause = [desc(StoryCluster.consensus_score), desc(StoryCluster.created_at)]
        elif sort_by == "polarization":
            order_clause = [desc(StoryCluster.polarization_score), desc(StoryCluster.created_at)]
        elif sort_by == "latest":
            order_clause = [desc(StoryCluster.created_at)]

        query = (
            select(StoryCluster)
            .options(selectinload(StoryCluster.articles).selectinload(Article.source))
            .order_by(*order_clause)
            .offset(offset)
            .limit(page_size)
        )

    if filters:
        query = query.where(and_(*filters))

    result = await db.execute(query)
    clusters = result.scalars().all()

    cluster_ids = [c.id for c in clusters]

    # Pre-fetch real comments counts
    comments_counts = {}
    if cluster_ids:
        c_res = await db.execute(
            select(Comment.cluster_id, func.count(Comment.id))
            .where(Comment.cluster_id.in_(cluster_ids))
            .group_by(Comment.cluster_id)
        )
        for row in c_res.all():
            comments_counts[row[0]] = row[1]

    # Pre-fetch real reactions
    reactions_map = {}
    user_reactions_map = {}
    if cluster_ids:
        r_res = await db.execute(
            select(Reaction.cluster_id, Reaction.reaction_type, func.count(Reaction.id))
            .where(Reaction.cluster_id.in_(cluster_ids))
            .group_by(Reaction.cluster_id, Reaction.reaction_type)
        )
        for row in r_res.all():
            cid, rtype, cnt = row[0], row[1], row[2]
            if cid not in reactions_map:
                reactions_map[cid] = {"like": 0, "thumb_up": 0, "objective": 0, "fire": 0, "fact": 0}
            if rtype in reactions_map[cid]:
                reactions_map[cid][rtype] = cnt

        if current_user:
            ur_res = await db.execute(
                select(Reaction.cluster_id, Reaction.reaction_type)
                .where(and_(Reaction.cluster_id.in_(cluster_ids), Reaction.user_id == current_user.id))
            )
            for row in ur_res.all():
                user_reactions_map[row[0]] = row[1]

    # Pre-fetch real user favorites
    user_favorites = set()
    if cluster_ids and current_user:
        f_res = await db.execute(
            select(Favorite.cluster_id)
            .where(and_(Favorite.cluster_id.in_(cluster_ids), Favorite.user_id == current_user.id))
        )
        for row in f_res.all():
            user_favorites.add(row[0])

    # Format response items
    items: List[StoryClusterResponse] = []
    for c in clusters:
        article_snippets = [
            ArticleSnippet(
                id=art.id,
                title=art.title,
                url=art.url,
                source_name=art.source.name if art.source else None,
                published_at=art.published_at
            )
            for art in (c.articles or [])
        ]

        r_counts = reactions_map.get(c.id, {"like": 0, "thumb_up": 0, "objective": 0, "fire": 0, "fact": 0})
        reaction_summary = ReactionSummarySchema(
            like=r_counts.get("like", 0),
            thumb_up=r_counts.get("thumb_up", 0),
            objective=r_counts.get("objective", 0),
            fire=r_counts.get("fire", 0),
            fact=r_counts.get("fact", 0),
            user_reaction=user_reactions_map.get(c.id)
        )

        # Ensure media is parsed as MediaItemSchema list
        raw_media = c.media or []
        media_list = []
        if isinstance(raw_media, list):
            for m in raw_media:
                if isinstance(m, dict) and m.get("url"):
                    media_list.append(MediaItemSchema(
                        type=m.get("type", "image"),
                        url=m["url"],
                        caption=m.get("caption"),
                        source_name=m.get("source_name")
                    ))

        raw_timeline = c.timeline or []
        timeline_list = []
        if isinstance(raw_timeline, list):
            for t in raw_timeline:
                if isinstance(t, dict) and t.get("title"):
                    timeline_list.append(TimelineEventSchema(
                        time=t.get("time", ""),
                        title=t.get("title", ""),
                        description=t.get("description", "")
                    ))

        items.append(
            StoryClusterResponse(
                id=c.id,
                title=c.title,
                summary=c.summary,
                sentiment=c.sentiment,
                category=c.category or "Политика",
                consensus_score=c.consensus_score if c.consensus_score is not None else 80,
                polarization_score=c.polarization_score if c.polarization_score is not None else 30,
                media=media_list,
                timeline=timeline_list,
                political_vectors=c.political_vectors or [],
                quotes=c.quotes or [],
                verified_facts=c.verified_facts or [],
                blindspots=c.blindspots or [],
                article_count=c.article_count or len(c.articles or []),
                sources_count=c.sources_count or 1,
                created_at=c.created_at,
                updated_at=c.updated_at,
                articles=article_snippets,
                comments_count=comments_counts.get(c.id, 0),
                reactions=reaction_summary,
                is_favorite=(c.id in user_favorites)
            )
        )

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return FeedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        server_time=datetime.now(timezone.utc)
    )


@router.get("/{cluster_id}", response_model=StoryClusterResponse)
async def get_cluster_by_id(
    cluster_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Fetches a single story cluster by ID with full media and real social metrics."""
    query = (
        select(StoryCluster)
        .options(selectinload(StoryCluster.articles).selectinload(Article.source))
        .where(StoryCluster.id == cluster_id)
    )
    result = await db.execute(query)
    c = result.scalar_one_or_none()

    if not c:
        raise HTTPException(status_code=404, detail="Story cluster not found")

    article_snippets = [
        ArticleSnippet(
            id=art.id,
            title=art.title,
            url=art.url,
            source_name=art.source.name if art.source else None,
            published_at=art.published_at
        )
        for art in (c.articles or [])
    ]

    # Real comments count
    c_res = await db.execute(
        select(func.count(Comment.id)).where(Comment.cluster_id == c.id)
    )
    comments_count = c_res.scalar() or 0

    # Real reactions count
    r_counts = {"like": 0, "thumb_up": 0, "objective": 0, "fire": 0, "fact": 0}
    r_res = await db.execute(
        select(Reaction.reaction_type, func.count(Reaction.id))
        .where(Reaction.cluster_id == c.id)
        .group_by(Reaction.reaction_type)
    )
    for row in r_res.all():
        if row[0] in r_counts:
            r_counts[row[0]] = row[1]

    user_reaction = None
    is_fav = False
    if current_user:
        ur_res = await db.execute(
            select(Reaction.reaction_type).where(
                and_(Reaction.cluster_id == c.id, Reaction.user_id == current_user.id)
            )
        )
        user_reaction = ur_res.scalar_one_or_none()

        fav_res = await db.execute(
            select(Favorite.id).where(
                and_(Favorite.cluster_id == c.id, Favorite.user_id == current_user.id)
            )
        )
        is_fav = fav_res.scalar_one_or_none() is not None

    reaction_summary = ReactionSummarySchema(
        like=r_counts.get("like", 0),
        thumb_up=r_counts.get("thumb_up", 0),
        objective=r_counts.get("objective", 0),
        fire=r_counts.get("fire", 0),
        fact=r_counts.get("fact", 0),
        user_reaction=user_reaction
    )

    raw_media = c.media or []
    media_list = [
        MediaItemSchema(type=m.get("type", "image"), url=m["url"], caption=m.get("caption"), source_name=m.get("source_name"))
        for m in raw_media if isinstance(m, dict) and m.get("url")
    ]

    raw_timeline = c.timeline or []
    timeline_list = [
        TimelineEventSchema(time=t.get("time", ""), title=t.get("title", ""), description=t.get("description", ""))
        for t in raw_timeline if isinstance(t, dict) and t.get("title")
    ]

    return StoryClusterResponse(
        id=c.id,
        title=c.title,
        summary=c.summary,
        sentiment=c.sentiment,
        category=c.category or "Политика",
        consensus_score=c.consensus_score if c.consensus_score is not None else 80,
        polarization_score=c.polarization_score if c.polarization_score is not None else 30,
        media=media_list,
        timeline=timeline_list,
        political_vectors=c.political_vectors or [],
        quotes=c.quotes or [],
        verified_facts=c.verified_facts or [],
        blindspots=c.blindspots or [],
        article_count=c.article_count or len(c.articles or []),
        sources_count=c.sources_count or 1,
        created_at=c.created_at,
        updated_at=c.updated_at,
        articles=article_snippets,
        comments_count=comments_count,
        reactions=reaction_summary,
        is_favorite=is_fav
    )


@router.post("/trigger-sync")
@router.post("/sync")
async def trigger_manual_sync(background_tasks: BackgroundTasks):
    """Manually triggers an immediate news ingestion, vectorization, and LLM clustering cycle."""
    async def run_sync_task():
        async with AsyncSessionLocal() as session:
            try:
                await news_pipeline.run_ingestion_and_vectorization(session)
                await news_pipeline.run_clustering_and_analysis(session)
            except Exception as e:
                logger.error(f"Error in manual sync task: {e}")

    background_tasks.add_task(run_sync_task)
    return {"status": "sync_triggered", "message": "Manual pipeline sync initiated in background."}
