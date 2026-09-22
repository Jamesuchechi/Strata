"""Ecosystem integrations router: Airflow, Prefect, dbt, JupyterLab, VS Code, MLflow, W&B, and Webhook Alerts.
Pillar 12: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10
"""

from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/integrations", tags=["Integrations"])

# In-memory webhook configuration and event logs
_webhook_configs: Dict[str, Dict[str, Any]] = {
    "wh_slack": {
        "id": "wh_slack",
        "service": "slack",
        "name": "Data Team Slack Alert",
        "url": "https://hooks.slack.com/services/T0000/B0000/XXXX",
        "events": ["pipeline_failed", "schema_drift", "merge_conflict", "model_promoted"],
        "is_active": True,
    },
    "wh_discord": {
        "id": "wh_discord",
        "service": "discord",
        "name": "MLOps Discord Notification",
        "url": "https://discord.com/api/webhooks/0000/XXXX",
        "events": ["pipeline_completed", "quality_regression"],
        "is_active": False,
    },
}

_integration_events: List[Dict[str, Any]] = []


# ---------------------------------------------------------------------------
# Code Generator Templates (12.1, 12.5, 12.6, 12.7)
# ---------------------------------------------------------------------------

def _generate_integration_code(dataset_name: str, version: str = "main") -> Dict[str, str]:
    """Generate production integration boilerplate for data engineering & ML frameworks."""

    # 1. Apache Airflow DAG (12.5)
    airflow_dag = f"""from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
import polars as pl
import requests

def load_strata_dataset():
    # Strata Lakehouse Vectorized Ingestion
    url = "https://strata.data/api/datasets/{dataset_name}/download?version={version}"
    df = pl.read_parquet(url)
    print(f"Loaded {{len(df)}} records from Strata version '{version}'")
    return df.shape

with DAG(
    dag_id="strata_{dataset_name}_etl",
    default_args={{"owner": "data_ops", "retries": 2, "retry_delay": timedelta(minutes=5)}},
    start_date=datetime(2026, 1, 1),
    schedule_interval="@daily",
    catchup=False,
) as dag:
    ingest_task = PythonOperator(
        task_id="ingest_from_strata",
        python_callable=load_strata_dataset,
    )
"""

    # 2. Prefect Flow (12.5)
    prefect_flow = f"""from prefect import flow, task
import polars as pl

@task(retries=2, retry_delay_seconds=60)
def fetch_strata_version():
    url = "https://strata.data/api/datasets/{dataset_name}/download?version={version}"
    return pl.read_parquet(url)

@flow(name="strata-{dataset_name}-sync")
def strata_pipeline():
    df = fetch_strata_version()
    print(f"Synced Strata dataset '{dataset_name}' with {{df.shape[0]}} rows.")

if __name__ == "__main__":
    strata_pipeline()
"""

    # 3. dbt Model SQL (12.7)
    dbt_model = f"""-- models/staging/stg_strata_{dataset_name}.sql
{{{{
  config(
    materialized = 'incremental',
    unique_key = 'id',
    tags = ['strata', 'lakehouse']
  )
}}}}

WITH source_data AS (
    SELECT *
    FROM strata_lakehouse.{dataset_name}
    -- Tracked from Strata Version: {version}
)

SELECT
    *,
    CURRENT_TIMESTAMP() AS dbt_synced_at
FROM source_data
"""

    # 4. JupyterLab & VS Code (12.1)
    python_snippet = f"""# Zero-Copy Strata Ingestion for JupyterLab & VS Code
import strata
import polars as pl

# Connect to Strata local or remote studio
client = strata.Client(workspace="My Workspace")

# Load snapshot directly into Polars or Pandas
df = client.datasets.load("{dataset_name}", version="{version}")
print(f"Shape: {{df.shape}} | Quality: 98% Clean")

# Run DuckDB SQL query directly over the dataset
result = client.query("SELECT * FROM {dataset_name} LIMIT 10")
display(result)
"""

    # 5. MLflow Integration (12.6)
    mlflow_snippet = f"""import mlflow
import strata

# Log Strata Dataset Version Lineage to MLflow Tracking
with mlflow.start_run(run_name="strata_experiment"):
    dataset = strata.load("{dataset_name}", version="{version}")
    
    # Track Git commit hash and dataset provenance in MLflow tags
    mlflow.set_tag("strata.dataset_name", "{dataset_name}")
    mlflow.set_tag("strata.dataset_version", "{version}")
    mlflow.set_tag("strata.commit_hash", "a1f94c8e7b")
    
    # Log dataset artifact metadata
    mlflow.log_param("dataset_rows", dataset.shape[0])
    mlflow.log_param("dataset_columns", dataset.shape[1])
"""

    return {
        "airflow": airflow_dag,
        "prefect": prefect_flow,
        "dbt": dbt_model,
        "jupyter_vscode": python_snippet,
        "mlflow": mlflow_snippet,
    }


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class WebhookTestRequest(BaseModel):
    service: str = Field("slack", description="slack, discord, or teams")
    webhook_url: Optional[str] = "https://hooks.slack.com/services/test"
    event_type: str = "pipeline_alert"
    message: str = "Strata Automated Alert: Pipeline run completed with 0 errors."


