"""SQLAlchemy ORM models for ML Model Registry and lineage linkage."""

from typing import Optional, Any, Dict
from sqlalchemy import String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column
from strata_api.core.database import Base


class MLModelModel(Base):
    """Registered ML model tied to an immutable dataset version hash."""
    __tablename__ = "ml_models"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    framework: Mapped[str] = mapped_column(String(64), nullable=False)
    algorithm: Mapped[str] = mapped_column(String(64), default="Classifier", nullable=False)
    version: Mapped[str] = mapped_column(String(32), default="v1.0.0", nullable=False)
    dataset_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    dataset_version_hash: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    experiment_tracker: Mapped[str] = mapped_column(String(64), default="MLflow", nullable=False)
    run_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    metrics: Mapped[Any] = mapped_column(JSON, default=dict, nullable=False)
    hyperparameters: Mapped[Any] = mapped_column(JSON, default=dict, nullable=False)
    artifact_uri: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    author: Mapped[str] = mapped_column(String(128), default="Owner", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="staging", nullable=False)
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "owner_id": self.owner_id,
            "name": self.name,
            "framework": self.framework,
            "algorithm": self.algorithm,
            "version": self.version,
            "dataset_name": self.dataset_name,
            "dataset_version_hash": self.dataset_version_hash,
            "experiment_tracker": self.experiment_tracker,
            "run_id": self.run_id,
            "metrics": self.metrics or {},
            "hyperparameters": self.hyperparameters or {},
            "artifact_uri": self.artifact_uri,
            "author": self.author,
            "status": self.status,
            "created_at": self.created_at,
        }
