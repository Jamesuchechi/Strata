"""SQLAlchemy ORM models for curated public showcase gallery and user stars."""

from typing import Optional, Any, Dict
from sqlalchemy import Boolean, Float, Integer, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column
from strata_api.core.database import Base


class ShowcaseItemModel(Base):
    """Curated public showcase dataset card."""
    __tablename__ = "showcase_items"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    domain: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    author: Mapped[str] = mapped_column(String(128), nullable=False)
    author_avatar: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    author_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    format: Mapped[str] = mapped_column(String(32), default="parquet", nullable=False)
    license: Mapped[str] = mapped_column(String(64), default="CC-BY-4.0", nullable=False)
    doi: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    tags: Mapped[Any] = mapped_column(JSON, default=list, nullable=False)
    total_rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_columns: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    quality_score: Mapped[float] = mapped_column(Float, default=95.0, nullable=False)
    stars: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    downloads: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    forks: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[str] = mapped_column(String(64), nullable=False)
    schema_fields: Mapped[Any] = mapped_column(JSON, default=list, nullable=False)
    sample_rows: Mapped[Any] = mapped_column(JSON, default=list, nullable=False)
    sample_query: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "slug": self.slug,
            "domain": self.domain,
            "description": self.description,
            "author": self.author,
            "author_avatar": self.author_avatar,
            "author_verified": self.author_verified,
            "format": self.format,
            "license": self.license,
            "doi": self.doi,
            "tags": self.tags or [],
            "total_rows": self.total_rows,
            "total_columns": self.total_columns,
            "size_bytes": self.size_bytes,
            "quality_score": self.quality_score,
            "stars": self.stars,
            "downloads": self.downloads,
            "forks": self.forks,
            "updated_at": self.updated_at,
            "schema_fields": self.schema_fields or [],
            "sample_rows": self.sample_rows or [],
            "sample_query": self.sample_query,
        }


class UserStarredShowcaseModel(Base):
    """User stars on showcase dataset cards."""
    __tablename__ = "user_starred_showcase"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    showcase_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    starred_at: Mapped[str] = mapped_column(String(64), nullable=False)
