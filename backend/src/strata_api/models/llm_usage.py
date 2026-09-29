"""SQLAlchemy ORM model for LLM daily usage tracking and cost guardrails."""

import datetime
import uuid
from typing import Optional
from sqlalchemy import Date, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from strata_api.core.database import Base


class LLMUsageModel(Base):
    """Tracks daily LLM provider call counts per user or workspace for quota enforcement."""

    __tablename__ = "llm_usage"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    workspace_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    date: Mapped[datetime.date] = mapped_column(Date, nullable=False, index=True)
    call_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "workspace_id", "date", name="uq_user_ws_date"),
    )
