"""Pytest fixtures for Strata backend test suite.
Provides isolated in-memory test fixtures for datasets, models, and pipelines during testing
so that production code starts 100% clean with zero pre-seeded mock records.
"""

import os
import hashlib
import tempfile
import pytest
import polars as pl

from strata_api.routers.datasets import _datasets_db, register_dataset_in_store, get_storage_dir
from strata_api.routers.lineage import _models_db
from strata_api.routers.pipelines import _pipelines_db
from strata_api.versioning.registry import record_commit


@pytest.fixture(autouse=True)
def setup_test_environment():
    """Setup isolated test fixtures for tests that test pipeline, discovery, and lineage functionality."""
    storage_dir = get_storage_dir()
    test_churn_path = os.path.join(storage_dir, "test_customer_churn.csv")

    if not os.path.exists(test_churn_path):
        churn_df = pl.DataFrame({
            "customer_id": [f"CUST-{1000 + i}" for i in range(15)],
            "customer_name": [f"Customer {i}" for i in range(15)],
            "email": [f"user_{i}@example.com" for i in range(15)],
            "country": ["United States", "Germany", "United Kingdom"] * 5,
            "tenure_months": [12, 3, 45, 8, 60] * 3,
            "monthly_charges": [65.5, 89.2, 45.0, 110.4, 75.8] * 3,
            "total_spend": [786.0, 267.6, 2025.0, 883.2, 4548.0] * 3,
            "churn_probability": [0.12, 0.78, 0.05, 0.65, 0.08] * 3,
            "churned": ["No", "Yes", "No", "Yes", "No"] * 3,
        })
        churn_df.write_csv(test_churn_path)

    churn_hash = "0ff58aa1234567890abcdef"
    if "churn_demo" not in _datasets_db:
        register_dataset_in_store(
            file_path=test_churn_path,
            filename="customer_churn.csv",
            content_hash=churn_hash,
            description="Subscription churn metrics, customer lifetime values, and churn probability predictions.",
            tags=["csv", "marketing", "churn", "saas"],
            custom_id="churn_demo",
        )

    # Ensure test commit hash is tracked for lineage tests
    try:
        record_commit(
            version_hash="0ff58aa",
            dataset_name="customer_churn.csv",
            version_tag="v1.0.0",
            message="Initial baseline commit for churn_demo",
            author="Test User",
            delta_rows="+15 rows",
            delta_columns="+9 cols",
        )
    except Exception:
        pass

    # Ensure test model is registered for lineage tests
    if not any(m["id"] == "mod_lgbm_churn_v1" for m in _models_db):
        _models_db.append({
            "id": "mod_lgbm_churn_v1",
            "name": "Customer Churn Classifier",
            "framework": "LightGBM",
            "algorithm": "LGBMClassifier",
            "version": "v1.0.0",
            "dataset_name": "customer_churn.csv",
            "dataset_version_hash": "0ff58aa",
            "experiment_tracker": "MLflow",
            "run_id": "mlflow-run-9481a8b2",
            "metrics": {"auc": 0.941, "accuracy": 0.892},
            "hyperparameters": {"n_estimators": 150},
            "artifact_uri": "s3://strata-models/checkpoints/churn_lgbm_v1.bin",
            "created_at": "2026-09-20T12:00:00Z",
            "author": "Test Author",
            "status": "production",
        })

    # Ensure test pipeline is registered for pipeline execution tests
    if "pipe_churn_etl" not in _pipelines_db:
        _pipelines_db["pipe_churn_etl"] = {
            "id": "pipe_churn_etl",
            "name": "Daily Churn Telemetry & Feature Pipeline",
            "description": "Production ETL pipeline for tests.",
            "target_dataset_id": "churn_demo",
            "schedule": "0 2 * * *",
            "trigger": "cron",
            "is_active": True,
            "timeout_seconds": 60,
            "max_memory_mb": 512,
            "steps": [
                {"step_id": "step_1", "name": "Filter Invalid Churn Records", "type": "filter", "condition": "monthly_charges > 0"},
                {"step_id": "step_2", "name": "Compute Spend Intensity", "type": "expression", "expr": "total_spend / (tenure_months + 1)", "output_col": "spend_per_month"},
            ],
            "created_at": "2026-09-01T00:00:00Z",
            "last_run_at": None,
            "last_status": "never_run",
        }

    yield
