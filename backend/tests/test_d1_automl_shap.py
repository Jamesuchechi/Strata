"""Acceptance tests for Phase D1: AutoML with LightGBM, XGBoost, and real SHAP explanations.

Acceptance criteria from FIX.md §D1:
  • Train each of the three model families (random_forest, lightgbm, xgboost) on a real dataset.
  • Assert SHAP values are returned and non-trivial (not all zeros).
  • Summary plot distribution data and per-row waterfall explanation data are populated.
  • Data leakage detection correctly identifies target duplicates / contamination.
"""

import io
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from strata_api.main import create_app
from strata_api.core.arq_worker import train_automl_task
from tests.conftest import AUTH_HEADERS_A

client = TestClient(create_app(), headers=AUTH_HEADERS_A)


class _MockJob:
    job_id = "mock_automl_d1_job"


@pytest.fixture
def sample_dataset_record(tmp_path):
    """Create a temporary real dataset with numeric, categorical, and target columns."""
    csv_content = (
        "age,income,credit_score,education,churn\n"
        "25,45000.0,650,Bachelors,0\n"
        "42,85000.0,720,Masters,0\n"
        "31,52000.0,590,HighSchool,1\n"
        "55,120000.0,810,PhD,0\n"
        "22,28000.0,510,HighSchool,1\n"
        "38,71000.0,680,Bachelors,0\n"
        "49,95000.0,740,Masters,0\n"
        "28,39000.0,560,HighSchool,1\n"
        "61,110000.0,790,PhD,0\n"
        "34,60000.0,620,Bachelors,1\n"
        "45,88000.0,710,Masters,0\n"
        "29,42000.0,580,HighSchool,1\n"
        "50,102000.0,760,PhD,0\n"
        "26,34000.0,530,HighSchool,1\n"
        "39,78000.0,690,Bachelors,0\n"
        "33,56000.0,610,Bachelors,1\n"
    )
    file_path = str(tmp_path / "customer_churn.csv")
    with open(file_path, "w") as f:
        f.write(csv_content)

    return {
        "id": "ds_d1_test_churn",
        "filename": "customer_churn.csv",
        "file_path": file_path,
        "format": "csv",
        "owner_id": "usr_test_a_00000001",
    }


@pytest.mark.asyncio
@pytest.mark.parametrize("model_family,expected_name", [
    ("random_forest", "Random Forest"),
    ("lightgbm", "LightGBM"),
    ("xgboost", "XGBoost"),
])
async def test_automl_classification_model_families_and_shap(sample_dataset_record, model_family, expected_name):
    """Test training classification models across all 3 families with real SHAP values."""
    res = await train_automl_task(
        ctx={},
        dataset_record=sample_dataset_record,
        target_column="churn",
        task_type="classification",
        model_family=model_family,
    )

    assert res["model_name"] == expected_name
    assert res["model_family"] == model_family
    assert res["task_type"] == "classification"
    assert res["diagnostics"]["accuracy"] >= 0.0
    assert "confusion_matrix" in res["diagnostics"]

    # Verify SHAP summary
    assert "shap" in res
    shap_data = res["shap"]
    assert "summary" in shap_data
    summary_features = shap_data["summary"]
    assert len(summary_features) > 0

    # Ensure SHAP values are non-trivial (not all zero)
    mean_shaps = [f["mean_abs_shap"] for f in summary_features]
    assert any(val > 0 for val in mean_shaps), "Expected non-zero SHAP importance values"

    # Check distribution points in summary
    for f in summary_features:
        assert "distribution" in f
        assert len(f["distribution"]) > 0
        assert "shap_value" in f["distribution"][0]
        assert "feature_value" in f["distribution"][0]

    # Verify SHAP waterfall
    assert "waterfall" in shap_data
    waterfall = shap_data["waterfall"]
    assert "base_value" in waterfall
    assert "prediction_value" in waterfall
    assert "feature_contributions" in waterfall
    assert len(waterfall["feature_contributions"]) > 0
    assert any(abs(fc["shap_value"]) > 0 for fc in waterfall["feature_contributions"])


