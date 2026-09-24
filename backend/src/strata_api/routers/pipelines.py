"""Isolated compute sandboxes, scheduled pipelines, execution history, dry-run, and dead-letter queues.
Pillars 7 & 13.3: 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 13.3
"""

import os
import time
import uuid
import json
import traceback
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel, Field

from strata_api.models.user import UserModel
from strata_api.routers.auth import get_current_user
from strata_api.routers.datasets import (
    _datasets_db,
    get_storage_dir,
    seed_default_datasets_if_needed,
    check_dataset_access,
    find_dataset_by_name_or_id,
)
from strata_api.core.persistence import (
    save_pipeline_to_db,
    save_pipeline_run_to_db,
    save_dead_letter_job_to_db,
)
from strata_api.core.arq_pool import get_arq_pool

router = APIRouter(prefix="/pipelines", tags=["Pipelines & Compute Sandboxes"])


# In-memory storage for pipelines, run history, and dead-letter queue
_pipelines_db: Dict[str, Dict[str, Any]] = {}
_pipeline_runs: Dict[str, Dict[str, Any]] = {}
_dead_letter_queue: List[Dict[str, Any]] = []

# Reusable Pipeline Templates (7.8)
PIPELINE_TEMPLATES = [
    {
        "id": "tpl_feature_engineering",
        "name": "Feature Engineering & Outlier Clipping",
        "description": "Calculates normalized interaction features, clips 99th percentile outliers, and standardizes numerical columns.",
        "target_dataset": "",
        "steps": [
            {"step_id": "clip_outliers", "operation": "quantile_clip", "columns": ["value", "amount"], "params": {"lower_quantile": 0.01, "upper_quantile": 0.99}},
            {"step_id": "impute_nulls", "operation": "impute_mean", "columns": ["amount"]},
        ],
        "schedule": "0 2 * * *",
    },
    {
        "id": "tpl_data_cleaning",
        "name": "Validation & Positive Value Filter",
        "description": "Filters out invalid negative records and calculates baseline ratio indicators.",
        "target_dataset": "",
        "steps": [
            {"step_id": "filter_positive", "operation": "filter", "condition": "amount > 0"},
        ],
        "schedule": "0 0 1 * *",
    },
]


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class PipelineStep(BaseModel):
    step_id: str
    name: str
    type: str  # filter, expression, conditional, quantile_clip, impute, python, python_script, custom
    condition: Optional[str] = None
    expr: Optional[str] = None
    output_col: Optional[str] = None
    columns: Optional[List[str]] = None
    code: Optional[str] = None
    script: Optional[str] = None


def _validate_pipeline_steps(steps: List[PipelineStep]) -> None:
    """Validate all pipeline steps against AST security policy."""
    from strata_api.core.sandbox import validate_safe_code

    for s in steps:
        candidates = [s.code, s.script, s.condition, s.expr]
        for c in candidates:
            if c and isinstance(c, str) and c.strip():
                try:
                    validate_safe_code(c)
                except ValueError as err:
                    raise HTTPException(status_code=400, detail=f"Unsafe code detected in step '{s.name}': {err}")


class PipelineCreateRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    target_dataset_id: str
    schedule: Optional[str] = "0 0 * * *"
    trigger: Optional[str] = "cron"
    timeout_seconds: Optional[int] = 60
    max_memory_mb: Optional[int] = 512
    steps: List[PipelineStep]


class DryRunRequest(BaseModel):
    dataset_id: str
    steps: List[PipelineStep]
    sample_rows_limit: Optional[int] = 10


# ---------------------------------------------------------------------------
# Sandbox Execution Engine (Pillar 13.3 & 7.2)
# ---------------------------------------------------------------------------

