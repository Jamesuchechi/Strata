import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Query, Response

router = APIRouter(prefix="/lineage", tags=["Lineage & Model Registry"])

# Registered models database linking dataset version hashes to ML checkpoints / runs
_models_db: List[Dict[str, Any]] = []


class RegisterModelRequest(BaseModel):
    name: str = Field(..., description="Model name")
    framework: str = Field(..., description="Framework: LightGBM, Scikit-Learn, PyTorch, XGBoost")
    algorithm: Optional[str] = "Classifier"
    version: Optional[str] = "v1.0.0"
    dataset_name: str
    dataset_version_hash: str
    experiment_tracker: Optional[str] = "MLflow"
    run_id: Optional[str] = None
    metrics: Dict[str, float] = Field(default_factory=dict)
    hyperparameters: Dict[str, Any] = Field(default_factory=dict)
    artifact_uri: Optional[str] = None
    author: Optional[str] = "Owner"
    status: Optional[str] = "staging"


@router.get("/models")
async def list_registered_models(dataset_name: Optional[str] = None):
    """List all registered ML models linked to dataset versions and experiment tracker runs."""
    if dataset_name:
        return [m for m in _models_db if m.get("dataset_name") == dataset_name]
    return _models_db


@router.post("/models")
async def register_model(req: RegisterModelRequest):
    """Register a trained ML model checkpoint linked directly to an immutable dataset version hash."""
    model_id = f"mod_{uuid.uuid4().hex[:8]}"
    record = {
        "id": model_id,
        "name": req.name,
        "framework": req.framework,
        "algorithm": req.algorithm or "Classifier",
        "version": req.version or "v1.0.0",
        "dataset_name": req.dataset_name,
        "dataset_version_hash": req.dataset_version_hash,
        "experiment_tracker": req.experiment_tracker or "MLflow",
        "run_id": req.run_id or f"run-{uuid.uuid4().hex[:8]}",
        "metrics": req.metrics,
        "hyperparameters": req.hyperparameters,
        "artifact_uri": req.artifact_uri or f"s3://strata-models/checkpoints/{model_id}.pkl",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "author": req.author or "Owner",
        "status": req.status or "staging",
    }
    _models_db.insert(0, record)
    return {"message": "Model registered successfully in Strata Model Registry", "model": record}


@router.get("/graph")
async def get_full_lineage_graph():
    """Build and return complete end-to-end provenance graph across all active layers:
    Raw Source Files -> Ingested Datasets -> Version Snapshots -> Registered Models."""
    from strata_api.routers.datasets import _datasets_db
    from strata_api.versioning.registry import get_all_commits

    commits = get_all_commits()
    nodes = []
    edges = []

    # 1. Ingestion Sources & Datasets
    for d_id, d in _datasets_db.items():
        fname = d.get("filename", d_id)
        raw_id = f"raw_{d_id}"
        nodes.append({
            "id": raw_id,
            "label": f"Source: {fname}",
            "type": "raw_source",
            "category": "Source Ingestion",
            "badge": d.get("format", "csv").upper(),
            "details": f"{d.get('total_rows', 0):,} rows • {d.get('total_columns', 0)} cols",
            "color": "blue",
            "created_at": d.get("created_at"),
        })

        # Base Dataset Node
        ds_node_id = f"dataset_{d_id}"
        nodes.append({
            "id": ds_node_id,
            "label": d.get("name", fname),
            "type": "dataset",
            "category": "Catalog Table",
            "badge": f"{d.get('quality_score', 95)}% Clean",
            "details": f"Quality: {d.get('quality_score', 95)}/100",
            "color": "emerald",
            "created_at": d.get("created_at"),
        })
        edges.append({
            "id": f"e_raw_{d_id}",
            "source": raw_id,
            "target": ds_node_id,
            "label": "inferred_and_cataloged",
        })

    # 2. Dataset Version Commits
    for c in commits:
        c_id = f"commit_{c['id']}"
        nodes.append({
            "id": c_id,
            "label": f"{c.get('version', 'v1.0')}: {c.get('message', '')[:28]}",
            "type": "version",
            "category": "Version Snapshot",
            "badge": c.get("hash", ""),
            "details": f"{c.get('author')} • {c.get('deltaRows', '+0 rows')}",
            "color": "indigo",
            "commit_hash": c.get("hash"),
            "full_hash": c.get("full_hash"),
            "created_at": c.get("date"),
        })

        if c.get("parent_hash"):
            edges.append({
                "id": f"e_parent_{c['id']}",
                "source": f"commit_{c['parent_hash']}",
                "target": c_id,
                "label": "transformed",
            })
        else:
            # Link to dataset catalog node
            matched_d = next((d_id for d_id, d in _datasets_db.items() if d.get("filename") == c.get("dataset_name")), None)
            if matched_d:
                edges.append({
                    "id": f"e_init_{c['id']}",
                    "source": f"dataset_{matched_d}",
                    "target": c_id,
                    "label": "initial_commit",
                })

    # 3. Registered ML Models (if any exist)
    for m in _models_db:
        m_id = f"model_{m['id']}"
        metric_summary = ", ".join([f"{k.upper()}: {v}" for k, v in list(m.get("metrics", {}).items())[:2]])
        nodes.append({
            "id": m_id,
            "label": f"{m['name']} ({m['framework']})",
            "type": "model",
            "category": "Registered Model",
            "badge": m.get("status", "staging").upper(),
            "details": metric_summary or "Active Checkpoint",
            "color": "purple",
            "run_id": m.get("run_id"),
            "artifact_uri": m.get("artifact_uri"),
        })

        # Link model to its commit hash if matching
        matched_commit = next((c for c in commits if c.get("hash") == m.get("dataset_version_hash") or c.get("full_hash") == m.get("dataset_version_hash")), None)
        if matched_commit:
            edges.append({
                "id": f"e_mod_{m['id']}",
                "source": f"commit_{matched_commit['id']}",
                "target": m_id,
                "label": f"trained_on_{m.get('experiment_tracker')}",
            })

    return {
        "nodes": nodes,
        "edges": edges,
        "total_nodes": len(nodes),
        "total_edges": len(edges),
    }


