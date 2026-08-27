from datetime import datetime
from sqlalchemy import Column, Integer, BigInteger, String, Text, Float, DateTime, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class StoryCluster(Base):
    __tablename__ = "story_clusters"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(512), nullable=False)
    summary = Column(Text, nullable=False)
    sentiment = Column(Float, default=0.0, nullable=False)  # -1.0 to +1.0
    category = Column(String(100), default="Политика", nullable=False)
    
    consensus_score = Column(Integer, default=80, nullable=False)
    polarization_score = Column(Integer, default=30, nullable=False)
    
    # AI Importance Rating (1 to 10) & Reasoning
    importance_score = Column(Integer, default=7, nullable=False)
    importance_reason = Column(String(512), nullable=True)
    
    # Media & Timelines
    media = Column(JSON, nullable=False, default=list)
    timeline = Column(JSON, nullable=False, default=list)
    
    # Telegram Channel Integration
    tg_channel_message_id = Column(BigInteger, nullable=True)

    # AI Analytics stored as JSON
    political_vectors = Column(JSON, nullable=False, default=list)
    quotes = Column(JSON, nullable=False, default=list)
    verified_facts = Column(JSON, nullable=False, default=list)
    blindspots = Column(JSON, nullable=False, default=list)

    article_count = Column(Integer, default=1, nullable=False)
    sources_count = Column(Integer, default=1, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    articles = relationship("Article", back_populates="cluster", lazy="select")
    comments = relationship("Comment", back_populates="cluster", cascade="all, delete-orphan")