@pytest.mark.asyncio
@pytest.mark.parametrize("model_family,expected_name", [
    ("random_forest", "Random Forest"),
    ("lightgbm", "LightGBM"),
    ("xgboost", "XGBoost"),
])
async def test_automl_regression_model_families_and_shap(sample_dataset_record, model_family, expected_name):
    """Test training regression models across all 3 families with real SHAP values."""
    res = await train_automl_task(
        ctx={},
        dataset_record=sample_dataset_record,
        target_column="income",
        task_type="regression",
        model_family=model_family,
    )

    assert res["model_name"] == expected_name
    assert res["model_family"] == model_family
    assert res["task_type"] == "regression"
    assert "r2_score" in res["diagnostics"]
    assert "rmse" in res["diagnostics"]
    assert "residuals" in res["diagnostics"]

    # Verify SHAP
    shap_data = res["shap"]
    summary_features = shap_data["summary"]
    assert len(summary_features) > 0
    assert any(f["mean_abs_shap"] > 0 for f in summary_features)

    waterfall = shap_data["waterfall"]
    assert len(waterfall["feature_contributions"]) > 0


@pytest.mark.asyncio
async def test_automl_leakage_detection(tmp_path):
    """Verify that real data leakage (target proxy feature) is detected and flagged."""
    # Create dataset with an obvious leaky column (identical to target)
    leaky_csv = (
        "feature_a,feature_b,target_leak,target\n"
        "10,100,0,0\n20,200,0,0\n30,300,1,1\n40,400,0,0\n"
        "50,500,1,1\n60,600,0,0\n70,700,1,1\n80,800,0,0\n"
        "90,900,1,1\n15,150,1,1\n25,250,0,0\n35,350,1,1\n"
    )
    file_path = str(tmp_path / "leaky_data.csv")
    with open(file_path, "w") as f:
        f.write(leaky_csv)

    record = {
        "id": "ds_leaky",
        "filename": "leaky_data.csv",
        "file_path": file_path,
        "format": "csv",
    }

    res = await train_automl_task(
        ctx={},
        dataset_record=record,
        target_column="target",
        task_type="classification",
        model_family="random_forest",
    )

    assert len(res["leakage_warnings"]) > 0
    leak_text = " ".join(res["leakage_warnings"])
    assert "target_leak" in leak_text or "Leakage" in leak_text or "Target" in leak_text


def test_automl_train_endpoint_dispatches_model_family():
    """Test that POST /automl/train correctly accepts model_family and dispatches to queue."""
    csv_data = (
        "col_a,col_b,target\n"
        "1,10,0\n2,20,1\n3,30,0\n4,40,1\n5,50,0\n"
        "6,60,1\n7,70,0\n8,80,1\n9,90,0\n10,100,1\n"
    )
    upload_res = client.post(
        "/api/preview",
        files={"file": ("d1_test.csv", io.BytesIO(csv_data.encode()), "text/csv")}
    )
    assert upload_res.status_code == 200
    dataset_id = upload_res.json()["content_hash"][:12]

    mock_pool = AsyncMock()
    mock_pool.enqueue_job = AsyncMock(return_value=_MockJob())

    for mf in ["random_forest", "lightgbm", "xgboost"]:
        with patch("strata_api.routers.automl.get_arq_pool", return_value=mock_pool):
            resp = client.post(
                "/api/automl/train",
                json={
                    "dataset_id": dataset_id,
                    "target_column": "target",
                    "task_type": "classification",
                    "model_family": mf,
                }
            )
            assert resp.status_code == 200, resp.text
            data = resp.json()
            assert data["status"] == "queued"
            assert data["model_family"] == mf
            assert mock_pool.enqueue_job.call_args[1]["model_family"] == mf
