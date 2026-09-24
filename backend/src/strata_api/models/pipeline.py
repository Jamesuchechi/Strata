"""SQLAlchemy ORM models for scheduled pipelines, execution history, and dead letter queue."""

from sqlalchemy import Boolean, Column, Float, Integer, String, Text, JSON
from strata_api.core.database import Base


class PipelineModel(Base):
    """Pipeline definition."""
    __tablename__ = "pipelines"

    id = Column(String(64), primary_key=True)
    owner_id = Column(String(64), nullable=True, index=True)
    name = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    target_dataset_id = Column(String(64), nullable=False, index=True)
    steps = Column(JSON, default=list, nullable=False)
    schedule = Column(String(64), default="0 2 * * *", nullable=False)
    trigger = Column(String(32), default="cron", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    timeout_seconds = Column(Integer, default=60, nullable=False)
    max_memory_mb = Column(Integer, default=512, nullable=False)
    created_at = Column(String(64), nullable=False)
    last_run_at = Column(String(64), nullable=True)
    last_status = Column(String(32), default="never_run", nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "owner_id": self.owner_id,
            "name": self.name,
            "description": self.description,
            "target_dataset_id": self.target_dataset_id,
            "steps": self.steps or [],
            "schedule": self.schedule,
            "trigger": self.trigger,
            "is_active": self.is_active,
            "timeout_seconds": self.timeout_seconds,
            "max_memory_mb": self.max_memory_mb,
            "created_at": self.created_at,
            "last_run_at": self.last_run_at,
            "last_status": self.last_status,
        }


class PipelineRunModel(Base):
    """Pipeline execution history log."""
    __tablename__ = "pipeline_runs"

    id = Column(String(64), primary_key=True)
    pipeline_id = Column(String(64), nullable=False, index=True)
    status = Column(String(32), default="running", nullable=False)
    started_at = Column(String(64), nullable=False)
    completed_at = Column(String(64), nullable=True)
    duration_seconds = Column(Float, default=0.0, nullable=False)
    rows_processed = Column(Integer, default=0, nullable=False)
    logs = Column(JSON, default=list, nullable=False)
    error = Column(Text, nullable=True)
    triggered_by = Column(String(128), default="manual", nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "pipeline_id": self.pipeline_id,
            "status": self.status,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "duration_seconds": self.duration_seconds,
            "rows_processed": self.rows_processed,
            "logs": self.logs or [],
            "error": self.error,
            "triggered_by": self.triggered_by,
        }


class DeadLetterJobModel(Base):
    """Failed pipeline execution job stored for diagnostic and retry."""
    __tablename__ = "dead_letter_jobs"

    id = Column(String(64), primary_key=True)
    job_id = Column(String(64), nullable=False, index=True)
    pipeline_id = Column(String(64), nullable=False, index=True)
    failed_at = Column(String(64), nullable=False)
    error_type = Column(String(128), nullable=False)
    error_message = Column(Text, nullable=False)
    retry_count = Column(Integer, default=0, nullable=False)
    max_retries = Column(Integer, default=3, nullable=False)
    payload = Column(JSON, default=dict, nullable=False)
    status = Column(String(32), default="quarantined", nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "job_id": self.job_id,
            "dlq_id": self.job_id,
            "pipeline_id": self.pipeline_id,
            "failed_at": self.failed_at,
            "timestamp": self.failed_at,
            "error_type": self.error_type,
            "error_message": self.error_message,
            "error": self.error_message,
            "retry_count": self.retry_count,
            "max_retries": self.max_retries,
            "payload": self.payload or {},
            "status": self.status,
            "resolved": (self.status == "resolved"),
        }

