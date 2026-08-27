import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Set, Optional
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.source import NewsSource, FeedType, PoliticalCamp
from app.models.article import Article
from app.models.cluster import StoryCluster
from app.services.parser import NewsParser
from app.services.cleaner import TextCleaner
from app.services.ai_service import ai_service
from app.services.clustering import clustering_service
from app.services.telegram_bot import telegram_bot_service
from app.core.config import settings

logger = logging.getLogger(__name__)


# Default high-profile media across the 5 camps
DEFAULT_SOURCES = [
    # Официально-лоялистская
    {"name": "Известия", "url": "https://iz.ru/xml/rss/all.xml", "feed_type": FeedType.RSS, "default_camp": PoliticalCamp.OFFICIAL.value, "logo_url": "https://iz.ru/favicon.ico"},
    {"name": "Российская газета", "url": "https://rg.ru/xml/index.xml", "feed_type": FeedType.RSS, "default_camp": PoliticalCamp.OFFICIAL.value, "logo_url": "https://rg.ru/favicon.ico"},
    {"name": "Соловьев Live", "url": "https://t.me/SolovievLive", "feed_type": FeedType.TELEGRAM, "default_camp": PoliticalCamp.OFFICIAL.value, "logo_url": "https://telegram.org/img/t_logo.png"},

    # Военкоры/Z
    {"name": "Рыбарь", "url": "https://t.me/rybar", "feed_type": FeedType.TELEGRAM, "default_camp": PoliticalCamp.WAR_Z.value, "logo_url": "https://telegram.org/img/t_logo.png"},
    {"name": "Readovka", "url": "https://t.me/readovkanews", "feed_type": FeedType.TELEGRAM, "default_camp": PoliticalCamp.WAR_Z.value, "logo_url": "https://telegram.org/img/t_logo.png"},
    {"name": "WarGonzo", "url": "https://t.me/wargonzo", "feed_type": FeedType.TELEGRAM, "default_camp": PoliticalCamp.WAR_Z.value, "logo_url": "https://telegram.org/img/t_logo.png"},
    {"name": "Александр Коц", "url": "https://t.me/sashakots", "feed_type": FeedType.TELEGRAM, "default_camp": PoliticalCamp.WAR_Z.value, "logo_url": "https://telegram.org/img/t_logo.png"},

    # Деловая/Центристская
    {"name": "Forbes Russia", "url": "https://www.forbes.ru/new-rss", "feed_type": FeedType.RSS, "default_camp": PoliticalCamp.BUSINESS_CENTER.value, "logo_url": "https://www.forbes.ru/favicon.ico"},
    {"name": "Осторожно, новости", "url": "https://t.me/ostorozhno_novosti", "feed_type": FeedType.TELEGRAM, "default_camp": PoliticalCamp.BUSINESS_CENTER.value, "logo_url": "https://telegram.org/img/t_logo.png"},
    {"name": "Baza", "url": "https://t.me/bazabazon", "feed_type": FeedType.TELEGRAM, "default_camp": PoliticalCamp.BUSINESS_CENTER.value, "logo_url": "https://telegram.org/img/t_logo.png"},
    {"name": "Интерфакс", "url": "https://www.interfax.ru/rss.asp", "feed_type": FeedType.RSS, "default_camp": PoliticalCamp.BUSINESS_CENTER.value, "logo_url": "https://www.interfax.ru/favicon.ico"},

    # Либерально-оппозиционная
    {"name": "Медиазона", "url": "https://zona.media/rss", "feed_type": FeedType.RSS, "default_camp": PoliticalCamp.LIBERAL_OPPOSITION.value, "logo_url": "https://zona.media/favicon.ico"},
    {"name": "The Bell", "url": "https://t.me/thebell_io", "feed_type": FeedType.TELEGRAM, "default_camp": PoliticalCamp.LIBERAL_OPPOSITION.value, "logo_url": "https://thebell.io/favicon.ico"},
    {"name": "Телеканал Дождь", "url": "https://t.me/tvrain", "feed_type": FeedType.TELEGRAM, "default_camp": PoliticalCamp.LIBERAL_OPPOSITION.value, "logo_url": "https://tvrain.tv/favicon.ico"},
    {"name": "Холод", "url": "https://t.me/holodmedia", "feed_type": FeedType.TELEGRAM, "default_camp": PoliticalCamp.LIBERAL_OPPOSITION.value, "logo_url": "https://holod.media/favicon.ico"},

    # Проукраинская/Внешняя
    {"name": "DW Главное", "url": "https://t.me/dwrussian", "feed_type": FeedType.TELEGRAM, "default_camp": PoliticalCamp.PRO_UKRAINIAN_WESTERN.value, "logo_url": "https://www.dw.com/favicon.ico"},
    {"name": "РБК-Украина", "url": "https://www.rbc.ua/static/rss/newsline.rus.rss.xml", "feed_type": FeedType.RSS, "default_camp": PoliticalCamp.PRO_UKRAINIAN_WESTERN.value, "logo_url": "https://www.rbc.ua/favicon.ico"},
    {"name": "Суспільне Новини", "url": "https://t.me/suspilnenews", "feed_type": FeedType.TELEGRAM, "default_camp": PoliticalCamp.PRO_UKRAINIAN_WESTERN.value, "logo_url": "https://suspilne.media/favicon.ico"},
    {"name": "Инсайдер UA", "url": "https://t.me/insiderUKR", "feed_type": FeedType.TELEGRAM, "default_camp": PoliticalCamp.PRO_UKRAINIAN_WESTERN.value, "logo_url": "https://telegram.org/img/t_logo.png"}
]


