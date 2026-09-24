"""Integration tests for Datasets, Universal Previewer, and DuckDB SQL query execution."""

import pytest
from httpx import AsyncClient, ASGITransport
from strata_api.main import app
from tests.conftest import AUTH_HEADERS_A


@pytest.mark.asyncio
async def test_upload_preview_and_deduplication():
    """Test uploading a dataset, verifying preview, and detecting duplicate uploads."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=AUTH_HEADERS_A) as client:
        csv_content = b"id,name,val\n1,Alpha,10\n2,Beta,20\n"
        files = {"file": ("test_dedup.csv", csv_content, "text/csv")}

        # Initial upload
        res1 = await client.post("/api/preview", files=files)
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["filename"] == "test_dedup.csv"
        assert data1["total_rows"] == 2
        assert data1.get("is_duplicate") is False

        # Duplicate upload of same content
        files_duplicate = {"file": ("test_dedup_copy.csv", csv_content, "text/csv")}
        res2 = await client.post("/api/preview", files=files_duplicate)
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2.get("is_duplicate") is True
        assert data2.get("existing_dataset_id") is not None



@pytest.mark.asyncio
async def test_upload_and_query_csv():
    """Test uploading a new CSV file and running DuckDB SQL over it."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=AUTH_HEADERS_A) as client:
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
