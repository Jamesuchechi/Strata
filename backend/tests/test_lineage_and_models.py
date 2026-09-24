"""Unit tests for Full Lineage Ecosystem, Model Registry, OpenLineage Export, and Deletion Protection."""

import pytest
from fastapi.testclient import TestClient
from strata_api.main import create_app
from tests.conftest import AUTH_HEADERS_A

client = TestClient(create_app(), headers=AUTH_HEADERS_A)


def test_lineage_graph_and_traversal():
    # 1. Fetch full provenance graph
    res = client.get("/api/lineage/graph")
    assert res.status_code == 200
    graph = res.json()
    assert "nodes" in graph
    assert "edges" in graph
    assert graph["total_nodes"] >= 4
    assert graph["total_edges"] >= 2

    # Check node categories
    categories = {n["category"] for n in graph["nodes"]}
    assert "Registered Model" in categories or "Dashboard Report" in categories

    # 2. Backward provenance trace
    model_node = next((n for n in graph["nodes"] if n["type"] == "model"), None)
    assert model_node is not None

    back_res = client.get(f"/api/lineage/trace/backward/{model_node['id']}")
    assert back_res.status_code == 200
    back_data = back_res.json()
    assert "lineage_path" in back_data
    assert len(back_data["lineage_path"]) >= 1

    # 3. Forward impact analysis
    source_node = graph["nodes"][0]
    fwd_res = client.get(f"/api/lineage/trace/forward/{source_node['id']}")
    assert fwd_res.status_code == 200
    fwd_data = fwd_res.json()
    assert "total_downstream_impacted" in fwd_data
    assert "downstream_assets" in fwd_data


def test_model_registry_and_linking():
    # 1. List existing registered models
    models_res = client.get("/api/lineage/models")
    assert models_res.status_code == 200
    models = models_res.json()
    assert len(models) >= 1

    # 2. Register a new model tied to a dataset version hash
    new_model_payload = {
        "name": "Customer Lifetime Value Regressor",
        "framework": "XGBoost",
        "algorithm": "XGBRegressor",
        "version": "v1.0.0",
        "dataset_name": "customer_churn.csv",
        "dataset_version_hash": "0ff58aa",
        "experiment_tracker": "MLflow",
        "run_id": "mlflow-run-ltv-992",
        "metrics": {"rmse": 142.5, "r2_score": 0.912},
        "hyperparameters": {"n_estimators": 100, "max_depth": 6},
        "author": "James Uchechi",
        "status": "production",
    }
    reg_res = client.post("/api/lineage/models", json=new_model_payload)
    assert reg_res.status_code == 200
    reg_data = reg_res.json()
    assert "model" in reg_data
    assert reg_data["model"]["name"] == "Customer Lifetime Value Regressor"
    assert reg_data["model"]["dataset_version_hash"] == "0ff58aa"


def test_deletion_protection_guard():
    # Model mod_lgbm_churn_v1 depends on 0ff58aa
    check_blocked = client.get("/api/lineage/protection/check/0ff58aa")
    assert check_blocked.status_code == 200
    data_blocked = check_blocked.json()
    assert data_blocked["deletion_blocked"] is True
    assert data_blocked["can_delete"] is False
    assert len(data_blocked["reasons"]) >= 1

    # Non-existent or unlinked hash should not be blocked
    check_clean = client.get("/api/lineage/protection/check/unlinked_hash_999")
    assert check_clean.status_code == 200
    data_clean = check_clean.json()
    assert data_clean["deletion_blocked"] is False
    assert data_clean["can_delete"] is True


def test_openlineage_and_graphviz_export():
    # 1. OpenLineage standard export
    ol_res = client.get("/api/lineage/export?format=openlineage")
    assert ol_res.status_code == 200
    assert ol_res.headers["content-type"].startswith("application/json")
    ol_json = ol_res.json()
    assert ol_json["eventType"] == "COMPLETE"
    assert "inputs" in ol_json
    assert "outputs" in ol_json

    # 2. GraphViz DOT export
    dot_res = client.get("/api/lineage/export?format=graphviz")
    assert dot_res.status_code == 200
    assert b"digraph StrataLineage" in dot_res.content
