from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, func, desc, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from datetime import datetime

from app.core.database import get_db
from app.models.user import User
from app.models.cluster import StoryCluster
from app.models.article import Article
from app.models.social import Comment, Favorite, Reaction
from app.schemas.feed import StoryClusterResponse, ArticleSnippet
from app.api.routes.auth import get_current_user_optional, get_current_user

router = APIRouter(prefix="/social", tags=["Social"])


class CommentCreateSchema(BaseModel):
    text: str
    author_name: Optional[str] = None


class CommentResponseSchema(BaseModel):
    id: int
    cluster_id: int
    user_id: Optional[int]
    author_name: str
    author_username: Optional[str]
    author_avatar: Optional[str]
    text: str
    source: str
    created_at: datetime

    class Config:
        from_attributes = True


class ReactionCreateSchema(BaseModel):
    reaction_type: str  # "objective", "fact", "fire", "like", "thumb_up"


class ReactionSummarySchema(BaseModel):
    objective: int = 0
    fact: int = 0
    fire: int = 0
    like: int = 0
    thumb_up: int = 0
    user_reaction: Optional[str] = None


# --- COMMENTS ---

@router.get("/stories/{cluster_id}/comments", response_model=List[CommentResponseSchema])
async def get_story_comments(cluster_id: int, db: AsyncSession = Depends(get_db)):
    cluster_res = await db.execute(select(StoryCluster).where(StoryCluster.id == cluster_id))
    cluster = cluster_res.scalar_one_or_none()
    if not cluster:
        raise HTTPException(status_code=404, detail="Story not found")
    
    comments_res = await db.execute(
        select(Comment).where(Comment.cluster_id == cluster_id).order_by(Comment.created_at.asc())
    )
    comments = comments_res.scalars().all()
    return comments


@router.post("/stories/{cluster_id}/comments", response_model=CommentResponseSchema)
async def create_story_comment(
    cluster_id: int,
    payload: CommentCreateSchema,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    cluster_res = await db.execute(select(StoryCluster).where(StoryCluster.id == cluster_id))
    cluster = cluster_res.scalar_one_or_none()
    if not cluster:
        raise HTTPException(status_code=404, detail="Story not found")

    author_name = payload.author_name or (current_user.first_name if current_user else "Читатель Prism")
    author_username = current_user.username if current_user else None
    
    comment = Comment(
        cluster_id=cluster_id,
        user_id=current_user.id if current_user else None,
        author_name=author_name,
        author_username=author_username,
        author_avatar=None,
        text=payload.text.strip(),
        source="web",
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment


# --- REACTIONS ---

@router.post("/stories/{cluster_id}/react", response_model=ReactionSummarySchema)
async def toggle_story_reaction(
    cluster_id: int,
    payload: ReactionCreateSchema,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing_res = await db.execute(
        select(Reaction).where(
            Reaction.cluster_id == cluster_id,
            Reaction.user_id == current_user.id
        )
    )
    existing = existing_res.scalar_one_or_none()

    if existing:
        if existing.reaction_type == payload.reaction_type:
            await db.delete(existing)
            await db.commit()
            user_reaction = None
        else:
            existing.reaction_type = payload.reaction_type
            await db.commit()
            user_reaction = payload.reaction_type
    else:
        new_reaction = Reaction(
            user_id=current_user.id,
            cluster_id=cluster_id,
            reaction_type=payload.reaction_type
        )
        db.add(new_reaction)
        await db.commit()
        user_reaction = payload.reaction_type

    # Aggregate counts
    reactions_res = await db.execute(select(Reaction).where(Reaction.cluster_id == cluster_id))
    reactions = reactions_res.scalars().all()
    counts = {"objective": 0, "fact": 0, "fire": 0, "like": 0, "thumb_up": 0}
    for r in reactions:
        if r.reaction_type in counts:
            counts[r.reaction_type] += 1

    return ReactionSummarySchema(
        objective=counts["objective"],
        fact=counts["fact"],
        fire=counts["fire"],
        like=counts["like"],
        thumb_up=counts["thumb_up"],
        user_reaction=user_reaction,
    )


# --- FAVORITES (BOOKMARKS) ---

@router.post("/stories/{cluster_id}/favorite")
async def toggle_favorite(
    cluster_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fav_res = await db.execute(
        select(Favorite).where(
            Favorite.cluster_id == cluster_id,
            Favorite.user_id == current_user.id
        )
    )
    fav = fav_res.scalar_one_or_none()

    if fav:
        await db.delete(fav)
        await db.commit()
        return {"is_favorite": False}
    else:
        new_fav = Favorite(user_id=current_user.id, cluster_id=cluster_id)
        db.add(new_fav)
        await db.commit()
        return {"is_favorite": True}


@router.get("/favorites", response_model=List[StoryClusterResponse])
async def get_user_favorites(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    favorites_res = await db.execute(
        select(Favorite).where(Favorite.user_id == current_user.id)
    )
    favorites = favorites_res.scalars().all()
    cluster_ids = [f.cluster_id for f in favorites]
    if not cluster_ids:
        return []

    clusters_res = await db.execute(
        select(StoryCluster)
        .options(selectinload(StoryCluster.articles).selectinload(Article.source))
        .where(StoryCluster.id.in_(cluster_ids))
        .order_by(desc(StoryCluster.created_at))
    )
    clusters = clusters_res.scalars().all()

    items: List[StoryClusterResponse] = []
    for c in clusters:
        snippets = [
            ArticleSnippet(
                id=art.id,
                title=art.title,
                url=art.url,
                source_name=art.source.name if art.source else None,
                published_at=art.published_at
            )
            for art in (c.articles or [])
        ]
        items.append(
            StoryClusterResponse(
                id=c.id,
                title=c.title,
                summary=c.summary,
                sentiment=c.sentiment,
                political_vectors=c.political_vectors or [],
                quotes=c.quotes or [],
                verified_facts=c.verified_facts or [],
                blindspots=c.blindspots or [],
                article_count=c.article_count or len(c.articles or []),
                sources_count=c.sources_count or 1,
                created_at=c.created_at,
                updated_at=c.updated_at,
                articles=snippets
            )
        )
    return items
