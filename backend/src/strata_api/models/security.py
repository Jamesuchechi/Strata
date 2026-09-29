"""SQLAlchemy ORM models for security and audit trail."""

from typing import Any, Dict
from sqlalchemy import String, Text, JSON
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
