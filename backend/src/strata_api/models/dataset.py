"""SQLAlchemy ORM models for datasets and versions."""

from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from strata_api.core.database import Base


class DatasetModel(Base):
    __tablename__ = "datasets"

    id = Column(String, primary_key=True)
    name = Column(String, unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    versions = relationship("VersionModel", back_populates="dataset", cascade="all, delete-orphan")


class VersionModel(Base):
    __tablename__ = "dataset_versions"

    id = Column(String, primary_key=True)
    dataset_id = Column(String, ForeignKey("datasets.id"), nullable=False, index=True)
    version_hash = Column(String, nullable=False, index=True)
    parent_version_hash = Column(String, nullable=True)
    message = Column(Text, nullable=True)
    format = Column(String, nullable=False)
    byte_size = Column(Integer, nullable=False)
    row_count = Column(Integer, nullable=False)
    column_count = Column(Integer, nullable=False)
    schema_json = Column(JSON, nullable=False)
    profile_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    dataset = relationship("DatasetModel", back_populates="versions")
