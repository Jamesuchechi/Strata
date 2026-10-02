"""SQLAlchemy ORM models for security and audit trail."""

from datetime import datetime, timezone
from typing import Any, Dict, Optional
from sqlalchemy import String, Text, JSON, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from strata_api.core.database import Base


class AuditTrailModel(Base):
    """Cryptographic immutable audit log entry."""
    __tablename__ = "audit_trail"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    actor: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    target: Mapped[str] = mapped_column(String(255), nullable=False)
    ip_address: Mapped[str] = mapped_column(String(64), default="127.0.0.1", nullable=False)
    timestamp: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    details: Mapped[Any] = mapped_column(JSON, default=dict, nullable=False)
    prev_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    hash: Mapped[str] = mapped_column(String(64), nullable=False)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "actor": self.actor,
            "action": self.action,
            "target": self.target,
            "ip_address": self.ip_address,
            "timestamp": self.timestamp,
            "details": self.details or {},
            "prev_hash": self.prev_hash,
            "hash": self.hash,
        }


class ApiKeyModel(Base):
    """Persisted programmatic API key record."""
    __tablename__ = "api_keys"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    workspace_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    name: Mapped[str] = mapped_column(String(128), default="Default API Key", nullable=False)
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    key_prefix: Mapped[str] = mapped_column(String(32), nullable=False)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "workspace_id": self.workspace_id,
            "name": self.name,
            "key_hash": self.key_hash,
            "key_prefix": self.key_prefix,
            "is_revoked": self.is_revoked,
            "created_at": self.created_at,
            "expires_at": self.expires_at,
            "last_used_at": self.last_used_at,
        }


class RevokedTokenModel(Base):
    """Persisted token revocation list entry (JTIs and raw token signatures)."""
    __tablename__ = "revoked_tokens"

    jti: Mapped[str] = mapped_column(String(255), primary_key=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)
    revoked_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "jti": self.jti,
            "user_id": self.user_id,
            "revoked_at": self.revoked_at,
            "expires_at": self.expires_at,
        }

