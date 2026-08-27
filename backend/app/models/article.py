from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.types import TypeDecorator
from sqlalchemy import JSON
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.core.config import settings

# Cross-database vector type definition
try:
    from pgvector.sqlalchemy import Vector
    VectorType = Vector(settings.EMBEDDING_DIMENSION)
except Exception:
    VectorType = JSON

class Article(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, ForeignKey("news_sources.id", ondelete="SET NULL"), nullable=True)
    title = Column(String(512), nullable=False)
    url = Column(String(1024), nullable=False, unique=True, index=True)
    raw_content = Column(Text, nullable=True)
    clean_content = Column(Text, nullable=False)
    published_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Vector embedding of title + first paragraph (JSON for SQLite, Vector for PostgreSQL)
    embedding = Column(JSON if "sqlite" in settings.DATABASE_URL else Vector(settings.EMBEDDING_DIMENSION), nullable=True)
    
    # Media image/video attachment URL
    media_url = Column(String(1024), nullable=True)

    # Association with story cluster
    cluster_id = Column(Integer, ForeignKey("story_clusters.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    source = relationship("NewsSource", lazy="joined")
    cluster = relationship("StoryCluster", back_populates="articles", lazy="select")


# PostgreSQL HNSW index conditionally registered
if "postgresql" in settings.DATABASE_URL:
    Index("idx_articles_embedding_hnsw", Article.embedding, postgresql_using="hnsw", postgresql_with={"m": 16, "ef_construction": 64}, postgresql_ops={"embedding": "vector_cosine_ops"})