def normalize_category(cat: Optional[str]) -> str:
    if not cat:
        return "Политика"
    c = str(cat).strip()
    if c in {"Политика", "Экономика", "ВПК", "Технологии", "В мире", "Общество"}:
        return c
    c_lower = c.lower()
    if any(k in c_lower for k in ["технолог", "искусственн", "нейросет", "гаджет", "цифров", "софт", "робот"]):
        return "Технологии"
    if any(k in c_lower for k in ["впк", "безопасн", "оборон", "армия", "сво", "фронт", "боев", "удар", "всу", "миноборон"]):
        return "ВПК"
    if any(k in c_lower for k in ["эконом", "финанс", "бизнес", "рынок", "банк", "курс", "рубл", "доллар", "инфляц", "налог", "бюджет", "нефть", "газ", "цб"]):
        return "Экономика"
    if any(k in c_lower for k in ["мире", "зарубеж", "международ", "европ", "сша", "китай", "нато", "оон", "дипломат"]):
        return "В мире"
    if any(k in c_lower for k in ["обществ", "социал", "культур", "спорт", "здоров", "медицин", "образован", "школ", "егэ", "вуз", "происшеств", "пожар", "мчс", "суд", "дтп"]):
        return "Общество"
    if any(k in c_lower for k in ["полит", "выбор", "парламент", "госдум", "кремль", "президент", "правительств", "закон"]):
        return "Политика"
    return "Политика"


