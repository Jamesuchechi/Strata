"""Tests for transformation engine and shareable preview links."""

import io
import pytest
from fastapi.testclient import TestClient
from strata_api.main import create_app

client = TestClient(create_app())


def test_transformation_and_share_flow():
    # 1. Upload a CSV with nulls and duplicates
    csv_content = (
        "id,category,amount,note\n"
        "1,Sales,100.5,  clean  \n"
        "2,Marketing,,  draft  \n"
        "3,Sales,150.0,final\n"
        "3,Sales,150.0,final\n"  # duplicate
        "4,Engineering,,pending\n"
    )
    upload_res = client.post(
        "/api/preview",
        files={"file": ("test_transform.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    )
    assert upload_res.status_code == 200
    dataset_info = upload_res.json()
    dataset_id = dataset_info["content_hash"][:12]

    # 2. Execute transform: drop duplicates and fill nulls in 'amount' with mean
    transform_payload = {
        "operations": [
            {"op": "drop_duplicates"},
            {"op": "fill_null", "column": "amount", "strategy": "mean"},
            {"op": "trim_whitespace", "column": "note"},
        ],
        "commit_message": "Cleaned duplicates and imputed amount nulls"
    }

    res = client.post(f"/api/datasets/{dataset_id}/transform", json=transform_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "cleaned_dataset.parquet" in data["generated_python_code"]
    assert data["preview"]["total_rows"] == 4  # 5 rows minus 1 duplicate = 4 rows
    assert data["row_delta"] == -1

    # 3. Create share link
    share_res = client.post(f"/api/datasets/{dataset_id}/share")
    assert share_res.status_code == 200
    share_data = share_res.json()
    token = share_data["share_token"]
    assert token is not None

    # 4. Fetch shared preview using token
    shared_get = client.get(f"/api/shared/{token}")
    assert shared_get.status_code == 200
    shared_preview = shared_get.json()
    assert shared_preview["total_rows"] == 4
    assert shared_preview["filename"] == "test_transform.csv"
