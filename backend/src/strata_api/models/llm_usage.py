"""SQLAlchemy ORM model for LLM daily usage tracking and cost guardrails."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Date, UniqueConstraint
from strata_api.core.database import Base


class LLMUsageModel(Base):
    """Tracks daily LLM provider call counts per user or workspace for quota enforcement."""

    __tablename__ = "llm_usage"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=True, index=True)
    workspace_id = Column(String(36), nullable=True, index=True)
    date = Column(Date, nullable=False, index=True)
    call_count = Column(Integer, default=0, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "workspace_id", "date", name="uq_user_ws_date"),
    )
