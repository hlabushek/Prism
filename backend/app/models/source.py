import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from app.core.database import Base


class FeedType(str, enum.Enum):
    RSS = "rss"
    TELEGRAM = "telegram"


class PoliticalCamp(str, enum.Enum):
    OFFICIAL = "Официально-лоялистская"
    WAR_Z = "Военкоры/Z"
    BUSINESS_CENTER = "Деловая/Центристская"
    LIBERAL_OPPOSITION = "Либерально-оппозиционная"
    PRO_UKRAINIAN_WESTERN = "Проукраинская/Внешняя"


class NewsSource(Base):
    __tablename__ = "news_sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    url = Column(String(1024), nullable=False, unique=True)
    feed_type = Column(Enum(FeedType), default=FeedType.RSS, nullable=False)
    default_camp = Column(String(100), default="Деловая/Центристская", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Real Dynamic Rating & Metadata
    logo_url = Column(String(512), nullable=True)
    factuality_score = Column(Integer, default=85, nullable=False)
    bias_score = Column(Integer, default=30, nullable=False)
    coverage_count = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
