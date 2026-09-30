"""Acceptance tests for Phase D Task D5: Real Ecosystem Integrations & Webhooks."""

import json
from unittest.mock import patch
import pytest
import httpx
from httpx import ASGITransport, AsyncClient

_RealAsyncClient = httpx.AsyncClient

from strata_api.main import create_app
from strata_api.routers.datasets import _datasets_db
from strata_api.core.persistence import SyncSessionLocal
from strata_api.models.integration import WebhookConfigModel, IntegrationEventModel
from tests.conftest import AUTH_HEADERS_A, TEST_USER_A_ID

app = create_app()


@pytest.fixture(autouse=True)
def setup_test_dataset():
    """Ensure a dataset exists for integration tests."""
    ds_id = "test_ds_integrations"
    _datasets_db[ds_id] = {
        "id": ds_id,
        "name": "Integration Test Dataset",
        "filename": "customer_churn.csv",
        "file_path": "./data/test_storage/customer_churn.csv",
        "format": "csv",
        "owner_id": TEST_USER_A_ID,
        "content_hash": "hash_int_123",
        "total_rows": 50,
        "total_columns": 5,
        "schema_fields": [{"name": "id", "type": "int64"}, {"name": "churn", "type": "int64"}],
    }
    yield
    _datasets_db.pop(ds_id, None)


@pytest.mark.asyncio
async def test_d5_webhook_live_delivery_success():
    """Acceptance test: real webhook POST delivers payload, records 200 OK in database and returns success."""
    transport = ASGITransport(app=app)

    async def mock_handler(request: httpx.Request):
        assert "slack.com" in str(request.url)
        body = json.loads(request.content)
        assert "pipeline_completed" in body.get("text", "").lower() or "pipeline_completed" in str(body.get("blocks", [])).lower()
        return httpx.Response(200, text="ok")

    mock_transport = httpx.MockTransport(mock_handler)

    with patch("strata_api.routers.integrations.httpx.AsyncClient", side_effect=lambda *a, **kw: _RealAsyncClient(transport=mock_transport, **{k: v for k, v in kw.items() if k != "transport"})):
        async with AsyncClient(transport=transport, base_url="http://test", headers=AUTH_HEADERS_A) as ac:
            resp = await ac.post(
                "/api/integrations/webhooks/test",
                json={
                    "service": "slack",
                    "webhook_url": "https://hooks.slack.com/services/TEST/B000/XXXX",
                    "event_type": "pipeline_completed",
                    "message": "Pipeline run #42 completed successfully.",
                },
            )
            assert resp.status_code == 200, resp.text
            data = resp.json()
            assert data["status"] == "sent"
            assert data["delivery_status"] == "delivered"
            assert data["status_code"] == 200
            assert "Successfully delivered test alert" in data["message"]
            evt = data["event"]
            assert evt["status"] == "delivered"

            # Confirm event record is persisted in the database
            with SyncSessionLocal() as session:
                persisted = session.get(IntegrationEventModel, evt["id"])
                assert persisted is not None
                assert persisted.status == "delivered"
                assert persisted.status_code == 200


@pytest.mark.asyncio
async def test_d5_webhook_bad_url_and_failure_handling():
    """Acceptance test: a bad webhook URL or unreachable target returns real failure (502/400), not a fake success."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=AUTH_HEADERS_A) as ac:
        # Invalid host that cannot be resolved
        resp = await ac.post(
            "/api/integrations/webhooks/test",
            json={
                "service": "slack",
                "webhook_url": "http://invalid-non-existent-webhook-host-99999.xyz/webhook",
                "event_type": "pipeline_failed",
                "message": "Critical schema drift detected.",
            },
        )
        assert resp.status_code in (502, 400), f"Expected 502/400 on failure, got {resp.status_code}: {resp.text}"
        err_msg = resp.json()["detail"]
        assert "failed" in err_msg.lower() or "error" in err_msg.lower()


@pytest.mark.asyncio
async def test_d5_webhook_crud_management():
    """Test webhook configuration registration, listing, and deletion."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=AUTH_HEADERS_A) as ac:
        # Create webhook
        create_resp = await ac.post(
            "/api/integrations/webhooks",
            json={
                "service": "discord",
                "name": "Production MLOps Alerts",
                "url": "https://discord.com/api/webhooks/12345/abcdef",
                "events": ["model_promoted", "quality_regression"],
                "is_active": True,
            },
        )
        assert create_resp.status_code == 200
        wh = create_resp.json()["webhook"]
        wh_id = wh["id"]

        # List webhooks
        list_resp = await ac.get("/api/integrations/webhooks")
        assert list_resp.status_code == 200
        wh_ids = [w["id"] for w in list_resp.json()["webhooks"]]
        assert wh_id in wh_ids

        # Delete webhook
        del_resp = await ac.delete(f"/api/integrations/webhooks/{wh_id}")
        assert del_resp.status_code == 200
        assert del_resp.json()["status"] == "deleted"


