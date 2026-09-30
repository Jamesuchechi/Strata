"""Unit and integration tests for External Dataset Ingestion & Database Connectors."""

import pytest
from fastapi.testclient import TestClient
from strata_api.main import app

client = TestClient(app)


def get_authenticated_header():
    """Register/login a test user and obtain auth headers."""
    email = "connector_test_user@strata.ai"
    password = "StrataSecurePassword123!"
    
    # Try register or login
    reg_resp = client.post("/api/auth/register", json={"email": email, "password": password, "full_name": "Connector Tester"})
    if reg_resp.status_code == 200:
        token = reg_resp.json()["access_token"]
    else:
        login_resp = client.post("/api/auth/login", json={"email": email, "password": password})
        token = login_resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_import_sample_datasets():
    headers = get_authenticated_header()

    # 1. Test Iris Flower Benchmark
    resp = client.post("/api/datasets/import-sample", json={"sample_id": "iris"}, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["format"] == "csv"
    assert data["total_rows"] == 150
    assert "sepal_length" in [f["name"] for f in data["schema_fields"]]

    # 2. Test NYC Taxi
    resp2 = client.post("/api/datasets/import-sample", json={"sample_id": "nyc_taxi"}, headers=headers)
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["total_rows"] == 1000
    assert "fare_amount" in [f["name"] for f in data2["schema_fields"]]

    # 3. Test California Housing
    resp3 = client.post("/api/datasets/import-sample", json={"sample_id": "california_housing"}, headers=headers)
    assert resp3.status_code == 200
    data3 = resp3.json()
    assert data3["total_rows"] == 800
    assert "med_inc" in [f["name"] for f in data3["schema_fields"]]


def test_import_database_query():
    headers = get_authenticated_header()

    req_payload = {
        "connection_uri": "postgres://analyst:secret@localhost:5432/analytics",
        "query": "SELECT record_id, account_id, amount, status, country_code FROM transactions LIMIT 500",
        "name": "enterprise_transactions",
        "limit": 500,
    }
    resp = client.post("/api/datasets/import-database", json=req_payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["format"] == "parquet"
    assert data["total_rows"] == 500
    assert "account_id" in [f["name"] for f in data["schema_fields"]]


def test_import_database_query_security_blocks_mutation():
    headers = get_authenticated_header()

    req_payload = {
        "connection_uri": "postgres://analyst:secret@localhost:5432/analytics",
        "query": "DROP TABLE users; SELECT * FROM transactions;",
        "name": "malicious_extract",
    }
    resp = client.post("/api/datasets/import-database", json=req_payload, headers=headers)
    assert resp.status_code == 400
    assert "Security Check Failed" in resp.json()["detail"]


def test_import_url_ssrf_protection():
    headers = get_authenticated_header()

    # Block access to AWS/GCP instance metadata IP
    req_payload = {
        "url": "http://169.254.169.254/latest/meta-data/",
        "name": "cloud_metadata",
    }
    resp = client.post("/api/datasets/import-url", json=req_payload, headers=headers)
    assert resp.status_code == 400
    assert "Forbidden" in resp.json()["detail"] or "private" in resp.json()["detail"]


def test_database_connections_crud_and_test():
    headers = get_authenticated_header()

    # 1. List connections
    list_resp = client.get("/api/integrations/connections", headers=headers)
    assert list_resp.status_code == 200
    assert "connections" in list_resp.json()
    initial_count = len(list_resp.json()["connections"])

    # 2. Save new connection
    new_conn = {
        "name": "Analytics Warehouse Staging",
        "db_type": "snowflake",
        "host": "staging-dw.snowflakecomputing.com",
        "database": "STAGING_DB",
        "username": "strata_etl_bot",
    }
    save_resp = client.post("/api/integrations/connections", json=new_conn, headers=headers)
    assert save_resp.status_code == 200
    conn_id = save_resp.json()["connection"]["id"]
    assert conn_id.startswith("conn_snowflake_")

    # 3. Test connection latency
    test_payload = {
        "db_type": "snowflake",
        "host": "staging-dw.snowflakecomputing.com",
        "database": "STAGING_DB",
    }
    test_resp = client.post("/api/integrations/test-db", json=test_payload, headers=headers)
    assert test_resp.status_code == 200
    assert test_resp.json()["status"] == "connected"
    assert test_resp.json()["latency_ms"] > 0

    # 4. Delete connection
    del_resp = client.delete(f"/api/integrations/connections/{conn_id}", headers=headers)
    assert del_resp.status_code == 200
