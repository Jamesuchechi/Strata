"""SQLAlchemy ORM models for security and audit trail."""

from sqlalchemy import Column, String, Text, JSON
from strata_api.core.database import Base


class AuditTrailModel(Base):
    """Cryptographic immutable audit log entry."""
    __tablename__ = "audit_trail"

    id = Column(String(64), primary_key=True)
    actor = Column(String(128), nullable=False, index=True)
    action = Column(String(128), nullable=False, index=True)
    target = Column(String(255), nullable=False)
    ip_address = Column(String(64), default="127.0.0.1", nullable=False)
    timestamp = Column(String(64), nullable=False, index=True)
    details = Column(JSON, default=dict, nullable=False)
    prev_hash = Column(String(64), nullable=False)
    hash = Column(String(64), nullable=False)

    def to_dict(self):
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
