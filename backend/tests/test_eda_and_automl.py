"""Unit tests for Deep EDA dossier and AutoML baseline training."""

import io
import pytest
from fastapi.testclient import TestClient
from strata_api.main import create_app

client = TestClient(create_app())


def test_deep_eda_and_automl_flow():
    # 1. Upload a dataset with numeric and categorical features
    csv_data = (
        "age,income,credit_score,churned\n"
        "25,45000.0,650,No\n"
        "42,85000.0,720,No\n"
        "31,52000.0,590,Yes\n"
        "55,120000.0,810,No\n"
        "22,28000.0,510,Yes\n"
        "38,71000.0,680,No\n"
        "49,95000.0,740,No\n"
        "28,39000.0,560,Yes\n"
        "61,110000.0,790,No\n"
        "34,60000.0,620,Yes\n"
        "45,88000.0,710,No\n"
        "29,42000.0,580,Yes\n"
    )
    upload_res = client.post(
        "/api/preview",
        files={"file": ("ml_sample.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
    )
    assert upload_res.status_code == 200
    dataset_info = upload_res.json()
    dataset_id = dataset_info["content_hash"][:12]

    # 2. Test Deep EDA dossier
    eda_res = client.get(f"/api/eda/{dataset_id}")
    assert eda_res.status_code == 200
    eda_data = eda_res.json()
    assert "income" in eda_data["numeric_columns"]
    assert "correlation_matrix" in eda_data
    assert "skewness_metrics" in eda_data

    # 3. Test Hypothesis Testing (t-test)
    hyp_res = client.post(
        f"/api/eda/{dataset_id}/hypothesis-test",
        json={
            "test_type": "ttest",
            "target_col": "income",
            "group_col": "churned",
        }
    )
    assert hyp_res.status_code == 200
    hyp_data = hyp_res.json()
    assert "statistic" in hyp_data
    assert "p_value" in hyp_data
    assert "takeaway" in hyp_data

    # 4. Test AutoML Training (Classification)
    train_res = client.post(
        "/api/automl/train",
        json={
            "dataset_id": dataset_id,
            "target_column": "churned",
            "task_type": "classification",
        }
    )
    assert train_res.status_code == 200
    model_data = train_res.json()
    assert model_data["task_type"] == "classification"
    assert "accuracy" in model_data["diagnostics"]
    assert "feature_importances" in model_data
    assert len(model_data["feature_importances"]) > 0

    # 5. Test Format Conversion (Convert to Parquet)
    convert_res = client.post(f"/api/datasets/{dataset_id}/convert?target_format=parquet")
    assert convert_res.status_code == 200
    assert convert_res.headers["content-type"] == "application/octet-stream"
    assert len(convert_res.content) > 0