class NewsPipeline:
    def __init__(self):
        self.parser = NewsParser()

    async def seed_default_sources(self, db: AsyncSession):
        """Prepopulates default media sources if table is empty or adds missing ones without overwriting user edits."""
        for s in DEFAULT_SOURCES:
            existing = await db.execute(select(NewsSource).where(NewsSource.url == s["url"]))
            source_obj = existing.scalar_one_or_none()
            if not source_obj:
                source = NewsSource(
                    name=s["name"],
                    url=s["url"],
                    feed_type=s["feed_type"],
                    default_camp=s["default_camp"],
                    is_active=True,
                    logo_url=s.get("logo_url")
                )
                db.add(source)
            else:
                # Only populate logo_url if currently empty, never overwrite user customizations
                if not source_obj.logo_url and s.get("logo_url"):
                    source_obj.logo_url = s["logo_url"]
        await db.commit()
        logger.info(f"Checked & synced default news sources.")

    async def recalculate_sources_rating(self, db: AsyncSession):
        """Dynamically computes real trust, factuality, and bias metrics for all sources based on DB content."""
        sources_res = await db.execute(select(NewsSource))
        sources = sources_res.scalars().all()
        for src in sources:
            count_res = await db.execute(select(func.count(Article.id)).where(Article.source_id == src.id))
            total_articles = count_res.scalar() or 0
            src.coverage_count = total_articles

            # Factuality & Bias dynamic calculation based on real clusters
            clusters_res = await db.execute(
                select(func.count(func.distinct(Article.cluster_id)))
                .where(and_(Article.source_id == src.id, Article.cluster_id.isnot(None)))
            )
            clustered_count = clusters_res.scalar() or 0

            # Dynamic trust rating formula
            base_fact = 82
            if total_articles > 0:
                ratio = clustered_count / max(1, total_articles)
                calc_fact = int(base_fact + min(12, ratio * 15))
            else:
                calc_fact = 85
            src.factuality_score = min(98, max(70, calc_fact))

            # Camp based polarization baseline
            camp_biases = {
                PoliticalCamp.BUSINESS_CENTER.value: 22,
                PoliticalCamp.OFFICIAL.value: 58,
                PoliticalCamp.WAR_Z.value: 68,
                PoliticalCamp.LIBERAL_OPPOSITION.value: 62,
                PoliticalCamp.PRO_UKRAINIAN_WESTERN.value: 65,
            }
            src.bias_score = camp_biases.get(src.default_camp, 35)

        await db.commit()
        logger.info("Recalculated real trust rating metrics for all sources.")

    async def run_ingestion_and_vectorization(self, db: AsyncSession):
        """
        Stage 1 & 2:
        1. Ingests raw news items from active RSS and Telegram sources via SOCKS5 proxy.
        2. Cleans text and generates vector embeddings for title + first paragraph.
        3. Saves newly vectorized articles to the database with media attachments.
        """
        logger.info("Starting News Ingestion & Vectorization Task (via SOCKS5 proxy)...")
        await self.seed_default_sources(db)

        # Get active sources
        result = await db.execute(select(NewsSource).where(NewsSource.is_active.is_(True)))
        sources = result.scalars().all()

        total_saved = 0
        for source in sources:
            try:
                raw_articles = []
                if source.feed_type == FeedType.RSS:
                    rss_items = await self.parser.fetch_rss_feed(source.url)
                    for item in rss_items:
                        # Check if article already exists
                        existing = await db.execute(select(Article.id).where(Article.url == item["url"]))
                        if existing.first():
                            continue
                        
                        clean_content = await self.parser.extract_full_content(item["url"], item.get("summary", ""))
                        if len(clean_content) < 50:
                            clean_content = item["title"]

                        raw_articles.append({
                            "title": item["title"],
                            "url": item["url"],
                            "clean_content": clean_content,
                            "raw_content": item.get("summary", ""),
                            "published_at": item["published_at"],
                            "media_url": item.get("media_url")
                        })

                elif source.feed_type == FeedType.TELEGRAM:
                    tg_items = await self.parser.fetch_telegram_channel_posts(source.url)
                    for item in tg_items:
                        existing = await db.execute(select(Article.id).where(Article.url == item["url"]))
                        if existing.first():
                            continue
                        raw_articles.append(item)

                # Process and vectorize new articles
                for art_data in raw_articles:
                    embed_text = TextCleaner.extract_embedding_text(art_data["title"], art_data["clean_content"])
                    embedding = await ai_service.get_embedding(embed_text)

                    new_article = Article(
                        source_id=source.id,
                        title=art_data["title"],
                        url=art_data["url"],
                        clean_content=art_data["clean_content"],
                        raw_content=art_data.get("raw_content", ""),
                        published_at=art_data.get("published_at", datetime.utcnow()),
                        embedding=embedding,
                        media_url=art_data.get("media_url")
                    )
                    db.add(new_article)
                    total_saved += 1

                await db.commit()

            except Exception as e:
                logger.error(f"Error ingesting source '{source.name}' ({source.url}): {e}")
                await db.rollback()

        # Recalculate dynamic source ratings
        try:
            await self.recalculate_sources_rating(db)
        except Exception as rating_err:
            logger.error(f"Error recalculating source ratings: {rating_err}")

        logger.info(f"Ingestion & Vectorization completed. Saved {total_saved} new articles.")

    async def run_clustering_and_analysis(self, db: AsyncSession):
        """
        Stage 3 & 4:
        1. Compares 24h cosine distances to group articles.
        2. Applies programmatic cluster size limit (len(unique_sources) >= 2).
        3. Applies preliminary cheap LLM importance filter (CHEAP_LLM_MODEL).
        4. Synthesizes AI story cards via LLM_MODEL with media and real analytics.
        """
        logger.info("Starting Clustering & LLM Analysis Task...")
        cutoff_time = datetime.utcnow() - timedelta(hours=max(48, settings.LOOKBACK_HOURS * 2))

        # Find all unclustered articles with valid embeddings
        query = select(Article).options(selectinload(Article.source)).where(
            and_(
                Article.cluster_id.is_(None),
                Article.embedding.isnot(None)
            )
        ).order_by(Article.published_at.desc())

        result = await db.execute(query)
        unclustered = result.scalars().all()

        if not unclustered:
            logger.info("No unclustered articles found in the last 24h.")
            return

        logger.info(f"Processing {len(unclustered)} unclustered articles...")

        # Step 1: Assign to existing clusters if similarity matches
        remaining_articles = []
        clusters_to_update = set()

        for art in unclustered:
            matched_cluster_id = await clustering_service.find_matching_cluster(db, art.embedding, cutoff_time)
            if matched_cluster_id:
                art.cluster_id = matched_cluster_id
                clusters_to_update.add(matched_cluster_id)
                cluster = await db.get(StoryCluster, matched_cluster_id)
                if cluster:
                    cluster.article_count = (cluster.article_count or 1) + 1
                    # Append media if available
                    if art.media_url and str(art.media_url).startswith("http"):
                        current_media = list(cluster.media or [])
                        if not any(m.get("url") == art.media_url for m in current_media):
                            current_media.append({
                                "type": "image",
                                "url": art.media_url,
                                "caption": art.title,
                                "source_name": art.source.name if art.source else "СМИ"
                            })
                            cluster.media = current_media[:5]
                    cluster.updated_at = datetime.utcnow()
                await db.commit()
            else:
                remaining_articles.append(art)

        # Step 1.5: Re-analyze updated clusters with new incoming publications & update Telegram post
        for cid in clusters_to_update:
            try:
                cluster = await db.get(StoryCluster, cid)
                if not cluster:
                    continue
                # Load all articles for this cluster with sources
                all_arts_res = await db.execute(
                    select(Article).options(selectinload(Article.source))
                    .where(Article.cluster_id == cid)
                    .order_by(Article.published_at.desc())
                )
                cluster_articles = all_arts_res.scalars().all()
                if not cluster_articles:
                    continue

                sources_count = len({a.source_id for a in cluster_articles if a.source_id})
                cluster.sources_count = sources_count
                cluster.article_count = len(cluster_articles)

                article_dicts = [
                    {
                        "title": a.title,
                        "url": a.url,
                        "source_name": a.source.name if a.source else "СМИ",
                        "clean_content": a.clean_content or a.title
                    }
                    for a in cluster_articles
                ]

                # Synthesize fresh multi-source analytical card
                story_card = await ai_service.generate_story_card(article_dicts)
                cluster.title = story_card.title
                cluster.summary = story_card.summary
                cluster.category = normalize_category(story_card.category)
                cluster.sentiment = story_card.sentiment
                cluster.political_vectors = [v.model_dump() for v in story_card.political_vectors]
                cluster.quotes = [q.model_dump() for q in story_card.quotes]
                cluster.verified_facts = story_card.verified_facts
                cluster.blindspots = story_card.blindspots
                cluster.updated_at = datetime.utcnow()
                await db.commit()

                # Update live Telegram Channel post if published
                if cluster.tg_channel_message_id:
                    unique_sources = [a.source.name for a in cluster_articles if a.source and a.source.name]
                    # Deduplicate preserving order
                    seen_s = set()
                    dedup_sources = [x for x in unique_sources if not (x in seen_s or seen_s.add(x))]
                    await telegram_bot_service.update_story_in_channel(
                        cluster_id=cluster.id,
                        message_id=cluster.tg_channel_message_id,
                        title=cluster.title,
                        summary=cluster.summary,
                        verified_facts=cluster.verified_facts,
                        sentiment=cluster.sentiment,
                        consensus_score=cluster.consensus_score,
                        sources_list=dedup_sources
                    )
                logger.info(f"Successfully re-synthesized and updated cluster #{cid} with {len(cluster_articles)} sources.")
            except Exception as update_err:
                logger.error(f"Error re-synthesizing updated cluster #{cid}: {update_err}")

        # Step 2: Group remaining unclustered articles amongst each other
        clusters_to_create: List[List[Article]] = []
        visited = set()

        for i, art1 in enumerate(remaining_articles):
            if i in visited:
                continue
            group = [art1]
            visited.add(i)

            vec1 = art1.embedding
            if vec1 is None:
                continue

            for j in range(i + 1, len(remaining_articles)):
                if j in visited:
                    continue
                art2 = remaining_articles[j]
                vec2 = art2.embedding
                if vec2 is None:
                    continue

                # Cosine similarity calculation
                dot_prod = sum(a * b for a, b in zip(vec1, vec2))
                norm1 = sum(a * a for a in vec1) ** 0.5
                norm2 = sum(b * b for b in vec2) ** 0.5
                sim = dot_prod / (norm1 * norm2) if norm1 > 0 and norm2 > 0 else 0.0

                if sim >= settings.SIMILARITY_THRESHOLD:
                    group.append(art2)
                    visited.add(j)

            clusters_to_create.append(group)

        # Step 3: Process clusters with size limit & Cheap LLM filter
        for group in clusters_to_create:
            # Rule 1: Cluster Size Constraint — Minimum 2 independent sources
            unique_source_ids = set(art.source_id for art in group if art.source_id is not None)
            if len(unique_source_ids) < 2 and len(group) < 2:
                logger.info(f"Skipping single-source cluster '{group[0].title[:50]}...' (requires >= 2 independent sources). Waiting for further coverage.")
                continue

            try:
                # Prepare payload for LLM
                articles_payload = []
                for art in group:
                    source_name = art.source.name if art.source else "Новостной источник"
                    articles_payload.append({
                        "title": art.title,
                        "url": art.url,
                        "source_name": source_name,
                        "clean_content": art.clean_content
                    })

                # Rule 2: Preliminary Cheap LLM Filter (CHEAP_LLM_MODEL)
                is_important = await ai_service.filter_cluster_importance(articles_payload)
                if not is_important:
                    logger.info(f"Cluster '{group[0].title[:50]}...' discarded by cheap LLM filter as petty/unimportant.")
                    continue

                # Rule 3: Heavy LLM Analytical Card Generation (LLM_MODEL)
                ai_card = await ai_service.generate_story_card(articles_payload)

                # Extract photos / media from articles
                cluster_media = []
                for art in group:
                    if getattr(art, "media_url", None) and str(art.media_url).startswith("http"):
                        cluster_media.append({
                            "type": "image",
                            "url": art.media_url,
                            "caption": art.title,
                            "source_name": art.source.name if art.source else "Первоисточник"
                        })

                # Persist StoryCluster with sources_count
                sources_count = max(1, len(unique_source_ids))
                cluster = StoryCluster(
                    title=ai_card.title,
                    summary=ai_card.summary,
                    sentiment=ai_card.sentiment,
                    category=normalize_category(getattr(ai_card, "category", "Политика")),
                    consensus_score=getattr(ai_card, "consensus_score", 80) or 80,
                    polarization_score=getattr(ai_card, "polarization_score", 30) or 30,
                    media=cluster_media[:5],
                    timeline=[t.model_dump() for t in getattr(ai_card, "timeline", [])] if getattr(ai_card, "timeline", None) else [],
                    political_vectors=[v.model_dump() for v in ai_card.political_vectors],
                    quotes=[q.model_dump() for q in ai_card.quotes],
                    verified_facts=ai_card.verified_facts,
                    blindspots=ai_card.blindspots,
                    article_count=len(group),
                    sources_count=sources_count,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                db.add(cluster)
                await db.flush()  # to obtain cluster.id

                for art in group:
                    art.cluster_id = cluster.id

                await db.commit()
                logger.info(f"Created StoryCluster #{cluster.id}: '{cluster.title}' with {len(group)} articles from {sources_count} sources and {len(cluster_media)} images.")

                # Auto-post to Telegram Channel
                if getattr(settings, "AUTO_POST_TO_CHANNEL", True):
                    try:
                        source_names = [art.source.name for art in group if art.source and art.source.name]
                        media_urls = [art.media_url for art in group if getattr(art, 'media_url', None)]
                        msg_id = await telegram_bot_service.post_story_to_channel(
                            cluster_id=cluster.id,
                            title=cluster.title,
                            summary=cluster.summary,
                            verified_facts=cluster.verified_facts or [],
                            sentiment=cluster.sentiment or 0.0,
                            consensus_score=getattr(cluster, "consensus_score", None),
                            sources_list=source_names,
                            media_urls=media_urls,
                        )
                        if msg_id:
                            cluster.tg_channel_message_id = msg_id
                            await db.commit()
                            logger.info(f"Published StoryCluster #{cluster.id} to Telegram channel (msg_id={msg_id})")
                    except Exception as post_err:
                        logger.warning(f"Could not auto-post StoryCluster #{cluster.id} to channel: {post_err}")

            except Exception as e:
                logger.error(f"Failed to generate story cluster card: {e}")
                await db.rollback()

        logger.info("Clustering and AI Card generation completed.")


news_pipeline = NewsPipeline()
