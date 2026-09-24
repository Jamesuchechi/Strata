"""SQLAlchemy ORM models for Git-style versioning: Commits and Branches."""

from sqlalchemy import Boolean, Column, Integer, String, Text, JSON
from strata_api.core.database import Base


class CommitModel(Base):
    """Immutable Git-style dataset commit."""
    __tablename__ = "commits"

    id = Column(String(64), primary_key=True)
    hash = Column(String(16), nullable=False, index=True)
    full_hash = Column(String(128), nullable=False, index=True)
    dataset_name = Column(String(255), nullable=False, index=True)
    parent_hash = Column(String(128), nullable=True)
    version_tag = Column(String(32), default="v1.0.0", nullable=False)
    message = Column(Text, nullable=False)
    author = Column(String(128), default="James Uchechi", nullable=False)
    timestamp = Column(String(64), nullable=False)
    delta_rows = Column(String(64), default="+0 rows", nullable=False)
    delta_columns = Column(String(64), default="+0 cols", nullable=False)
    added_cols = Column(JSON, default=list, nullable=False)
    removed_cols = Column(JSON, default=list, nullable=False)
    modified_cols = Column(JSON, default=list, nullable=False)
    tags = Column(JSON, default=list, nullable=False)
    is_pinned = Column(Boolean, default=False, nullable=False)
    access_level = Column(String(32), default="workspace", nullable=False)
    custom_metadata = Column(JSON, default=dict, nullable=False)
    owner_id = Column(String(64), nullable=True, index=True)

    def to_dict(self):
        added = self.added_cols or []
        removed = self.removed_cols or []
        modified = self.modified_cols or []
        return {
            "id": self.id,
            "hash": self.hash,
            "full_hash": self.full_hash,
            "dataset_name": self.dataset_name,
            "parent_hash": self.parent_hash,
            "version": self.version_tag,
            "version_tag": self.version_tag,
            "message": self.message,
            "author": self.author,
            "date": self.timestamp,
            "timestamp": self.timestamp,
            "delta_rows": self.delta_rows,
            "deltaRows": self.delta_rows,
            "delta_columns": self.delta_columns,
            "deltaColumns": self.delta_columns,
            "added_cols": added,
            "removed_cols": removed,
            "modified_cols": modified,
            "diffSummary": {
                "addedCols": added,
                "removedCols": removed,
                "modifiedCols": modified,
            },
            "tags": self.tags or [],
            "is_pinned": self.is_pinned,
            "access_level": self.access_level,
            "custom_metadata": self.custom_metadata or {},
            "owner_id": self.owner_id,
            "status": "verified",
        }



class BranchModel(Base):
    """Git-style dataset branch."""
    __tablename__ = "branches"

    id = Column(String(128), primary_key=True)  # dataset_name:branch_name
    dataset_name = Column(String(255), nullable=False, index=True)
    name = Column(String(128), nullable=False, index=True)
    head_commit_id = Column(String(64), nullable=False)
    head_hash = Column(String(128), nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)
    protected = Column(Boolean, default=False, nullable=False)
    created_at = Column(String(64), nullable=False)
    created_by = Column(String(128), default="System", nullable=False)
    description = Column(Text, nullable=True)
    ahead_count = Column(Integer, default=0, nullable=False)
    behind_count = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=False, nullable=False)

    def to_dict(self):
        return {
            "name": self.name,
            "dataset_name": self.dataset_name,
            "head_commit_id": self.head_commit_id,
            "head_hash": self.head_hash,
            "is_default": self.is_default,
            "protected": self.protected,
            "created_at": self.created_at,
            "created_by": self.created_by,
            "description": self.description,
            "ahead_count": self.ahead_count,
            "behind_count": self.behind_count,
        }