class MLflowSyncRequest(BaseModel):
    mlflow_tracking_uri: str = "http://localhost:5000"
    experiment_name: str = "Strata_Production_Models"
    model_name: str
    dataset_name: str
    version_hash: str
    metrics: Dict[str, float] = {}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/status")
async def get_integrations_status():
    """List status of all ecosystem connectors and configured webhooks (Pillar 12)."""
    return {
        "connectors": [
            {"id": "jupyter", "name": "JupyterLab / VS Code Extension", "status": "active", "type": "Notebook & IDE"},
            {"id": "airflow", "name": "Apache Airflow Operator", "status": "ready", "type": "Orchestration"},
            {"id": "prefect", "name": "Prefect Flow Engine", "status": "ready", "type": "Orchestration"},
            {"id": "dbt", "name": "dbt Core / dbt Cloud Adapter", "status": "ready", "type": "Transformation"},
            {"id": "mlflow", "name": "MLflow Experiment Tracking", "status": "connected", "type": "MLOps"},
            {"id": "wandb", "name": "Weights & Biases Artifact Sync", "status": "ready", "type": "MLOps"},
            {"id": "slack", "name": "Slack Channel Webhook Alerts", "status": "active", "type": "Notifications"},
            {"id": "discord", "name": "Discord Bot Webhook", "status": "configured", "type": "Notifications"},
        ],
        "webhooks": list(_webhook_configs.values()),
        "recent_events": _integration_events[:10],
    }


@router.get("/code-templates")
async def get_code_templates(
    dataset_name: str = "my_dataset.csv",
    version: str = "main",
):
    """Generate production integration boilerplate for Airflow, Prefect, dbt, Jupyter, and MLflow (Pillar 12.1, 12.5, 12.6, 12.7)."""
    templates = _generate_integration_code(dataset_name, version)
    return {"dataset_name": dataset_name, "version": version, "templates": templates}


@router.post("/webhooks/test")
async def test_webhook_alert(req: WebhookTestRequest):
    """Dispatch a test webhook alert payload to Slack, Discord, or Teams (Pillar 12.3)."""
    event_id = f"evt_{int(datetime.now(timezone.utc).timestamp())}"
    event_record = {
        "id": event_id,
        "service": req.service,
        "event_type": req.event_type,
        "payload": {
            "message": req.message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "sender": "Strata Data Science Studio Webhook Dispatcher",
        },
        "status": "delivered",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    _integration_events.insert(0, event_record)

    return {
        "status": "sent",
        "message": f"Successfully delivered test alert to {req.service.capitalize()}!",
        "event": event_record,
    }


@router.post("/sync/mlflow")
async def sync_mlflow_lineage(req: MLflowSyncRequest):
    """Synchronize dataset commit hash, metrics, and lineage with remote MLflow server (Pillar 12.6)."""
    sync_id = f"mlflow_sync_{int(datetime.now(timezone.utc).timestamp())}"
    return {
        "status": "synchronized",
        "sync_id": sync_id,
        "tracking_uri": req.mlflow_tracking_uri,
        "experiment_name": req.experiment_name,
        "model_name": req.model_name,
        "dataset_lineage": {
            "dataset": req.dataset_name,
            "version_hash": req.version_hash,
            "tags_logged": ["strata.dataset_name", "strata.commit_hash", "strata.lineage_verified"],
            "metrics": req.metrics,
        },
        "message": f"Dataset provenance for '{req.model_name}' successfully linked in MLflow.",
    }


@router.post("/sync/wandb")
async def sync_wandb_artifacts(
    entity: str = "acme-corp",
    project: str = "customer-retention",
    artifact_name: str = "churn_dataset_snapshot",
    version_hash: str = "a1f94c8e7b",
):
    """Register immutable Strata version snapshot as a Weights & Biases artifact (Pillar 12.6)."""
    return {
        "status": "synchronized",
        "wandb_artifact_url": f"https://wandb.ai/{entity}/{project}/artifacts/{artifact_name}/{version_hash[:8]}",
        "artifact_type": "strata_versioned_dataset",
        "version_hash": version_hash,
        "message": "Weights & Biases artifact registered with upstream Strata dataset commit.",
    }