@pytest.mark.asyncio
async def test_d5_mlflow_live_sync_success():
    """Acceptance test: MLflow sync communicates with tracking server to register run, parameters, and metrics."""
    transport = ASGITransport(app=app)

    async def mock_mlflow_handler(request: httpx.Request):
        url = str(request.url)
        if "experiments/get-by-name" in url:
            return httpx.Response(200, json={"experiment": {"experiment_id": "exp_42", "name": "Strata_Production_Models"}})
        elif "runs/create" in url:
            return httpx.Response(200, json={"run": {"info": {"run_id": "run_test_999"}}})
        elif "runs/log-metric" in url or "runs/log-parameter" in url or "runs/update" in url:
            return httpx.Response(200, json={})
        return httpx.Response(404, text="Not Found")

    mock_transport = httpx.MockTransport(mock_mlflow_handler)

    with patch("strata_api.routers.integrations.httpx.AsyncClient", side_effect=lambda *a, **kw: _RealAsyncClient(transport=mock_transport, **{k: v for k, v in kw.items() if k != "transport"})):
        async with AsyncClient(transport=transport, base_url="http://test", headers=AUTH_HEADERS_A) as ac:
            resp = await ac.post(
                "/api/integrations/sync/mlflow",
                json={
                    "mlflow_tracking_uri": "http://mlflow.internal:5000",
                    "experiment_name": "Strata_Production_Models",
                    "model_name": "churn_xgboost_classifier",
                    "dataset_name": "customer_churn.csv",
                    "version_hash": "v1_abcdef12",
                    "metrics": {"roc_auc": 0.942, "accuracy": 0.891},
                },
            )
            assert resp.status_code == 200, resp.text
            data = resp.json()
            assert data["status"] == "synchronized"
            assert data["run_id"] == "run_test_999"
            assert data["experiment_id"] == "exp_42"
            assert data["dataset_lineage"]["metrics"]["roc_auc"] == 0.942


@pytest.mark.asyncio
async def test_d5_mlflow_unreachable_server_failure():
    """Acceptance test: unreachable MLflow tracking server returns real 502 error, never fake success."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=AUTH_HEADERS_A) as ac:
        resp = await ac.post(
            "/api/integrations/sync/mlflow",
            json={
                "mlflow_tracking_uri": "http://127.0.0.1:59999",  # Closed / unused port
                "experiment_name": "Strata_Production_Models",
                "model_name": "churn_model",
                "dataset_name": "customer_churn.csv",
                "version_hash": "v1_abcdef12",
                "metrics": {"roc_auc": 0.91},
            },
        )
        assert resp.status_code == 502, f"Expected 502 on unreachable server, got {resp.status_code}: {resp.text}"
        detail = resp.json()["detail"]
        assert "failed to connect" in detail.lower() or "mlflow" in detail.lower()


@pytest.mark.asyncio
async def test_d5_integrations_live_status():
    """Acceptance test: /integrations/status reports connector connectivity and configured webhooks."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=AUTH_HEADERS_A) as ac:
        resp = await ac.get("/api/integrations/status")
        assert resp.status_code == 200
        data = resp.json()
        assert "connectors" in data
        assert "webhooks" in data
        assert "recent_events" in data

        connector_ids = [c["id"] for c in data["connectors"]]
        assert "jupyter" in connector_ids
        assert "airflow" in connector_ids
        assert "mlflow" in connector_ids
        assert "slack" in connector_ids

        # Ensure no fake wandb claim is in connectors
        assert "wandb" not in connector_ids
