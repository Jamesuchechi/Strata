"""SQLAlchemy ORM models for favorites, recently viewed datasets, and semantic embeddings."""

from typing import Optional, Any, Dict
from sqlalchemy import String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column
from strata_api.core.database import Base


class UserFavoriteModel(Base):
    """User starred / favorited dataset."""
    __tablename__ = "user_favorites"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    dataset_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)


class UserRecentModel(Base):
    """Recently accessed dataset by user."""
    __tablename__ = "user_recents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    dataset_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    viewed_at: Mapped[str] = mapped_column(String(64), nullable=False)


class DatasetEmbeddingModel(Base):
    """Stores high-dimensional embedding vectors for dataset discovery and semantic search."""
    __tablename__ = "dataset_embeddings"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    dataset_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    embedding: Mapped[Any] = mapped_column(JSON, nullable=False)  # 1024-dimensional float vector
    corpus_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    model_name: Mapped[str] = mapped_column(String(64), default="mistral-embed", nullable=False)
    updated_at: Mapped[str] = mapped_column(String(64), nullable=False)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "dataset_id": self.dataset_id,
            "embedding": self.embedding,
            "corpus_text": self.corpus_text,
            "model_name": self.model_name,
            "updated_at": self.updated_at,
        }

