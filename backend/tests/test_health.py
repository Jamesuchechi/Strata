"""Tests for Strata API health and core startup."""

from fastapi.testclient import TestClient
from strata_api.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "Strata"


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert "Strata API" in response.json()["message"]
