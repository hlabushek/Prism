import logging
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db, AsyncSessionLocal
from app.api.router import api_router
from app.services.scheduler import start_scheduler, shutdown_scheduler
from app.services.pipeline import news_pipeline

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("prism_news")


from app.services.telegram_bot import run_telegram_poller

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup sequence
    logger.info("Initializing Prism News AI backend...")
    await init_db()
    
    # Pre-seed default sources on startup
    try:
        async with AsyncSessionLocal() as session:
            await news_pipeline.seed_default_sources(session)
    except Exception as e:
        logger.warning(f"Default sources seeding note: {e}")

    # Load persisted settings from database
    try:
        from app.api.routes.admin import load_persisted_settings
        async with AsyncSessionLocal() as session:
            await load_persisted_settings(session)
    except Exception as e:
        logger.warning(f"Settings loading note: {e}")

    # Start APScheduler with configured intervals
    start_scheduler()

    # Start Telegram Bot Poller in background (proxy-enabled)
    tg_poller_task = asyncio.create_task(run_telegram_poller(AsyncSessionLocal))

    # Trigger non-blocking initial ingestion in background
    async def initial_sync():
        await asyncio.sleep(2)
        try:
            async with AsyncSessionLocal() as session:
                await news_pipeline.run_ingestion_and_vectorization(session)
                await news_pipeline.run_clustering_and_analysis(session)
        except Exception as e:
            logger.warning(f"Initial sync warning: {e}")

    asyncio.create_task(initial_sync())

    yield

    # Shutdown sequence
    logger.info("Shutting down Prism News AI backend...")
    tg_poller_task.cancel()
    shutdown_scheduler()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
async def health_check():
    return {
        "status": "healthy",
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "embedding_model": settings.EMBEDDING_MODEL,
        "llm_model": settings.LLM_MODEL,
        "parse_interval_minutes": settings.PARSE_INTERVAL_MINUTES,
        "llm_interval_minutes": settings.LLM_ANALYSIS_INTERVAL_MINUTES
    }
