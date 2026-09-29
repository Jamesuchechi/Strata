"""SQLAlchemy ORM models for datasets, versions, and share links."""

from typing import Optional, Any, Dict, List
from datetime import datetime, timezone
from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, JSON, Float, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from strata_api.core.database import Base


class DatasetModel(Base):
    """Dataset metadata record."""
    __tablename__ = "datasets"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    workspace_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[Any] = mapped_column(JSON, default=list, nullable=False)
    format: Mapped[str] = mapped_column(String(32), default="unknown", nullable=False)
    content_hash: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    view_name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    total_rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_columns: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)
    quality_score: Mapped[float] = mapped_column(Float, default=90.0, nullable=False)
    latest_version: Mapped[str] = mapped_column(String(32), default="v1.0.0", nullable=False)
    version_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    
    # Cached preview fields for high-performance retrieval
    schema_fields: Mapped[Any] = mapped_column(JSON, default=list, nullable=False)
    preview_rows: Mapped[Any] = mapped_column(JSON, default=list, nullable=False)
    sheets: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    active_sheet: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    column_stats: Mapped[Any] = mapped_column(JSON, default=list, nullable=False)
    pii_flags: Mapped[Any] = mapped_column(JSON, default=dict, nullable=False)
    full_quality: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)

    versions: Mapped[List["VersionModel"]] = relationship("VersionModel", back_populates="dataset", cascade="all, delete-orphan")
    share_links: Mapped[List["ShareLinkModel"]] = relationship("ShareLinkModel", back_populates="dataset", cascade="all, delete-orphan")

    def to_dict(self) -> Dict[str, Any]:
        """Serialize model into dictionary format matching dataset router contract."""
        return {
            "id": self.id,
            "owner_id": self.owner_id,
            "workspace_id": self.workspace_id,
            "name": self.name,
            "filename": self.filename,
            "file_path": self.file_path,
            "description": self.description,
            "tags": self.tags or [],
            "format": self.format,
            "content_hash": self.content_hash,
            "view_name": self.view_name,
            "total_rows": self.total_rows,
            "total_columns": self.total_columns,
            "size_bytes": self.size_bytes,
            "created_at": self.created_at,
            "quality_score": self.quality_score,
            "latest_version": self.latest_version,
            "version_count": self.version_count,
            "schema_fields": self.schema_fields or [],
            "preview_rows": self.preview_rows or [],
            "sheets": self.sheets,
            "active_sheet": self.active_sheet,
            "column_stats": self.column_stats or [],
            "pii_flags": self.pii_flags or {},
            "full_quality": self.full_quality,
        }


class VersionModel(Base):
    """Immutable dataset version checkpoint."""
    __tablename__ = "dataset_versions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    dataset_id: Mapped[str] = mapped_column(String(64), ForeignKey("datasets.id"), nullable=False, index=True)
    version_hash: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    parent_version_hash: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    version_tag: Mapped[str] = mapped_column(String(32), default="v1.0.0", nullable=False)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    format: Mapped[str] = mapped_column(String(32), default="parquet", nullable=False)
    byte_size: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    row_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    column_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    schema_json: Mapped[Any] = mapped_column(JSON, default=list, nullable=False)
    profile_json: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)

    dataset: Mapped["DatasetModel"] = relationship("DatasetModel", back_populates="versions")


class ShareLinkModel(Base):
    """Public read-only shareable links for datasets."""
    __tablename__ = "share_links"

    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    dataset_id: Mapped[str] = mapped_column(String(64), ForeignKey("datasets.id"), nullable=False, index=True)
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)

    dataset: Mapped["DatasetModel"] = relationship("DatasetModel", back_populates="share_links")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "token": self.token,
            "dataset_id": self.dataset_id,
            "created_at": self.created_at,
        }