@router.get("/trace/backward/{asset_id}")
async def trace_backward_lineage(asset_id: str):
    """Trace backward from any model or report up to its initial raw data sources."""
    g = await get_full_lineage_graph()
    nodes_by_id = {n["id"]: n for n in g["nodes"]}

    visited_nodes = set()
    upstream_nodes = []
    upstream_edges = []

    def _traverse(curr_id: str):
        if curr_id in visited_nodes or curr_id not in nodes_by_id:
            return
        visited_nodes.add(curr_id)
        upstream_nodes.append(nodes_by_id[curr_id])
        for e in g["edges"]:
            if e["target"] == curr_id:
                upstream_edges.append(e)
                _traverse(e["source"])

    _traverse(asset_id)
    return {
        "target_asset_id": asset_id,
        "upstream_depth": len(upstream_edges),
        "lineage_path": upstream_nodes,
        "edges": upstream_edges,
    }


@router.get("/trace/forward/{asset_id}")
async def trace_forward_impact(asset_id: str):
    """Perform forward impact analysis: see all downstream features, models, and reports that would be affected."""
    g = await get_full_lineage_graph()
    nodes_by_id = {n["id"]: n for n in g["nodes"]}

    visited_nodes = set()
    downstream_nodes = []
    downstream_edges = []

    def _traverse(curr_id: str):
        if curr_id in visited_nodes or curr_id not in nodes_by_id:
            return
        visited_nodes.add(curr_id)
        downstream_nodes.append(nodes_by_id[curr_id])
        for e in g["edges"]:
            if e["source"] == curr_id:
                downstream_edges.append(e)
                _traverse(e["target"])

    _traverse(asset_id)
    impacted_models = [n for n in downstream_nodes if n["type"] == "model"]

    return {
        "source_asset_id": asset_id,
        "total_downstream_impacted": len(downstream_nodes) - 1,
        "has_active_models": len(impacted_models) > 0,
        "impacted_models": [m["label"] for m in impacted_models],
        "downstream_assets": downstream_nodes,
        "edges": downstream_edges,
    }


@router.get("/protection/check/{version_hash}")
async def check_deletion_protection(version_hash: str):
    """Lineage-aware deletion protection check. Blocks deletion if active downstream assets or production models depend on this version."""
    active_models = [
        m for m in _models_db
        if m.get("dataset_version_hash") == version_hash or m.get("dataset_version_hash") == version_hash[:7]
    ]

    is_blocked = len(active_models) > 0
    reasons = []
    if is_blocked:
        for m in active_models:
            reasons.append(f"Model '{m['name']}' ({m['version']}) status={m['status']} depends on this dataset snapshot")

    return {
        "version_hash": version_hash,
        "can_delete": not is_blocked,
        "deletion_blocked": is_blocked,
        "blocking_models_count": len(active_models),
        "reasons": reasons,
        "blocking_models": active_models,
    }


@router.get("/export")
async def export_openlineage(
    format: str = Query("openlineage", description="Export format: openlineage, graphviz, or json")
):
    """Export complete dataset and model lineage graph in standardized OpenLineage compliant JSON format or GraphViz DOT."""
    g = await get_full_lineage_graph()

    if format == "graphviz":
        dot_lines = ["digraph StrataLineage {", "  rankdir=LR;", "  node [shape=box, style=rounded, fontname=\"Helvetica\"];"]
        for n in g["nodes"]:
            dot_lines.append(f"  \"{n['id']}\" [label=\"{n['label']}\\n({n['category']})\"];")
        for e in g["edges"]:
            dot_lines.append(f"  \"{e['source']}\" -> \"{e['target']}\" [label=\"{e.get('label', '')}\"];")
        dot_lines.append("}")
        return Response(content="\n".join(dot_lines), media_type="text/vnd.graphviz")

    # OpenLineage standard format specification
    open_lineage = {
        "eventType": "COMPLETE",
        "eventTime": datetime.now(timezone.utc).isoformat(),
        "producer": "https://github.com/jamesuchechi/strata",
        "schemaURL": "https://openlineage.io/spec/1-0-5/OpenLineage.json#/definitions/RunEvent",
        "job": {
            "namespace": "strata.workspace.acme",
            "name": "strata_provenance_pipeline",
        },
        "inputs": [
            {
                "namespace": "strata.storage",
                "name": n["label"],
                "facets": {
                    "dataSource": {"name": n.get("category"), "uri": f"strata://assets/{n['id']}"},
                    "version": {"datasetVersion": n.get("badge")},
                },
            }
            for n in g["nodes"] if n["type"] in ("raw_source", "dataset", "version")
        ],
        "outputs": [
            {
                "namespace": "strata.mlflow",
                "name": m["name"],
                "facets": {
                    "modelMetrics": m.get("metrics", {}),
                    "algorithm": {"name": m.get("algorithm")},
                    "run": {"runId": m.get("run_id")},
                },
            }
            for m in _models_db
        ],
        "strata_graph_metadata": {
            "total_nodes": g["total_nodes"],
            "total_edges": g["total_edges"],
            "nodes": g["nodes"],
            "edges": g["edges"],
        },
    }

    return Response(
        content=json.dumps(open_lineage, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=strata_openlineage_spec.json"}
    )