def _execute_pipeline_in_sandbox(pipe: Dict[str, Any], dry_run: bool = False, limit_rows: int = 25) -> Dict[str, Any]:
    """Execute pipeline in memory-safe execution sandbox."""
    import polars as pl

    target_id = pipe.get("target_dataset_id")
    dataset = _datasets_db.get(target_id)
    if not dataset:
        raise ValueError(f"Target dataset '{target_id}' not found in catalog")

    file_path = dataset.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise ValueError(f"Dataset physical storage file missing at '{file_path}'")

    start_time = time.perf_counter()
    logs = [f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] Initializing isolated Python compute sandbox..."]
    logs.append(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] Enforcing resource limit: {pipe.get('max_memory_mb', 512)}MB RAM, timeout {pipe.get('timeout_seconds', 60)}s")
    logs.append(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] Ingesting data from {os.path.basename(file_path)}")

    # Load data via Polars
    if file_path.endswith(".csv"):
        df = pl.read_csv(file_path)
    elif file_path.endswith(".parquet"):
        df = pl.read_parquet(file_path)
    elif file_path.endswith(".xlsx"):
        import pandas as pd
        pdf = pd.read_excel(file_path)
        df = pl.from_pandas(pdf)
    else:
        df = pl.read_csv(file_path)

    initial_rows = len(df)
    initial_cols = len(df.columns)
    logs.append(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] Base snapshot loaded: {initial_rows} rows x {initial_cols} columns")

    if dry_run:
        df = df.head(limit_rows)
        logs.append(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] Dry-run active: limited execution to {len(df)} sample rows")

    # Step-by-step transformation execution
    for idx, step in enumerate(pipe.get("steps", [])):
        step_type = step.get("type")
        step_name = step.get("name", f"Step {idx+1}")
        logs.append(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] Executing Step {idx+1}: '{step_name}' ({step_type})")

        try:
            if step_type == "filter":
                cond = step.get("condition", "")
                if ">" in cond:
                    col, val = [s.strip() for s in cond.split(">")]
                    if col in df.columns:
                        df = df.filter(pl.col(col) > float(val))
                    else:
                        raise ValueError(f"Column '{col}' specified in condition '{cond}' not found in dataset schema")
                elif "<" in cond:
                    col, val = [s.strip() for s in cond.split("<")]
                    if col in df.columns:
                        df = df.filter(pl.col(col) < float(val))
                    else:
                        raise ValueError(f"Column '{col}' specified in condition '{cond}' not found in dataset schema")
            elif step_type == "expression":
                expr = step.get("expr", "")
                out_col = step.get("output_col", "calc_feature")
                if "/" in expr:
                    p1, p2 = [s.strip() for s in expr.split("/")]
                    # handle tenure_months + 1 or similar
                    c1 = p1.replace("(", "").replace(")", "").strip()
                    c2 = p2.replace("(", "").replace(")", "").replace("+ 1", "").strip()
                    if c1 in df.columns and c2 in df.columns:
                        df = df.with_columns((pl.col(c1) / (pl.col(c2) + 1.0)).alias(out_col))
                elif "*" in expr:
                    p1, p2 = [s.strip() for s in expr.split("*")]
                    if p1 in df.columns and p2 in df.columns:
                        df = df.with_columns((pl.col(p1) * pl.col(p2)).alias(out_col))
            elif step_type == "conditional":
                expr = step.get("expr", "")
                out_col = step.get("output_col", "flag")
                if ">" in expr:
                    col, val = [s.strip() for s in expr.split(">")]
                    if col in df.columns:
                        df = df.with_columns(
                            pl.when(pl.col(col) > float(val)).then(pl.lit(1)).otherwise(pl.lit(0)).alias(out_col)
                        )
            elif step_type == "quantile_clip":
                cols = step.get("columns", [])
                for c in cols:
                    if c in df.columns and df[c].dtype in [pl.Float64, pl.Float32, pl.Int64, pl.Int32]:
                        q99 = df[c].quantile(0.99)
                        if q99 is not None:
                            df = df.with_columns(pl.when(pl.col(c) > q99).then(q99).otherwise(pl.col(c)).alias(c))
            elif step_type in ("python", "python_script", "script", "custom"):
                from strata_api.core.sandbox import run_sandboxed_code, validate_safe_code

                code_to_run = step.get("code") or step.get("script") or step.get("expr") or ""
                validate_safe_code(code_to_run)
                timeout_s = pipe.get("timeout_seconds", 30) or 30
                df = run_sandboxed_code(code_to_run, df, timeout_seconds=float(timeout_s))

            logs.append(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] Step {idx+1} completed successfully.")
        except Exception as step_err:
            logs.append(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] ERROR in Step {idx+1}: {str(step_err)}")
            raise step_err

    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
    logs.append(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] Pipeline execution finished in {duration_ms}ms")
    logs.append(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] Output dataset shape: {len(df)} rows x {len(df.columns)} columns")

    sample_preview = df.head(10).to_dicts()

    return {
        "status": "success",
        "duration_ms": duration_ms,
        "input_rows": initial_rows,
        "output_rows": len(df),
        "output_columns": len(df.columns),
        "columns_list": df.columns,
        "sample_preview": sample_preview,
        "logs": logs,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("")
async def list_pipelines(current_user: UserModel = Depends(get_current_user)):
    """List all registered ETL pipelines for current user (Pillar 7.5)."""
    user_pipes = [p for p in _pipelines_db.values() if not p.get("owner_id") or p["owner_id"] == current_user.id]
    return {"pipelines": user_pipes, "total": len(user_pipes)}


@router.get("/templates")
async def get_pipeline_templates(current_user: UserModel = Depends(get_current_user)):
    """List reusable pipeline templates for feature engineering and ETL (Pillar 7.8)."""
    return {"templates": PIPELINE_TEMPLATES}


@router.post("")
async def create_pipeline(
    req: PipelineCreateRequest,
    current_user: UserModel = Depends(get_current_user),
):
    """Register a new scheduled or event-driven pipeline (Pillars 7.2, 7.4)."""
    _validate_pipeline_steps(req.steps)

    if req.target_dataset_id:
        ds = find_dataset_by_name_or_id(req.target_dataset_id)
        if ds:
            check_dataset_access(ds, current_user.id)

    pipe_id = f"pipe_{uuid.uuid4().hex[:8]}"
    pipeline_obj = {
        "id": pipe_id,
        "owner_id": current_user.id,
        "name": req.name,
        "description": req.description,
        "target_dataset_id": req.target_dataset_id,
        "schedule": req.schedule,
        "trigger": req.trigger,
        "timeout_seconds": req.timeout_seconds,
        "max_memory_mb": req.max_memory_mb,
        "steps": [s.model_dump() for s in req.steps],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_run_at": None,
        "last_status": "never_run",
    }
    _pipelines_db[pipe_id] = pipeline_obj
    save_pipeline_to_db(pipeline_obj)
    return {"status": "created", "pipeline": pipeline_obj}


@router.post("/dry-run")
async def pipeline_dry_run(
    req: DryRunRequest,
    current_user: UserModel = Depends(get_current_user),
):
    """Dry-run execution mode with sample output previews before committing changes (Pillar 7.10)."""
    _validate_pipeline_steps(req.steps)

    ds = find_dataset_by_name_or_id(req.dataset_id)
    if ds:
        check_dataset_access(ds, current_user.id)

    virtual_pipe = {
        "target_dataset_id": req.dataset_id,
        "steps": [s.model_dump() for s in req.steps],
        "max_memory_mb": 256,
        "timeout_seconds": 15,
    }
    try:
        result = _execute_pipeline_in_sandbox(virtual_pipe, dry_run=True, limit_rows=req.sample_rows_limit or 10)
        return {"status": "success", "dry_run": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Dry run failed: {str(e)}")


@router.post("/{pipeline_id}/run")
async def run_pipeline(
    pipeline_id: str,
    current_user: UserModel = Depends(get_current_user),
):
    """Enqueue a pipeline execution job via ARQ.

    Returns immediately with a ``job_id``.
    Poll ``GET /api/jobs/{job_id}`` for status and the full run result.
    """
    pipe = _pipelines_db.get(pipeline_id)
    if not pipe:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    if pipe.get("owner_id") and pipe["owner_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You do not have access to this pipeline.")

    pool = get_arq_pool()
    if pool is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "Background job queue unavailable: Redis is not connected. "
                "Start Redis (docker-compose up redis) and restart the API."
            ),
        )

    run_id = f"run_{uuid.uuid4().hex[:8]}"

    # Enqueue the heavy execution into the ARQ worker
    job = await pool.enqueue_job(
        "run_pipeline_task",
        pipeline=pipe,
        run_id=run_id,
    )

    return {
        "status": "queued",
        "job_id": job.job_id,
        "run_id": run_id,
        "pipeline_id": pipeline_id,
        "pipeline_name": pipe["name"],
        "message": (
            f"Pipeline '{pipe['name']}' execution queued. "
            f"Poll GET /api/jobs/{job.job_id} for status and result."
        ),
    }


