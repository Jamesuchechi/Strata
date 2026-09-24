"""SQLAlchemy ORM models for ML Model Registry and lineage linkage."""

from sqlalchemy import Column, String, Text, JSON
from strata_api.core.database import Base


class MLModelModel(Base):
    """Registered ML model tied to an immutable dataset version hash."""
    __tablename__ = "ml_models"

    id = Column(String(64), primary_key=True)
    owner_id = Column(String(64), nullable=True, index=True)
    name = Column(String(128), nullable=False, index=True)
    framework = Column(String(64), nullable=False)
    algorithm = Column(String(64), default="Classifier", nullable=False)
    version = Column(String(32), default="v1.0.0", nullable=False)
    dataset_name = Column(String(255), nullable=False, index=True)
    dataset_version_hash = Column(String(128), nullable=False, index=True)
    experiment_tracker = Column(String(64), default="MLflow", nullable=False)
    run_id = Column(String(128), nullable=True)
    metrics = Column(JSON, default=dict, nullable=False)
    hyperparameters = Column(JSON, default=dict, nullable=False)
    artifact_uri = Column(Text, nullable=True)
    author = Column(String(128), default="Owner", nullable=False)
    status = Column(String(32), default="staging", nullable=False)
    created_at = Column(String(64), nullable=False)

    def to_dict(self):
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
