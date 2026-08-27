from datetime import datetime
from sqlalchemy import Column, Integer, BigInteger, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    cluster_id = Column(Integer, ForeignKey("story_clusters.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    author_name = Column(String(255), nullable=False)
    author_username = Column(String(255), nullable=True)
    author_avatar = Column(String(512), nullable=True)
    
    text = Column(Text, nullable=False)
    source = Column(String(50), default="web", nullable=False)  # "web" or "telegram"
    tg_message_id = Column(BigInteger, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    cluster = relationship("StoryCluster", back_populates="comments")
    user = relationship("User")


class Favorite(Base):
    __tablename__ = "favorites"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    cluster_id = Column(Integer, ForeignKey("story_clusters.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "cluster_id", name="uq_user_cluster_favorite"),)

    user = relationship("User")
    cluster = relationship("StoryCluster")


class Reaction(Base):
    __tablename__ = "reactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    cluster_id = Column(Integer, ForeignKey("story_clusters.id", ondelete="CASCADE"), nullable=False, index=True)
    reaction_type = Column(String(50), nullable=False)  # "objective", "fact", "fire", "like"
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "cluster_id", name="uq_user_cluster_reaction"),)

    user = relationship("User")
    cluster = relationship("StoryCluster")
