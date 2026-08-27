import logging
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.services.pipeline import news_pipeline

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def scheduled_parse_and_vectorize_job():
    """Periodic job for parsing feeds and generating embeddings."""
    logger.info("Executing scheduled parse and vectorize job...")
    async with AsyncSessionLocal() as session:
        try:
            await news_pipeline.run_ingestion_and_vectorization(session)
        except Exception as e:
            logger.error(f"Error in scheduled parse job: {e}")


async def scheduled_new_stories_job():
    """Periodic job for forming and analyzing brand new story clusters."""
    logger.info("Executing scheduled NEW stories clustering and LLM job...")
    async with AsyncSessionLocal() as session:
        try:
            await news_pipeline.run_clustering_and_analysis(session, mode="new_stories")
        except Exception as e:
            logger.error(f"Error in scheduled new stories job: {e}")


async def scheduled_update_stories_job():
    """Periodic job for intelligent re-synthesis of existing stories with new facts."""
    if not getattr(settings, "AUTO_UPDATE_STORIES", True):
        logger.info("Auto-update stories is disabled in settings. Skipping update job.")
        return

    logger.info("Executing scheduled UPDATE stories re-synthesis job...")
    async with AsyncSessionLocal() as session:
        try:
            await news_pipeline.run_clustering_and_analysis(session, mode="update_stories")
        except Exception as e:
            logger.error(f"Error in scheduled update stories job: {e}")


def start_scheduler():
    """Configures triggers from settings and starts the AsyncIOScheduler."""
    parse_interval = getattr(settings, "PARSE_INTERVAL_MINUTES", 10)
    new_stories_interval = getattr(settings, "NEW_STORIES_INTERVAL_MINUTES", 25)
    update_stories_interval = getattr(settings, "UPDATE_STORIES_INTERVAL_MINUTES", 60)

    logger.info(f"Initializing APScheduler: Parse={parse_interval}m, NewStories={new_stories_interval}m, UpdateStories={update_stories_interval}m")

    # 1. Parsing & embedding job
    scheduler.add_job(
        scheduled_parse_and_vectorize_job,
        trigger=IntervalTrigger(minutes=max(1, parse_interval)),
        id="news_parser_job",
        name="News Ingestion & Vectorization",
        replace_existing=True,
        max_instances=1
    )

    # 2. New stories synthesis job
    scheduler.add_job(
        scheduled_new_stories_job,
        trigger=IntervalTrigger(minutes=max(1, new_stories_interval)),
        id="news_new_stories_job",
        name="New Stories Clustering & Synthesis",
        replace_existing=True,
        max_instances=1
    )

    # 3. Existing stories update job (less frequent, saves heavy LLM budget)
    scheduler.add_job(
        scheduled_update_stories_job,
        trigger=IntervalTrigger(minutes=max(1, update_stories_interval)),
        id="news_update_stories_job",
        name="Existing Stories Re-Synthesis",
        replace_existing=True,
        max_instances=1
    )

    scheduler.start()
    logger.info("APScheduler started successfully with 3 distinct pipelines.")


def reschedule_jobs(
    parse_minutes: int = 10,
    new_stories_minutes: int = 25,
    update_stories_minutes: int = 60,
    llm_minutes: Optional[int] = None
):
    """Dynamically updates the schedule intervals of running background jobs."""
    if scheduler.running:
        try:
            actual_new = new_stories_minutes or llm_minutes or 25
            scheduler.reschedule_job(
                "news_parser_job",
                trigger=IntervalTrigger(minutes=max(1, parse_minutes))
            )
            scheduler.reschedule_job(
                "news_new_stories_job",
                trigger=IntervalTrigger(minutes=max(1, actual_new))
            )
            scheduler.reschedule_job(
                "news_update_stories_job",
                trigger=IntervalTrigger(minutes=max(1, update_stories_minutes))
            )
            logger.info(f"Dynamically rescheduled background jobs: parse={parse_minutes}m, new_stories={actual_new}m, update_stories={update_stories_minutes}m")
        except Exception as e:
            logger.error(f"Error rescheduling jobs: {e}")


def shutdown_scheduler():
    """Stops the scheduler gracefully."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped.")
