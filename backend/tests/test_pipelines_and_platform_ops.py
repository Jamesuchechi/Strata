"""Unit tests for Track 3.4: Pipelines, Isolated Compute Sandboxes, Ecosystem Integrations, Security & Platform Ops.
Pillars 7, 9, 12, 13, 16, 17
"""

import pytest
from httpx import AsyncClient, ASGITransport
from strata_api.main import create_app
from strata_api.routers.datasets import seed_default_datasets_if_needed

app = create_app()


@pytest.fixture(autouse=True)
def setup_datasets():
    seed_default_datasets_if_needed()


@pytest.mark.asyncio
async def test_pipeline_creation_and_dry_run():
    """Test pipeline templates, creation, and dry-run execution mode (Pillars 7.2, 7.8, 7.10)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Templates
        tpl_resp = await ac.get("/api/pipelines/templates")
        assert tpl_resp.status_code == 200
        tpls = tpl_resp.json()["templates"]
        assert len(tpls) >= 2

        # Dry run on customer churn
        dry_req = {
            "dataset_id": "churn_demo",
            "steps": [
                {"step_id": "s1", "name": "Filter high spend", "type": "filter", "condition": "total_spend > 500"},
                {"step_id": "s2", "name": "Calculate intensity", "type": "expression", "expr": "total_spend / tenure_months", "output_col": "intensity"},
            ],
            "sample_rows_limit": 5,
        }
        dry_resp = await ac.post("/api/pipelines/dry-run", json=dry_req)
        assert dry_resp.status_code == 200
        dry_data = dry_resp.json()
        assert dry_data["status"] == "success"
        assert len(dry_data["dry_run"]["sample_preview"]) <= 5
        assert "intensity" in dry_data["dry_run"]["columns_list"]


@pytest.mark.asyncio
async def test_pipeline_sandbox_execution():
    """Test pipeline execution inside isolated compute sandbox with logs (Pillars 7.6, 13.3)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Run default churn pipeline
        run_resp = await ac.post("/api/pipelines/pipe_churn_etl/run")
        assert run_resp.status_code == 200
        run_data = run_resp.json()
        assert run_data["status"] == "success"
        run = run_data["run"]
        assert run["status"] == "success"
        assert run["duration_ms"] > 0
        assert len(run["logs"]) >= 5
        assert "spend_per_month" in run["columns"]

        # Check run history
        hist_resp = await ac.get("/api/pipelines/runs")
        assert hist_resp.status_code == 200
        assert hist_resp.json()["total"] >= 1


@pytest.mark.asyncio
async def test_dead_letter_queue_and_retry():
    """Test failure capture in Dead-Letter Queue (DLQ) and retry mechanics (Pillar 7.9)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Create pipeline with an invalid column condition to intentionally trigger failure
        bad_pipe_req = {
            "name": "Faulty Pipeline",
            "target_dataset_id": "churn_demo",
            "steps": [
                {"step_id": "fail_1", "name": "Nonexistent Column Filter", "type": "filter", "condition": "non_existent_col > 999"}
            ]
        }
        create_resp = await ac.post("/api/pipelines", json=bad_pipe_req)
        bad_id = create_resp.json()["pipeline"]["id"]

        # Run faulty pipeline
        fail_resp = await ac.post(f"/api/pipelines/{bad_id}/run")
        assert fail_resp.status_code in [400, 500]

        # Inspect DLQ
        dlq_resp = await ac.get("/api/pipelines/dlq")
        assert dlq_resp.status_code == 200
        dlq_items = dlq_resp.json()["dlq"]
        assert len(dlq_items) >= 1


@pytest.mark.asyncio
async def test_integrations_connectors_and_code():
    """Test ecosystem connectors and production boilerplate generators (Pillar 12)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Status
        status_resp = await ac.get("/api/integrations/status")
        assert status_resp.status_code == 200
        assert len(status_resp.json()["connectors"]) >= 6

        # Code templates
        code_resp = await ac.get("/api/integrations/code-templates?dataset_name=customer_churn.csv")
        assert code_resp.status_code == 200
        tpls = code_resp.json()["templates"]
        assert "airflow" in tpls
        assert "prefect" in tpls
        assert "dbt" in tpls
        assert "jupyter_vscode" in tpls
        assert "mlflow" in tpls

        # Webhook alert dispatch
        wh_resp = await ac.post(
            "/api/integrations/webhooks/test",
            json={"service": "slack", "message": "Test Alert"}
        )
        assert wh_resp.status_code == 200
        assert wh_resp.json()["status"] == "sent"

        # MLflow sync
        ml_resp = await ac.post(
            "/api/integrations/sync/mlflow",
            json={
                "model_name": "churn_classifier",
                "dataset_name": "customer_churn.csv",
                "version_hash": "a1b2c3d4",
                "metrics": {"auc": 0.93},
            }
        )
        assert ml_resp.status_code == 200
        assert ml_resp.json()["status"] == "synchronized"


