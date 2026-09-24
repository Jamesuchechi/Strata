"""SQLAlchemy ORM models for ecosystem integrations and webhooks."""

from sqlalchemy import Boolean, Column, Integer, String, Text, JSON
from strata_api.core.database import Base


class WebhookConfigModel(Base):
    """Outgoing webhook integration configurations."""
    __tablename__ = "webhook_configs"

    id = Column(String(64), primary_key=True)
    service = Column(String(64), nullable=False)
    name = Column(String(128), nullable=False)
    url = Column(Text, nullable=False)
    events = Column(JSON, default=list, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "service": self.service,
            "name": self.name,
            "url": self.url,
            "events": self.events or [],
            "is_active": self.is_active,
        }


class IntegrationEventModel(Base):
    """Dispatched webhook event telemetry and response logs."""
    __tablename__ = "integration_events"

    id = Column(String(64), primary_key=True)
    webhook_id = Column(String(64), nullable=True, index=True)
    event_type = Column(String(64), nullable=False, index=True)
    payload = Column(JSON, default=dict, nullable=False)
    status = Column(String(32), default="delivered", nullable=False)
    status_code = Column(Integer, default=200, nullable=False)
    response_body = Column(Text, nullable=True)
    timestamp = Column(String(64), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "webhook_id": self.webhook_id,
            "event_type": self.event_type,
            "payload": self.payload or {},
            "status": self.status,
            "status_code": self.status_code,
            "response_body": self.response_body,
            "timestamp": self.timestamp,
        }
