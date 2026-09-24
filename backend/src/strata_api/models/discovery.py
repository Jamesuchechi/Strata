"""SQLAlchemy ORM models for favorites and recently viewed datasets."""

from sqlalchemy import Column, String
from strata_api.core.database import Base


class UserFavoriteModel(Base):
    """User starred / favorited dataset."""
    __tablename__ = "user_favorites"

    id = Column(String(64), primary_key=True)
    user_id = Column(String(64), nullable=False, index=True)
    dataset_id = Column(String(64), nullable=False, index=True)
    created_at = Column(String(64), nullable=False)


class UserRecentModel(Base):
    """Recently accessed dataset by user."""
    __tablename__ = "user_recents"

    id = Column(String(64), primary_key=True)
    user_id = Column(String(64), nullable=False, index=True)
    dataset_id = Column(String(64), nullable=False, index=True)
    viewed_at = Column(String(64), nullable=False)
