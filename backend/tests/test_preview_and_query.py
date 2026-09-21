"""Integration tests for Datasets, Universal Previewer, and DuckDB SQL query execution."""

import pytest
from httpx import AsyncClient, ASGITransport
from strata_api.main import app


@pytest.mark.asyncio
async def test_list_datasets_seeds_defaults():
    """Test that listing datasets auto-seeds default datasets."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/datasets")
        assert response.status_code == 200
        datasets = response.json()
        assert len(datasets) >= 3
        filenames = [d["filename"] for d in datasets]
        assert "customer_churn.csv" in filenames
        assert "financial_projections.xlsx" in filenames
        assert "genomic_variants.parquet" in filenames


@pytest.mark.asyncio
async def test_get_dataset_detail_and_preview():
    """Test retrieving preview data and column stats for a seeded dataset."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/datasets/churn_demo")
        assert response.status_code == 200
        data = response.json()
        assert data["filename"] == "customer_churn.csv"
        assert data["format"] == "csv"
        assert len(data["preview_rows"]) > 0
        assert len(data["schema_fields"]) > 0
        assert data["view_name"] == "view_churn_demo"
        assert data["column_stats"] is not None


@pytest.mark.asyncio
async def test_upload_and_query_csv():
    """Test uploading a new CSV file and running DuckDB SQL over it."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        csv_content = b"user_id,username,credits,active\n1,ada,150.5,true\n2,charles,80.0,false\n3,grace,220.0,true\n"
        files = {"file": ("engineers.csv", csv_content, "text/csv")}

        # Upload
        preview_res = await client.post("/api/preview", files=files)
        assert preview_res.status_code == 200
        preview = preview_res.json()
        assert preview["filename"] == "engineers.csv"
        assert preview["total_rows"] == 3
        assert len(preview["schema_fields"]) == 4
        assert preview["view_name"] is not None

        view_name = preview["view_name"]

        # Run DuckDB SQL
        query_payload = {
            "view_name": view_name,
            "sql": f"SELECT username, credits FROM {view_name} WHERE active = true ORDER BY credits DESC;",
        }
        query_res = await client.post("/api/query", json=query_payload)
        assert query_res.status_code == 200
        query_data = query_res.json()
        assert query_data["success"] is True
        assert query_data["row_count"] == 2
        assert query_data["data"][0]["username"] == "grace"
        assert query_data["data"][0]["credits"] == 220.0
