"""SQLAlchemy ORM models for ecosystem integrations and webhooks."""

from typing import Optional, Any, Dict
from sqlalchemy import Boolean, Integer, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column
from strata_api.core.database import Base


class WebhookConfigModel(Base):
    """Outgoing webhook integration configurations."""
    __tablename__ = "webhook_configs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    service: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    events: Mapped[Any] = mapped_column(JSON, default=list, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    def to_dict(self) -> Dict[str, Any]:
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

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    webhook_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    payload: Mapped[Any] = mapped_column(JSON, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="delivered", nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, default=200, nullable=False)
    response_body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    timestamp: Mapped[str] = mapped_column(String(64), nullable=False)

    def to_dict(self) -> Dict[str, Any]:
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
