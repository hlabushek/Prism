from typing import List, Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.ai import PoliticalVectorItem, QuoteItem


class ArticleSnippet(BaseModel):
    id: int
    title: str
    url: str
    source_name: Optional[str] = None
    published_at: datetime


class MediaItemSchema(BaseModel):
    type: str = "image"
    url: str
    caption: Optional[str] = None
    source_name: Optional[str] = None


class TimelineEventSchema(BaseModel):
    time: str
    title: str
    description: str


class ReactionSummarySchema(BaseModel):
    objective: int = 0
    fact: int = 0
    fire: int = 0
    like: int = 0
    thumb_up: int = 0
    user_reaction: Optional[str] = None


class StoryClusterResponse(BaseModel):
    id: int
    title: str
    summary: str
    sentiment: float
    category: Optional[str] = "Политика"
    consensus_score: Optional[int] = 80
    polarization_score: Optional[int] = 30
    media: Optional[List[MediaItemSchema]] = Field(default_factory=list)
    timeline: Optional[List[TimelineEventSchema]] = Field(default_factory=list)
    political_vectors: List[PoliticalVectorItem]
    quotes: List[QuoteItem]
    verified_facts: List[str]
    blindspots: List[str]
    article_count: int
    sources_count: int = 1
    created_at: datetime
    updated_at: datetime
    articles: Optional[List[ArticleSnippet]] = None
    comments_count: int = 0
    reactions: Optional[ReactionSummarySchema] = None
    is_favorite: bool = False

    class Config:
        from_attributes = True


class FeedResponse(BaseModel):
    items: List[StoryClusterResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    server_time: datetime = Field(default_factory=datetime.utcnow)


class FeedFilterParams(BaseModel):
    page: int = Field(1, ge=1)
    page_size: int = Field(10, ge=1, le=50)
    sentiment: Optional[str] = Field(None, description="'positive_only' (>= 0.2), 'negative_only' (<= -0.2), 'neutral'")
    political_vector: Optional[str] = Field(None, description="Filter by political camp presence/prominence")
    source_ids: Optional[str] = Field(None, description="Comma-separated source IDs")
    search: Optional[str] = Field(None, description="Full-text / keyword search in title & summary")
