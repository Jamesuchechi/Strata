"""SQLAlchemy ORM models for datasets, versions, and share links."""

from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, JSON, Float, Boolean
from sqlalchemy.orm import relationship
from strata_api.core.database import Base


class DatasetModel(Base):
    """Dataset metadata record."""
    __tablename__ = "datasets"

    id = Column(String(64), primary_key=True)
    owner_id = Column(String(64), nullable=True, index=True)
    workspace_id = Column(String(64), nullable=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    tags = Column(JSON, default=list, nullable=False)
    format = Column(String(32), default="unknown", nullable=False)
    content_hash = Column(String(128), nullable=False, index=True)
    view_name = Column(String(128), nullable=False, index=True)
    total_rows = Column(Integer, default=0, nullable=False)
    total_columns = Column(Integer, default=0, nullable=False)
    size_bytes = Column(Integer, default=0, nullable=False)
    created_at = Column(String(64), nullable=False)
    quality_score = Column(Float, default=90.0, nullable=False)
    latest_version = Column(String(32), default="v1.0.0", nullable=False)
    version_count = Column(Integer, default=1, nullable=False)
    
    # Cached preview fields for high-performance retrieval
    schema_fields = Column(JSON, default=list, nullable=False)
    preview_rows = Column(JSON, default=list, nullable=False)
    sheets = Column(JSON, nullable=True)
    active_sheet = Column(String(128), nullable=True)
    column_stats = Column(JSON, default=list, nullable=False)
    pii_flags = Column(JSON, default=dict, nullable=False)
    full_quality = Column(JSON, nullable=True)

    versions = relationship("VersionModel", back_populates="dataset", cascade="all, delete-orphan")
    share_links = relationship("ShareLinkModel", back_populates="dataset", cascade="all, delete-orphan")

    def to_dict(self):
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

    id = Column(String(64), primary_key=True)
    dataset_id = Column(String(64), ForeignKey("datasets.id"), nullable=False, index=True)
    version_hash = Column(String(128), nullable=False, index=True)
    parent_version_hash = Column(String(128), nullable=True)
    version_tag = Column(String(32), default="v1.0.0", nullable=False)
    message = Column(Text, nullable=True)
    format = Column(String(32), default="parquet", nullable=False)
    byte_size = Column(Integer, default=0, nullable=False)
    row_count = Column(Integer, default=0, nullable=False)
    column_count = Column(Integer, default=0, nullable=False)
    schema_json = Column(JSON, default=list, nullable=False)
    profile_json = Column(JSON, nullable=True)
    created_at = Column(String(64), nullable=False)

    dataset = relationship("DatasetModel", back_populates="versions")


class ShareLinkModel(Base):
    """Public read-only shareable links for datasets."""
    __tablename__ = "share_links"

    token = Column(String(64), primary_key=True)
    dataset_id = Column(String(64), ForeignKey("datasets.id"), nullable=False, index=True)
    created_at = Column(String(64), nullable=False)

    dataset = relationship("DatasetModel", back_populates="share_links")

    def to_dict(self):
        return {
            "token": self.token,
            "dataset_id": self.dataset_id,
            "created_at": self.created_at,
        }
