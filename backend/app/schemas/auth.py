from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class TelegramAuthRequest(BaseModel):
    init_data: str = Field(..., description="Raw Telegram WebApp initData string")


class UserPreferenceSchema(BaseModel):
    sentiment_filter: str = "all"
    political_vectors_filter: List[str] = Field(default_factory=list)
    sources_filter: List[int] = Field(default_factory=list)
    client_refresh_rate: int = Field(60, ge=5, le=3600, description="Background polling interval in seconds")

    class Config:
        from_attributes = True


class UserPreferenceUpdate(BaseModel):
    sentiment_filter: Optional[str] = None
    political_vectors_filter: Optional[List[str]] = None
    sources_filter: Optional[List[int]] = None
    client_refresh_rate: Optional[int] = Field(None, ge=5, le=3600)


class UserResponse(BaseModel):
    id: int
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    preferences: Optional[UserPreferenceSchema] = None

    class Config:
        from_attributes = True


class NewsSourceResponse(BaseModel):
    id: int
    name: str
    url: str
    feed_type: str
    default_camp: str
    is_active: bool
    logo_url: Optional[str] = None
    factuality_score: int = 85
    bias_score: int = 30
    coverage_count: int = 0

    class Config:
        from_attributes = True


class NewsSourceCreate(BaseModel):
    name: str
    url: str
    feed_type: str = "rss"
    default_camp: str = "Деловая/Центристская"
    is_active: bool = True
