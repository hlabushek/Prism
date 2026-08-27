from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime
from app.core.database import Base


class AITokenUsage(Base):
    __tablename__ = "ai_token_usage"

    id = Column(Integer, primary_key=True, index=True)
    stage = Column(String(50), nullable=False, index=True)  # "embedding", "cheap_filter", "story_synthesis"
    model_name = Column(String(100), nullable=False)
    prompt_tokens = Column(Integer, default=0, nullable=False)
    completion_tokens = Column(Integer, default=0, nullable=False)
    total_tokens = Column(Integer, default=0, nullable=False)
    estimated_cost_rub = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
