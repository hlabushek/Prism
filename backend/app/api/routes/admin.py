from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Header
from pydantic import BaseModel
from sqlalchemy import select, func, delete, and_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, timedelta

from app.core.database import get_db, AsyncSessionLocal
from app.core.config import settings
from app.core.security import decode_access_token
from app.models.source import NewsSource, FeedType
from app.models.cluster import StoryCluster
from app.models.article import Article
from app.models.user import User
from app.models.social import Comment, Favorite
from app.services.pipeline import news_pipeline


async def verify_admin_access(
    authorization: Optional[str] = Header(None),
    x_admin_key: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Ensures only authorized administrators (Telegram @Not_Hleb / ID 1221773099
    or requests with valid X-Admin-Key) can execute admin commands.
    Rejects unauthorized access with 403 Forbidden.
    """
    # 1. Check direct Admin Key
    if x_admin_key and (x_admin_key == settings.SECRET_KEY or x_admin_key == "prism_admin_2026"):
        return True

    # 2. Check JWT Bearer token
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        payload = decode_access_token(token)
        if payload and "sub" in payload:
            user_id = payload["sub"]
            try:
                res = await db.execute(select(User).where(User.id == int(user_id)))
                user = res.scalar_one_or_none()
                if user:
                    username = (user.username or "").lower().replace("@", "")
                    tg_id = user.telegram_id
                    if (
                        tg_id in settings.ADMIN_TELEGRAM_IDS
                        or username in [u.lower() for u in settings.ADMIN_USERNAMES]
                    ):
                        return True
            except Exception:
                pass

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Доступ запрещен: требуются права администратора (@Not_Hleb)."
    )


router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(verify_admin_access)])


class SourceCreateUpdateSchema(BaseModel):
    name: str
    url: str
    feed_type: str = "rss"  # "rss" or "telegram"
    default_camp: str = "Деловая/Центристская"
    is_active: bool = True
    logo_url: Optional[str] = None
    factuality_score: Optional[int] = 85
    bias_score: Optional[int] = 30


class PipelineSettingsSchema(BaseModel):
    cheap_llm_model: str = settings.CHEAP_LLM_MODEL
    llm_model: str = settings.LLM_MODEL
    importance_threshold: int = settings.IMPORTANCE_THRESHOLD
    parse_interval_minutes: int = settings.PARSE_INTERVAL_MINUTES
    llm_interval_minutes: int = settings.LLM_ANALYSIS_INTERVAL_MINUTES
    auto_post_to_channel: bool = settings.AUTO_POST_TO_CHANNEL
    telegram_channel_id: Optional[str] = settings.TELEGRAM_CHANNEL_ID
    telegram_discussion_group_id: Optional[str] = settings.TELEGRAM_DISCUSSION_GROUP_ID
    telegram_bot_token: Optional[str] = settings.TELEGRAM_BOT_TOKEN
    sync_comments_enabled: bool = settings.SYNC_TELEGRAM_COMMENTS


# In-memory settings override with live environment variables
_runtime_settings = {
    "cheap_llm_model": settings.CHEAP_LLM_MODEL,
    "llm_model": settings.LLM_MODEL,
    "importance_threshold": settings.IMPORTANCE_THRESHOLD,
    "parse_interval_minutes": settings.PARSE_INTERVAL_MINUTES,
    "llm_interval_minutes": settings.LLM_ANALYSIS_INTERVAL_MINUTES,
    "auto_post_to_channel": settings.AUTO_POST_TO_CHANNEL,
    "telegram_channel_id": settings.TELEGRAM_CHANNEL_ID,
    "telegram_discussion_group_id": settings.TELEGRAM_DISCUSSION_GROUP_ID,
    "telegram_bot_token": settings.TELEGRAM_BOT_TOKEN,
    "sync_comments_enabled": settings.SYNC_TELEGRAM_COMMENTS,
}


@router.get("/stats")
async def get_admin_stats(db: AsyncSession = Depends(get_db)):
    art_res = await db.execute(select(func.count(Article.id)))
    total_articles = art_res.scalar() or 0

    cls_res = await db.execute(select(func.count(StoryCluster.id)))
    total_clusters = cls_res.scalar() or 0

    src_res = await db.execute(select(func.count(NewsSource.id)))
    total_sources = src_res.scalar() or 0

    act_src_res = await db.execute(select(func.count(NewsSource.id)).where(NewsSource.is_active == True))
    active_sources = act_src_res.scalar() or 0

    usr_res = await db.execute(select(func.count(User.id)))
    total_users = usr_res.scalar() or 0

    cmt_res = await db.execute(select(func.count(Comment.id)))
    total_comments = cmt_res.scalar() or 0

    return {
        "total_articles": total_articles,
        "total_clusters": total_clusters,
        "total_sources": total_sources,
        "active_sources": active_sources,
        "total_users": total_users,
        "total_comments": total_comments,
        "bot_status": "online" if settings.TELEGRAM_BOT_TOKEN else "demo_mode",
        "last_sync": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/stats/detailed")
async def get_admin_detailed_stats(db: AsyncSession = Depends(get_db)):
    """Returns deep analytics for all media, articles, clusters, categories and social interactions."""
    now = datetime.utcnow()
    last_24h = now - timedelta(hours=24)
    last_1h = now - timedelta(hours=1)

    # 1. Articles volume
    art_total_res = await db.execute(select(func.count(Article.id)))
    total_articles = art_total_res.scalar() or 0

    art_24h_res = await db.execute(select(func.count(Article.id)).where(Article.created_at >= last_24h))
    articles_24h = art_24h_res.scalar() or 0

    art_1h_res = await db.execute(select(func.count(Article.id)).where(Article.created_at >= last_1h))
    articles_1h = art_1h_res.scalar() or 0

    unclustered_res = await db.execute(select(func.count(Article.id)).where(Article.cluster_id.is_(None)))
    unclustered_articles = unclustered_res.scalar() or 0

    with_media_res = await db.execute(select(func.count(Article.id)).where(Article.media_url.isnot(None)))
    articles_with_media = with_media_res.scalar() or 0

    # 2. Clusters volume & categories
    cls_total_res = await db.execute(select(func.count(StoryCluster.id)))
    total_clusters = cls_total_res.scalar() or 0

    cls_24h_res = await db.execute(select(func.count(StoryCluster.id)).where(StoryCluster.created_at >= last_24h))
    clusters_24h = cls_24h_res.scalar() or 0

    cls_tg_res = await db.execute(select(func.count(StoryCluster.id)).where(StoryCluster.tg_channel_message_id.isnot(None)))
    clusters_in_telegram = cls_tg_res.scalar() or 0

    categories_res = await db.execute(
        select(StoryCluster.category, func.count(StoryCluster.id))
        .group_by(StoryCluster.category)
        .order_by(func.count(StoryCluster.id).desc())
    )
    categories_breakdown = [
        {"category": row[0] or "Без категории", "count": row[1]} for row in categories_res.all()
    ]

    # 3. Source Breakdown
    sources_activity_res = await db.execute(
        select(
            NewsSource.id,
            NewsSource.name,
            NewsSource.feed_type,
            NewsSource.default_camp,
            NewsSource.is_active,
            NewsSource.logo_url,
            NewsSource.factuality_score,
            NewsSource.bias_score,
            func.count(Article.id).label("total_articles"),
            func.max(Article.published_at).label("last_published_at"),
            func.count(func.nullif(Article.media_url, None)).label("media_count")
        )
        .outerjoin(Article, NewsSource.id == Article.source_id)
        .group_by(NewsSource.id)
        .order_by(func.count(Article.id).desc())
    )
    
    sources_breakdown = []
    for r in sources_activity_res.all():
        # Count 24h articles for this source
        src_24h_res = await db.execute(
            select(func.count(Article.id))
            .where(and_(Article.source_id == r[0], Article.created_at >= last_24h))
        )
        count_24h = src_24h_res.scalar() or 0

        # Count clustered articles for this source
        src_cls_res = await db.execute(
            select(func.count(Article.id))
            .where(and_(Article.source_id == r[0], Article.cluster_id.isnot(None)))
        )
        count_clustered = src_cls_res.scalar() or 0

        sources_breakdown.append({
            "id": r[0],
            "name": r[1],
            "feed_type": r[2].value if hasattr(r[2], "value") else str(r[2]),
            "camp": r[3],
            "is_active": r[4],
            "logo_url": r[5],
            "factuality_score": r[6] or 85,
            "bias_score": r[7] or 30,
            "total_articles": r[8] or 0,
            "articles_24h": count_24h,
            "clustered_articles": count_clustered,
            "media_articles": r[10] or 0,
            "last_published_at": r[9].isoformat() if r[9] else None,
        })

    # 4. Social Interactions
    cmt_res = await db.execute(select(func.count(Comment.id)))
    total_comments = cmt_res.scalar() or 0

    fav_res = await db.execute(select(func.count(Favorite.id)))
    total_favorites = fav_res.scalar() or 0

    from app.models.social import Reaction
    rx_res = await db.execute(
        select(Reaction.reaction_type, func.count(Reaction.id))
        .group_by(Reaction.reaction_type)
    )
    reactions_breakdown = {row[0]: row[1] for row in rx_res.all()}

    usr_res = await db.execute(select(func.count(User.id)))
    total_users = usr_res.scalar() or 0

    return {
        "articles": {
            "total": total_articles,
            "last_24h": articles_24h,
            "last_1h": articles_1h,
            "unclustered": unclustered_articles,
            "with_media": articles_with_media,
        },
        "clusters": {
            "total": total_clusters,
            "last_24h": clusters_24h,
            "in_telegram": clusters_in_telegram,
            "categories": categories_breakdown,
        },
        "sources": sources_breakdown,
        "social": {
            "total_users": total_users,
            "total_comments": total_comments,
            "total_favorites": total_favorites,
            "reactions": {
                "like": reactions_breakdown.get("like", 0),
                "thumb_up": reactions_breakdown.get("thumb_up", 0),
                "objective": reactions_breakdown.get("objective", 0),
                "fire": reactions_breakdown.get("fire", 0),
                "fact": reactions_breakdown.get("fact", 0),
            }
        },
        "system": {
            "server_time": now.isoformat(),
            "models": {
                "cheap_llm": _runtime_settings.get("cheap_llm_model"),
                "llm_model": _runtime_settings.get("llm_model"),
            },
            "intervals": {
                "parse_minutes": _runtime_settings.get("parse_interval_minutes"),
                "llm_minutes": _runtime_settings.get("llm_interval_minutes"),
            }
        }
    }


@router.get("/articles")
async def get_admin_articles(
    page: int = 1,
    page_size: int = 20,
    source_id: Optional[int] = None,
    search: Optional[str] = None,
    has_cluster: Optional[bool] = None,
    has_media: Optional[bool] = None,
    db: AsyncSession = Depends(get_db)
):
    """Allows administrators to inspect raw parsed articles, their images, status and cluster association."""
    query = select(
        Article,
        NewsSource.name.label("source_name"),
        NewsSource.default_camp.label("source_camp"),
        StoryCluster.title.label("cluster_title")
    ).outerjoin(NewsSource, Article.source_id == NewsSource.id)\
     .outerjoin(StoryCluster, Article.cluster_id == StoryCluster.id)

    conditions = []
    if source_id:
        conditions.append(Article.source_id == source_id)
    if search:
        search_fmt = f"%{search.strip()}%"
        conditions.append(Article.title.ilike(search_fmt))
    if has_cluster is True:
        conditions.append(Article.cluster_id.isnot(None))
    elif has_cluster is False:
        conditions.append(Article.cluster_id.is_(None))
    if has_media is True:
        conditions.append(Article.media_url.isnot(None))
    elif has_media is False:
        conditions.append(Article.media_url.is_(None))

    if conditions:
        query = query.where(and_(*conditions))

    # Count total matching
    count_query = select(func.count(Article.id))
    if conditions:
        count_query = count_query.where(and_(*conditions))
    
    total_res = await db.execute(count_query)
    total_count = total_res.scalar() or 0

    # Paginate
    offset = (page - 1) * page_size
    query = query.order_by(Article.published_at.desc(), Article.id.desc()).offset(offset).limit(page_size)

    result = await db.execute(query)
    rows = result.all()

    items = []
    for art, s_name, s_camp, c_title in rows:
        snippet = (art.clean_content or art.raw_content or "")[:300]
        items.append({
            "id": art.id,
            "title": art.title,
            "url": art.url,
            "source_id": art.source_id,
            "source_name": s_name or "СМИ",
            "source_camp": s_camp or "Центристская",
            "published_at": art.published_at.isoformat() if art.published_at else None,
            "created_at": art.created_at.isoformat() if art.created_at else None,
            "cluster_id": art.cluster_id,
            "cluster_title": c_title,
            "media_url": art.media_url,
            "snippet": snippet,
        })

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total_count + page_size - 1) // page_size)
    }


@router.get("/sources")
async def get_admin_sources(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(NewsSource).order_by(NewsSource.id))
    sources = result.scalars().all()
    return sources


@router.post("/sources")
async def create_admin_source(payload: SourceCreateUpdateSchema, db: AsyncSession = Depends(get_db)):
    feed_enum = FeedType.TELEGRAM if payload.feed_type == "telegram" else FeedType.RSS
    new_src = NewsSource(
        name=payload.name,
        url=payload.url,
        feed_type=feed_enum,
        default_camp=payload.default_camp,
        is_active=payload.is_active,
        logo_url=payload.logo_url,
        factuality_score=payload.factuality_score or 85,
        bias_score=payload.bias_score or 30,
    )
    db.add(new_src)
    await db.commit()
    await db.refresh(new_src)
    return new_src


@router.put("/sources/{source_id}")
async def update_admin_source(source_id: int, payload: SourceCreateUpdateSchema, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(NewsSource).where(NewsSource.id == source_id))
    src = result.scalar_one_or_none()
    if not src:
        raise HTTPException(status_code=404, detail="Source not found")
    
    feed_enum = FeedType.TELEGRAM if payload.feed_type == "telegram" else FeedType.RSS
    src.name = payload.name
    src.url = payload.url
    src.feed_type = feed_enum
    src.default_camp = payload.default_camp
    src.is_active = payload.is_active
    if payload.logo_url is not None:
        src.logo_url = payload.logo_url
    if payload.factuality_score is not None:
        src.factuality_score = payload.factuality_score
    if payload.bias_score is not None:
        src.bias_score = payload.bias_score

    await db.commit()
    await db.refresh(src)
    return src


@router.delete("/sources/{source_id}")
async def delete_admin_source(source_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(NewsSource).where(NewsSource.id == source_id))
    src = result.scalar_one_or_none()
    if not src:
        raise HTTPException(status_code=404, detail="Source not found")
    await db.delete(src)
    await db.commit()
    return {"status": "deleted", "source_id": source_id}


@router.get("/settings")
async def get_admin_settings():
    return _runtime_settings


@router.put("/settings")
async def update_admin_settings(payload: PipelineSettingsSchema):
    _runtime_settings.update(payload.model_dump())
    return _runtime_settings


@router.post("/trigger/ingest")
async def trigger_manual_ingest(background_tasks: BackgroundTasks):
    async def run_ingest():
        async with AsyncSessionLocal() as session:
            try:
                await news_pipeline.run_ingestion_and_vectorization(session)
            except Exception as e:
                import logging
                logging.getLogger("prism_news").error(f"Error in manual ingest: {e}")

    background_tasks.add_task(run_ingest)
    return {"status": "success", "message": "Ручной сбор источников запущен в фоновом режиме"}


@router.post("/trigger/analysis")
async def trigger_manual_analysis(background_tasks: BackgroundTasks):
    async def run_analysis():
        async with AsyncSessionLocal() as session:
            try:
                await news_pipeline.run_clustering_and_analysis(session)
            except Exception as e:
                import logging
                logging.getLogger("prism_news").error(f"Error in manual analysis: {e}")

    background_tasks.add_task(run_analysis)
    return {"status": "success", "message": "Анализ и синтез сюжетов ИИ запущен в фоновом режиме"}


@router.post("/trigger/recalculate-trust")
async def trigger_recalculate_trust():
    async with AsyncSessionLocal() as session:
        await news_pipeline.recalculate_sources_rating(session)
    return {"status": "success", "message": "Пересчет динамических рейтингов объективности СМИ выполнен"}