@pytest.mark.asyncio
async def test_advanced_collaboration():
    """Test cell/row comments, review approvals, and asset transfer (Pillars 9.6, 9.7, 9.10)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Add cell comment
        comm_resp = await ac.post(
            "/api/workspaces/comments/churn_demo",
            json={
                "row_index": 2,
                "column_name": "monthly_charges",
                "comment": "Verify if promotional discount applied.",
                "author_name": "James Uchechi",
            }
        )
        assert comm_resp.status_code == 200
        comment_id = comm_resp.json()["comment"]["id"]

        # List comments
        list_resp = await ac.get("/api/workspaces/comments/churn_demo")
        assert list_resp.status_code == 200
        assert len(list_resp.json()["comments"]) >= 1

        # Resolve comment
        res_resp = await ac.post(f"/api/workspaces/comments/churn_demo/{comment_id}/resolve")
        assert res_resp.status_code == 200
        assert res_resp.json()["comment"]["resolved"] is True

        # 2. Review Request workflow
        rev_resp = await ac.post(
            "/api/workspaces/reviews",
            json={
                "dataset_name": "customer_churn.csv",
                "source_branch": "feature/discount-audit",
                "target_branch": "main",
                "title": "Audit Discount Columns",
            }
        )
        assert rev_resp.status_code == 200
        rev_id = rev_resp.json()["review"]["id"]

        # Approve review
        appr_resp = await ac.post(f"/api/workspaces/reviews/{rev_id}/approve")
        assert appr_resp.status_code == 200
        assert appr_resp.json()["review"]["status"] == "approved"

        # 3. Asset Transfer
        create_ws = await ac.post("/api/workspaces", json={"name": "Target Workspace", "description": "Testing transfer"})
        target_ws_id = create_ws.json()["id"]
        trans_resp = await ac.post(
            "/api/workspaces/transfer-asset",
            json={
                "dataset_id": "churn_demo",
                "from_workspace_id": "ws_primary",
                "to_workspace_id": target_ws_id,
            }
        )
        assert trans_resp.status_code == 200
        assert trans_resp.json()["status"] == "transferred"


@pytest.mark.asyncio
async def test_security_and_compliance():
    """Test encryption audit, cryptographic audit logs, PII masking, and GDPR workflows (Pillars 16.1, 16.3, 16.4, 16.5)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Encryption status
        enc_resp = await ac.get("/api/security/encryption-status")
        assert enc_resp.status_code == 200
        assert enc_resp.json()["status"] == "compliant"
        assert enc_resp.json()["encryption_at_rest"]["algorithm"] == "AES-256-GCM"

        # Cryptographic Audit Log
        audit_resp = await ac.get("/api/security/audit-logs")
        assert audit_resp.status_code == 200
        audit_data = audit_resp.json()
        assert audit_data["chain_integrity_verified"] is True
        assert audit_data["total_records"] >= 1

        # PII Masking on export
        mask_resp = await ac.post(
            "/api/security/mask-export",
            json={"dataset_id": "churn_demo", "mask_rules": ["email", "name"]}
        )
        assert mask_resp.status_code == 200
        mask_data = mask_resp.json()
        assert mask_data["status"] == "masked"
        sample_0 = mask_data["sample_preview"][0]
        if "email" in sample_0:
            assert "***@" in sample_0["email"]

        # GDPR right-to-be-forgotten customer purge
        gdpr_resp = await ac.post(
            "/api/security/gdpr-redact",
            json={
                "customer_identifier_column": "customer_id",
                "customer_identifier_value": "CUST-1000",
                "dataset_ids": ["churn_demo"],
            }
        )
        assert gdpr_resp.status_code == 200
        assert gdpr_resp.json()["status"] == "redacted"


@pytest.mark.asyncio
async def test_admin_and_platform_ops():
    """Test admin console, platform health metrics, rate limits, and worker queue observability (Pillars 17.1, 17.2, 17.3, 17.4)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Admin overview
        admin_resp = await ac.get("/api/security/admin/overview")
        assert admin_resp.status_code == 200
        assert admin_resp.json()["platform_status"] == "healthy"

        # Health metrics
        health_resp = await ac.get("/api/security/admin/health-metrics")
        assert health_resp.status_code == 200
        h_data = health_resp.json()
        assert "cpu_usage_pct" in h_data
        assert "memory_usage_pct" in h_data

        # Rate limits
        rate_resp = await ac.get("/api/security/admin/rate-limits")
        assert rate_resp.status_code == 200
        assert "tiers" in rate_resp.json()

        # Worker queue observability
        queue_resp = await ac.get("/api/security/admin/queues")
        assert queue_resp.status_code == 200
        q_data = queue_resp.json()
        assert q_data["active_workers"] >= 1
        assert "dead_letter_count" in q_data
