"""Pytest fixtures for Strata backend test suite.
Provides isolated in-memory test fixtures for datasets, models, and pipelines during testing
so that production code starts 100% clean with zero pre-seeded mock records.
"""

import os
import hashlib
import tempfile
import concurrent.futures
import asyncio
import pytest
import polars as pl
from sqlalchemy import select

from strata_api.core.database import AsyncSessionLocal, init_db
from strata_api.models.user import UserModel
from strata_api.core.security import hash_password, create_access_token
from strata_api.routers.datasets import _datasets_db, register_dataset_in_store, get_storage_dir
from strata_api.routers.lineage import _models_db
from strata_api.routers.pipelines import _pipelines_db
from strata_api.versioning.registry import record_commit

TEST_USER_A_ID = "usr_test_a_00000001"
TEST_USER_A_EMAIL = "test_user_a@strata.ai"
TEST_USER_B_ID = "usr_test_b_00000002"
TEST_USER_B_EMAIL = "test_user_b@strata.ai"

TEST_TOKEN_A = create_access_token({"sub": TEST_USER_A_ID})
TEST_TOKEN_B = create_access_token({"sub": TEST_USER_B_ID})

AUTH_HEADERS_A = {"Authorization": f"Bearer {TEST_TOKEN_A}"}
AUTH_HEADERS_B = {"Authorization": f"Bearer {TEST_TOKEN_B}"}


async def _seed_users_coro():
    await init_db()
    async with AsyncSessionLocal() as session:
        result_a = await session.execute(select(UserModel).where(UserModel.id == TEST_USER_A_ID))
        if not result_a.scalar_one_or_none():
            user_a = UserModel(
                id=TEST_USER_A_ID,
                email=TEST_USER_A_EMAIL,
                hashed_password=hash_password("Password123!"),
                full_name="Test User A",
                role="data_engineer",
                is_active=True,
                is_verified=True,
            )
            session.add(user_a)

        result_b = await session.execute(select(UserModel).where(UserModel.id == TEST_USER_B_ID))
        if not result_b.scalar_one_or_none():
            user_b = UserModel(
                id=TEST_USER_B_ID,
                email=TEST_USER_B_EMAIL,
                hashed_password=hash_password("Password123!"),
                full_name="Test User B",
                role="data_analyst",
                is_active=True,
                is_verified=True,
            )
            session.add(user_b)
        await session.commit()


def _sync_init_and_seed_users():
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(lambda: asyncio.run(_seed_users_coro()))
        future.result()


from strata_api.core.rate_limiter import reset_rate_limiter
from strata_api.core.security import clear_revoked_tokens


@pytest.fixture(autouse=True)
def setup_test_environment():
    """Setup isolated test fixtures for tests that test pipeline, discovery, and lineage functionality."""
    reset_rate_limiter()
    clear_revoked_tokens()
    _sync_init_and_seed_users()
    from strata_api.core.persistence import delete_dataset_from_db
    for d_id in list(_datasets_db.keys()):
        fname = _datasets_db[d_id].get("filename", "")
        if "test_dedup" in fname or "engineers.csv" in fname:
            del _datasets_db[d_id]
            delete_dataset_from_db(d_id)
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
            owner_id=TEST_USER_A_ID,
        )
    else:
        _datasets_db["churn_demo"]["owner_id"] = TEST_USER_A_ID

    # Ensure test commit hash is tracked for lineage tests
    try:
        record_commit(
            version_hash="0ff58aa",
            dataset_name="customer_churn.csv",
            version_tag="v1.0.0",
            message="Initial baseline commit for churn_demo",
            author="Test User A",
            delta_rows="+15 rows",
            delta_columns="+9 cols",
            owner_id=TEST_USER_A_ID,
        )
    except Exception:
        pass
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
            "owner_id": TEST_USER_A_ID,
        })
    else:
        for m in _models_db:
            if m.get("id") == "mod_lgbm_churn_v1":
                m["owner_id"] = TEST_USER_A_ID

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
            "owner_id": TEST_USER_A_ID,
            "steps": [
                {"step_id": "step_1", "name": "Filter Invalid Churn Records", "type": "filter", "condition": "monthly_charges > 0"},
                {"step_id": "step_2", "name": "Compute Spend Intensity", "type": "expression", "expr": "total_spend / (tenure_months + 1)", "output_col": "spend_per_month"},
            ],
            "created_at": "2026-09-01T00:00:00Z",
            "last_run_at": None,
            "last_status": "never_run",
        }
    else:
        _pipelines_db["pipe_churn_etl"]["owner_id"] = TEST_USER_A_ID

    yield
