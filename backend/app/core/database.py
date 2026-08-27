import logging
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
from app.core.config import settings

logger = logging.getLogger(__name__)

engine_kwargs = {"echo": False, "future": True}
if "sqlite" in settings.DATABASE_URL:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs.update({
        "pool_pre_ping": True,
        "pool_size": 10,
        "max_overflow": 20
    })

engine = create_async_engine(
    settings.DATABASE_URL,
    **engine_kwargs
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

Base = declarative_base()


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Initializes database schema and pgvector if PostgreSQL is used, and adds missing columns."""
    import app.models  # Ensure all models are registered in Base.metadata

    async with engine.begin() as conn:
        try:
            if "postgresql" in settings.DATABASE_URL:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                logger.info("pgvector extension verified/enabled.")
        except Exception as e:
            logger.warning(f"Note on vector extension: {e}")

        try:
            # Create all tables registered with Base
            await conn.run_sync(Base.metadata.create_all)
            logger.info("Database tables verified/created successfully.")
        except Exception as e:
            logger.error(f"Error creating database tables: {e}")

        # PostgreSQL column migrations
        if "postgresql" in settings.DATABASE_URL:
            try:
                pg_alter_queries = [
                    "ALTER TABLE articles ADD COLUMN IF NOT EXISTS media_url VARCHAR(1024);",
                    "ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS logo_url VARCHAR(512);",
                    "ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS factuality_score INTEGER DEFAULT 85;",
                    "ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS bias_score INTEGER DEFAULT 30;",
                    "ALTER TABLE news_sources ADD COLUMN IF NOT EXISTS coverage_count INTEGER DEFAULT 0;",
                    "ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS media JSONB DEFAULT '[]'::jsonb;",
                    "ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS timeline JSONB DEFAULT '[]'::jsonb;",
                    "ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'Политика';",
                    "ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS consensus_score INTEGER DEFAULT 80;",
                    "ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS polarization_score INTEGER DEFAULT 30;",
                    "ALTER TABLE story_clusters ADD COLUMN IF NOT EXISTS sources_count INTEGER DEFAULT 1;",
                ]
                for q in pg_alter_queries:
                    try:
                        await conn.execute(text(q))
                    except Exception as col_err:
                        logger.debug(f"Postgres column ensure note ({q}): {col_err}")
                logger.info("PostgreSQL schema columns verified/updated.")
            except Exception as e:
                logger.debug(f"PostgreSQL column migration check: {e}")

        # SQLite column migrations
        if "sqlite" in settings.DATABASE_URL:
            try:
                table_info = await conn.execute(text("PRAGMA table_info(story_clusters);"))
                existing_cols = {row[1] for row in table_info.fetchall()}
                
                columns_to_add = [
                    ("category", "VARCHAR(100) DEFAULT 'Политика' NOT NULL"),
                    ("consensus_score", "INTEGER DEFAULT 80 NOT NULL"),
                    ("polarization_score", "INTEGER DEFAULT 30 NOT NULL"),
                    ("media", "JSON DEFAULT '[]' NOT NULL"),
                    ("timeline", "JSON DEFAULT '[]' NOT NULL"),
                    ("tg_channel_message_id", "BIGINT"),
                    ("sources_count", "INTEGER DEFAULT 1 NOT NULL"),
                ]
                for col_name, col_type in columns_to_add:
                    if col_name not in existing_cols:
                        logger.info(f"Adding missing column '{col_name}' to story_clusters table...")
                        await conn.execute(text(f"ALTER TABLE story_clusters ADD COLUMN {col_name} {col_type};"))

                # Articles table check for SQLite
                art_table_info = await conn.execute(text("PRAGMA table_info(articles);"))
                art_existing_cols = {row[1] for row in art_table_info.fetchall()}
                if "media_url" not in art_existing_cols:
                    await conn.execute(text("ALTER TABLE articles ADD COLUMN media_url VARCHAR(1024);"))
            except Exception as e:
                logger.debug(f"SQLite column migration check: {e}")
