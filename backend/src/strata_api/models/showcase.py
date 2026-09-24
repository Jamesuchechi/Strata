"""SQLAlchemy ORM models for curated public showcase gallery and user stars."""

from sqlalchemy import Boolean, Column, Float, Integer, String, Text, JSON
from strata_api.core.database import Base


class ShowcaseItemModel(Base):
    """Curated public showcase dataset card."""
    __tablename__ = "showcase_items"

    id = Column(String(64), primary_key=True)
    title = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False, index=True)
    domain = Column(String(128), nullable=False, index=True)
    description = Column(Text, nullable=False)
    author = Column(String(128), nullable=False)
    author_avatar = Column(Text, nullable=True)
    author_verified = Column(Boolean, default=False, nullable=False)
    format = Column(String(32), default="parquet", nullable=False)
    license = Column(String(64), default="CC-BY-4.0", nullable=False)
    doi = Column(String(128), nullable=True)
    tags = Column(JSON, default=list, nullable=False)
    total_rows = Column(Integer, default=0, nullable=False)
    total_columns = Column(Integer, default=0, nullable=False)
    size_bytes = Column(Integer, default=0, nullable=False)
    quality_score = Column(Float, default=95.0, nullable=False)
    stars = Column(Integer, default=0, nullable=False)
    downloads = Column(Integer, default=0, nullable=False)
    forks = Column(Integer, default=0, nullable=False)
    updated_at = Column(String(64), nullable=False)
    schema_fields = Column(JSON, default=list, nullable=False)
    sample_rows = Column(JSON, default=list, nullable=False)
    sample_query = Column(Text, nullable=True)

    def to_dict(self):
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

    id = Column(String(64), primary_key=True)
    user_id = Column(String(64), nullable=False, index=True)
    showcase_id = Column(String(64), nullable=False, index=True)
    starred_at = Column(String(64), nullable=False)
