import logging
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


async def scheduled_clustering_and_llm_job():
    """Periodic job for 24h cosine clustering and LLM analytical card generation."""
    logger.info("Executing scheduled clustering and LLM analysis job...")
    async with AsyncSessionLocal() as session:
        try:
            await news_pipeline.run_clustering_and_analysis(session)
        except Exception as e:
            logger.error(f"Error in scheduled LLM job: {e}")


def start_scheduler():
    """Configures triggers from settings and starts the AsyncIOScheduler."""
    parse_interval = settings.PARSE_INTERVAL_MINUTES
    llm_interval = settings.LLM_ANALYSIS_INTERVAL_MINUTES

    logger.info(f"Initializing APScheduler with PARSE_INTERVAL_MINUTES={parse_interval}m and LLM_ANALYSIS_INTERVAL_MINUTES={llm_interval}m")

    # Schedule parsing & embedding job
    scheduler.add_job(
        scheduled_parse_and_vectorize_job,
        trigger=IntervalTrigger(minutes=parse_interval),
        id="news_parser_job",
        name="News Ingestion & Vectorization",
        replace_existing=True,
        max_instances=1
    )

    # Schedule clustering & LLM analysis job
    scheduler.add_job(
        scheduled_clustering_and_llm_job,
        trigger=IntervalTrigger(minutes=llm_interval),
        id="news_llm_analysis_job",
        name="Clustering & LLM Card Generation",
        replace_existing=True,
        max_instances=1
    )

    scheduler.start()
    logger.info("APScheduler started successfully.")


def reschedule_jobs(parse_minutes: int, llm_minutes: int):
    """Dynamically updates the schedule intervals of running background jobs."""
    if scheduler.running:
        try:
            scheduler.reschedule_job(
                "news_parser_job",
                trigger=IntervalTrigger(minutes=max(1, parse_minutes))
            )
            scheduler.reschedule_job(
                "news_llm_analysis_job",
                trigger=IntervalTrigger(minutes=max(1, llm_minutes))
            )
            logger.info(f"Dynamically rescheduled background jobs: parse={parse_minutes}m, llm={llm_minutes}m")
        except Exception as e:
            logger.error(f"Error rescheduling jobs: {e}")


def shutdown_scheduler():
    """Stops the scheduler gracefully."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped.")
