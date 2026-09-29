"""SQLAlchemy ORM models for workspaces, collaboration, RBAC, and review requests."""

from typing import Optional
from sqlalchemy import Boolean, Column, Integer, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column
from strata_api.core.database import Base


class WorkspaceModel(Base):
    """Team workspace for multi-tenancy."""
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    slug: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    plan: Mapped[str] = mapped_column(String(64), default="Pro Team", nullable=False)
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)
    owner_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "slug": self.slug,
            "description": self.description,
            "plan": self.plan,
            "created_at": self.created_at,
            "owner_id": self.owner_id,
        }


class WorkspaceMemberModel(Base):
    """Member assigned to a workspace with role-based access control."""
    __tablename__ = "workspace_members"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    workspace_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(64), default="Analyst", nullable=False)
    joined_at: Mapped[str] = mapped_column(String(64), nullable=False)
    avatar: Mapped[str] = mapped_column(String(32), default="US", nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "user_id": self.user_id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "joined_at": self.joined_at,
            "avatar": self.avatar,
        }


class WorkspaceInvitationModel(Base):
    """Pending member invitation."""
    __tablename__ = "workspace_invitations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    workspace_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(64), default="Analyst", nullable=False)
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "email": self.email,
            "role": self.role,
            "created_at": self.created_at,
            "status": self.status,
        }


class DatasetPermissionModel(Base):
    """Per-dataset role override in a workspace."""
    __tablename__ = "dataset_permissions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    workspace_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    dataset_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    min_role: Mapped[str] = mapped_column(String(64), default="Viewer", nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "dataset_id": self.dataset_id,
            "min_role": self.min_role,
        }


class ActivityLogModel(Base):
    """Workspace activity stream event."""
    __tablename__ = "activity_logs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    workspace_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    dataset_name: Mapped[str] = mapped_column(String(255), default="General", nullable=False)
    actor_name: Mapped[str] = mapped_column(String(128), nullable=False)
    action: Mapped[str] = mapped_column(String(128), nullable=False)
    details: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[str] = mapped_column(String(64), nullable=False)
    badge_color: Mapped[str] = mapped_column(String(32), default="blue", nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "workspace_id": self.workspace_id,
            "dataset_name": self.dataset_name,
            "actor_name": self.actor_name,
            "action": self.action,
            "details": self.details,
            "timestamp": self.timestamp,
            "badge_color": self.badge_color,
        }


class DatasetCommentModel(Base):
    """Cell/row level comment on a dataset."""
    __tablename__ = "dataset_comments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    dataset_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    row_index: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    column_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    author_name: Mapped[str] = mapped_column(String(128), nullable=False)
    author_role: Mapped[str] = mapped_column(String(64), default="Owner", nullable=False)
    comment: Mapped[str] = mapped_column(Text, nullable=False)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "dataset_id": self.dataset_id,
            "row_index": self.row_index,
            "column_name": self.column_name,
            "author_name": self.author_name,
            "author_role": self.author_role,
            "comment": self.comment,
            "resolved": self.resolved,
            "created_at": self.created_at,
        }


class ReviewRequestModel(Base):
    """Branch merge and release approval review request."""
    __tablename__ = "review_requests"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    dataset_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    source_branch: Mapped[str] = mapped_column(String(128), nullable=False)
    target_branch: Mapped[str] = mapped_column(String(128), default="main", nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    author: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="open", nullable=False)
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "dataset_name": self.dataset_name,
            "source_branch": self.source_branch,
            "target_branch": self.target_branch,
            "title": self.title,
            "author": self.author,
            "status": self.status,
            "created_at": self.created_at,
        }