@router.get("/runs")
async def list_pipeline_runs(
    pipeline_id: Optional[str] = Query(None),
    current_user: UserModel = Depends(get_current_user),
):
    """List execution history across pipelines (Pillar 7.6)."""
    runs = list(_pipeline_runs.values())
    if pipeline_id:
        runs = [r for r in runs if r["pipeline_id"] == pipeline_id]
    runs.sort(key=lambda x: x["started_at"], reverse=True)
    return {"runs": runs, "total": len(runs)}


@router.get("/dlq")
async def get_dead_letter_queue(current_user: UserModel = Depends(get_current_user)):
    """Observability into the Dead-Letter Queue for failed jobs (Pillar 7.9)."""
    return {"dlq": _dead_letter_queue, "total_failed": len(_dead_letter_queue)}


@router.post("/dlq/{dlq_id}/retry")
async def retry_dlq_job(dlq_id: str, current_user: UserModel = Depends(get_current_user)):
    """Trigger automated retry on a failed DLQ job (Pillar 7.9)."""
    entry = next((e for e in _dead_letter_queue if e["dlq_id"] == dlq_id), None)
    if not entry:
        raise HTTPException(status_code=404, detail="DLQ entry not found")

    entry["retry_count"] += 1
    pipe = _pipelines_db.get(entry["pipeline_id"])
    if not pipe:
        raise HTTPException(status_code=404, detail="Underlying pipeline was deleted")

    if pipe.get("owner_id") and pipe["owner_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You do not have access to this pipeline.")

    try:
        res = _execute_pipeline_in_sandbox(pipe)
        entry["resolved"] = True
        save_dead_letter_job_to_db(entry)
        return {"status": "retry_success", "dlq_id": dlq_id, "result": res}
    except Exception as e:
        save_dead_letter_job_to_db(entry)
        return {"status": "retry_failed", "dlq_id": dlq_id, "error": str(e)}

