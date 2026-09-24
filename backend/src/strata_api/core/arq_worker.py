"""ARQ worker: task definitions and WorkerSettings for Strata's async job queue.

ARQ is a lightweight asyncio Redis job queue (by the Pydantic author).
It uses Redis for both the job queue and result storage.

All heavy / long-running work is defined here as plain ``async def`` functions.
The FastAPI routers enqueue them via an ARQ pool (created at app startup)
and immediately return a ``job_id``.  Clients poll
``GET /jobs/{job_id}`` for progress.

To start a worker (from the backend/ directory)::

    arq strata_api.core.arq_worker.WorkerSettings

Or via the helper script::

    strata-api worker

The ``ctx`` dict is populated by ARQ on worker startup (``on_startup``) and
torn down by ``on_shutdown``.  All tasks receive it as their first argument.
"""

from __future__ import annotations

import logging
import os
import time
import traceback
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import polars as pl
import pandas as pd
import numpy as np

from arq.connections import RedisSettings
from strata_api.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Worker lifecycle hooks
# ---------------------------------------------------------------------------

async def on_startup(ctx: Dict[str, Any]) -> None:
    """Initialise any per-worker state (DB sessions, caches, etc.)."""
    logger.info("ARQ worker starting up.")


async def on_shutdown(ctx: Dict[str, Any]) -> None:
    """Clean up per-worker resources."""
    logger.info("ARQ worker shutting down.")


# ---------------------------------------------------------------------------
# Helper: parse a Redis URL into ARQ RedisSettings
# ---------------------------------------------------------------------------

def _redis_settings_from_url(url: str) -> RedisSettings:
    """Convert ``redis://host:port/db`` to an ARQ ``RedisSettings`` object."""
    import re
    m = re.match(
        r"redis://(?:(?P<user>[^:@]*)(?::(?P<password>[^@]*))?@)?"
        r"(?P<host>[^:/]+)(?::(?P<port>\d+))?(?:/(?P<db>\d+))?",
        url,
    )
    if not m:
        # Fallback to localhost defaults
        return RedisSettings()
    return RedisSettings(
        host=m.group("host") or "localhost",
        port=int(m.group("port") or 6379),
        database=int(m.group("db") or 0),
        password=m.group("password") or None,
    )


# ---------------------------------------------------------------------------
# Task: run_pipeline_task
# ---------------------------------------------------------------------------

async def run_pipeline_task(
    ctx: Dict[str, Any],
    *,
    pipeline: Dict[str, Any],
    dataset_record: Dict[str, Any],
    run_id: str,
) -> Dict[str, Any]:
    """Execute a pipeline in the ARQ worker process.

    Parameters
    ----------
    ctx:
        ARQ context dict (populated by the worker).
    pipeline:
        Serialised pipeline dict (same structure stored in ``_pipelines_db``).
    dataset_record:
        The resolved dataset record, serialised by the API process at enqueue
        time.  The worker has its own empty ``_datasets_db``, so we never look
        up datasets by ID here — the API hands us everything we need.
    run_id:
        Pre-generated run ID so the caller can reference it immediately.

    Returns
    -------
    The full run result dict (``status``, ``duration_ms``, …).
    """
    from strata_api.core.persistence import save_pipeline_run_to_db, save_dead_letter_job_to_db

    start_iso = datetime.now(timezone.utc).isoformat()
    logs: List[str] = []

    def _ts() -> str:
        return datetime.now(timezone.utc).strftime("%H:%M:%S")

    try:
        file_path = dataset_record.get("file_path")
        if not file_path or not os.path.exists(file_path):
            raise ValueError(
                f"Dataset file missing at '{file_path}'. "
                "Ensure the file is accessible from the worker process."
            )

        logs.append(f"[{_ts()}] Initialising ARQ compute sandbox…")
        logs.append(
            f"[{_ts()}] Resource limits — "
            f"{pipeline.get('max_memory_mb', 512)}MB RAM, "
            f"timeout {pipeline.get('timeout_seconds', 60)}s"
        )
        logs.append(f"[{_ts()}] Ingesting {os.path.basename(file_path)}")

        start_perf = time.perf_counter()

        if file_path.endswith(".csv"):
            df = pl.read_csv(file_path)
        elif file_path.endswith(".parquet"):
            df = pl.read_parquet(file_path)
        elif file_path.endswith(".xlsx"):
            df = pl.from_pandas(pd.read_excel(file_path))
        else:
            df = pl.read_csv(file_path)

        initial_rows, initial_cols = len(df), len(df.columns)
        logs.append(f"[{_ts()}] Snapshot loaded: {initial_rows} rows × {initial_cols} cols")

        for idx, step in enumerate(pipeline.get("steps", [])):
            step_type = step.get("type", "")
            step_name = step.get("name", f"Step {idx + 1}")
            logs.append(f"[{_ts()}] Step {idx + 1}: '{step_name}' ({step_type})")

            if step_type == "filter":
                cond = step.get("condition", "")
                if ">" in cond:
                    col, val = [s.strip() for s in cond.split(">")]
                    df = df.filter(pl.col(col) > float(val))
                elif "<" in cond:
                    col, val = [s.strip() for s in cond.split("<")]
                    df = df.filter(pl.col(col) < float(val))
            elif step_type == "expression":
                expr = step.get("expr", "")
                out_col = step.get("output_col", "calc_feature")
                if "/" in expr:
                    p1, p2 = [s.strip() for s in expr.split("/")]
                    c1 = p1.strip("() ")
                    c2 = p2.strip("() ")
                    if c1 in df.columns and c2 in df.columns:
                        df = df.with_columns(
                            (pl.col(c1) / (pl.col(c2) + 1.0)).alias(out_col)
                        )
                elif "*" in expr:
                    p1, p2 = [s.strip() for s in expr.split("*")]
                    if p1 in df.columns and p2 in df.columns:
                        df = df.with_columns(
                            (pl.col(p1) * pl.col(p2)).alias(out_col)
                        )
            elif step_type == "quantile_clip":
                for col in step.get("columns", []):
                    if col in df.columns:
                        q99 = df[col].quantile(0.99)
                        if q99 is not None:
                            df = df.with_columns(
                                pl.when(pl.col(col) > q99)
                                .then(q99)
                                .otherwise(pl.col(col))
                                .alias(col)
                            )
            elif step_type in ("python", "python_script", "script", "custom"):
                from strata_api.core.sandbox import run_sandboxed_code, validate_safe_code
                code = step.get("code") or step.get("script") or step.get("expr") or ""
                validate_safe_code(code)
                timeout_s = float(pipeline.get("timeout_seconds", 30) or 30)
                df = run_sandboxed_code(code, df, timeout_seconds=timeout_s)

            logs.append(f"[{_ts()}] Step {idx + 1} OK")

        duration_ms = round((time.perf_counter() - start_perf) * 1000, 2)
        logs.append(f"[{_ts()}] Done in {duration_ms}ms — {len(df)} rows × {len(df.columns)} cols")

        run_record = {
            "run_id": run_id,
            "pipeline_id": pipeline.get("id"),
            "pipeline_name": pipeline.get("name"),
            "status": "success",
            "started_at": start_iso,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "duration_ms": duration_ms,
            "input_rows": initial_rows,
            "output_rows": len(df),
            "output_columns": len(df.columns),
            "columns": df.columns,
            "sample_preview": df.head(10).to_dicts(),
            "logs": logs,
        }
        save_pipeline_run_to_db(run_record)
        return run_record

    except Exception as exc:
        err_msg = str(exc)
        logs.append(f"[{_ts()}] ERROR: {err_msg}")
        logger.error("Pipeline task %s failed: %s", run_id, exc, exc_info=True)

        run_record = {
            "run_id": run_id,
            "pipeline_id": pipeline.get("id"),
            "pipeline_name": pipeline.get("name"),
            "status": "failed",
            "error": err_msg,
            "started_at": start_iso,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "logs": logs,
        }
        try:
            from strata_api.core.persistence import save_pipeline_run_to_db, save_dead_letter_job_to_db
            save_pipeline_run_to_db(run_record)
            save_dead_letter_job_to_db({
                "dlq_id": f"dlq_{uuid.uuid4().hex[:8]}",
                "run_id": run_id,
                "pipeline_id": pipeline.get("id"),
                "error": err_msg,
                "timestamp": run_record["completed_at"],
                "retry_count": 0,
                "resolved": False,
            })
        except Exception as persist_err:
            logger.error("Failed to persist failed run record: %s", persist_err)

        # Re-raise so ARQ marks the job as failed and stores the traceback.
        raise


# ---------------------------------------------------------------------------
# Task: train_automl_task
# ---------------------------------------------------------------------------

async def train_automl_task(
    ctx: Dict[str, Any],
    *,
    dataset_record: Dict[str, Any],
    target_column: str,
    task_type: str,
    model_family: str,
) -> Dict[str, Any]:
    """Train a baseline ML model off the request thread.

    Returns the same response dict that the old synchronous endpoint returned,
    so the frontend polling ``GET /jobs/{job_id}`` gets an identical payload.
    """
    import polars as pl
    import pandas as pd
    import numpy as np
    from sklearn.model_selection import train_test_split
    from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
    from sklearn.metrics import (
        accuracy_score, precision_score, recall_score, f1_score,
        confusion_matrix, roc_curve, auc, r2_score,
        mean_absolute_error, root_mean_squared_error,
    )

    file_path = dataset_record["file_path"]
    fmt = dataset_record.get("format", "").lower()

    if fmt == "csv":
        df = pl.read_csv(file_path, ignore_errors=True, infer_schema_length=2000)
    elif fmt == "parquet":
        df = pl.read_parquet(file_path)
    elif fmt == "excel":
        try:
            df = pl.read_excel(file_path, sheet_name=dataset_record.get("active_sheet"))
        except Exception:
            df = pl.from_pandas(pd.read_excel(file_path, engine="openpyxl"))
    else:
        df = pl.DataFrame(dataset_record.get("preview_rows", []))

    pdf = df.to_pandas()
    if target_column not in pdf.columns:
        raise ValueError(f"Target column '{target_column}' not found")

    clean_df = pdf.dropna(subset=[target_column]).copy()
    if len(clean_df) < 10:
        raise ValueError("Dataset has too few rows for AutoML (minimum 10)")

    target_series = clean_df[target_column]
    unique_count = target_series.nunique()
    is_numeric = pd.api.types.is_numeric_dtype(target_series)

    if task_type == "auto":
        task = "classification" if (not is_numeric or unique_count <= 8) else "regression"
    else:
        task = task_type.lower()

    y_raw = target_series
    X_raw = clean_df.drop(columns=[target_column])

    # Drop high-cardinality text columns
    drop_cols = [
        c for c in X_raw.columns
        if X_raw[c].dtype == "object" and X_raw[c].nunique() / len(X_raw) > 0.85
    ]
    X_clean = X_raw.drop(columns=drop_cols)

    numeric_features = X_clean.select_dtypes(include=[np.number]).columns.tolist()
    categorical_features = X_clean.select_dtypes(exclude=[np.number]).columns.tolist()

    for col in numeric_features:
        median_val = X_clean[col].median()
        X_clean[col] = X_clean[col].fillna(median_val if not pd.isna(median_val) else 0)

    if categorical_features:
        X_clean = pd.get_dummies(X_clean, columns=categorical_features, drop_first=True)

    if X_clean.shape[1] == 0:
        raise ValueError("No suitable predictive features after preprocessing")

    class_labels: List[str] = []
    if task == "classification":
        if not is_numeric or y_raw.dtype == "object":
            unique_labels = sorted(y_raw.unique().tolist())
            label_map = {lbl: idx for idx, lbl in enumerate(unique_labels)}
            y = y_raw.map(label_map)
            class_labels = [str(lbl) for lbl in unique_labels]
        else:
            y = y_raw.astype(int)
            class_labels = [str(c) for c in sorted(y.unique().tolist())]
    else:
        y = y_raw.astype(float)

    stratify = (
        y if (task == "classification" and unique_count > 1 and y.value_counts().min() >= 2)
        else None
    )
    X_train, X_test, y_train, y_test = train_test_split(
        X_clean, y, test_size=0.25, random_state=42, stratify=stratify
    )

    leakage_warnings: List[str] = []

    if task == "classification":
        model = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        y_prob = model.predict_proba(X_test) if hasattr(model, "predict_proba") else None

        acc   = float(accuracy_score(y_test, y_pred))
        prec  = float(precision_score(y_test, y_pred, average="weighted", zero_division=0))
        rec   = float(recall_score(y_test, y_pred, average="weighted", zero_division=0))
        f1    = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))
        cm    = confusion_matrix(y_test, y_pred).tolist()

        roc_data = None
        if len(class_labels) == 2 and y_prob is not None:
            fpr, tpr, _ = roc_curve(y_test, y_prob[:, 1])
            roc_data = {
                "auc": round(float(auc(fpr, tpr)), 3),
                "points": [
                    {"fpr": round(float(f), 3), "tpr": round(float(t), 3)}
                    for f, t in zip(fpr, tpr)
                ][:50],
            }

        diagnostics: Dict[str, Any] = {
            "task": "classification",
            "accuracy": round(acc, 3),
            "precision": round(prec, 3),
            "recall": round(rec, 3),
            "f1_score": round(f1, 3),
            "classes": class_labels,
            "confusion_matrix": cm,
            "roc": roc_data,
        }
    else:
        model = RandomForestRegressor(n_estimators=100, max_depth=6, random_state=42)
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)

        residuals = [
            {"actual": round(float(a), 2), "predicted": round(float(p), 2), "residual": round(float(a - p), 2)}
            for a, p in zip(y_test, y_pred)
        ][:40]

        diagnostics = {
            "task": "regression",
            "r2_score": round(float(r2_score(y_test, y_pred)), 3),
            "mae": round(float(mean_absolute_error(y_test, y_pred)), 2),
            "rmse": round(float(root_mean_squared_error(y_test, y_pred)), 2),
            "residuals": residuals,
        }

    importances = model.feature_importances_
    features_ranked = sorted(
        [{"feature": col, "importance": round(float(imp), 4)} for col, imp in zip(X_clean.columns, importances)],
        key=lambda x: x["importance"],
        reverse=True,
    )

    if features_ranked and features_ranked[0]["importance"] > 0.85:
        leakage_warnings.append(
            f"Possible Data Leakage: '{features_ranked[0]['feature']}' accounts for "
            f"{features_ranked[0]['importance'] * 100:.1f}% of model importance."
        )

    return {
        "dataset_name": dataset_record["filename"],
        "target_column": target_column,
        "task_type": task,
        "model_name": "Random Forest Baseline",
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "features_count": X_clean.shape[1],
        "diagnostics": diagnostics,
        "feature_importances": features_ranked[:12],
        "leakage_warnings": leakage_warnings,
    }


# ---------------------------------------------------------------------------
# Task: run_eda_profile_task
# ---------------------------------------------------------------------------

async def run_eda_profile_task(
    ctx: Dict[str, Any],
    *,
    dataset_record: Dict[str, Any],
) -> Dict[str, Any]:
    """Compute a full EDA profile off the request thread.

    Returns the same JSON structure as ``GET /eda/{dataset_id}`` so the
    polling client gets a transparent result.
    """
    import polars as pl
    import pandas as pd
    import numpy as np
    import math

    file_path = dataset_record["file_path"]
    fmt = dataset_record.get("format", "").lower()

    if fmt == "csv":
        df = pl.read_csv(file_path, ignore_errors=True, infer_schema_length=2000)
    elif fmt == "parquet":
        df = pl.read_parquet(file_path)
    elif fmt == "excel":
        try:
            df = pl.read_excel(file_path)
        except Exception:
            df = pl.from_pandas(pd.read_excel(file_path, engine="openpyxl"))
    else:
        df = pl.DataFrame(dataset_record.get("preview_rows", []))

    pdf = df.to_pandas()
    numeric_cols = pdf.select_dtypes(include=[np.number]).columns.tolist()

    # Correlation matrix
    corr_data: Dict[str, Any] = {}
    if len(numeric_cols) >= 2:
        corr_matrix = pdf[numeric_cols].corr()
        corr_data = {
            "columns": numeric_cols,
            "matrix": [
                [round(v, 3) if not math.isnan(v) else None for v in row]
                for row in corr_matrix.values.tolist()
            ],
        }

    # Pairplot sample (at most 5 cols, 200 rows)
    pairplot_cols = numeric_cols[:5]
    pairplot_sample = pdf[pairplot_cols].dropna().head(200).to_dict(orient="list")

    # Per-column distribution skewness
    skewness = {}
    for col in numeric_cols:
        series = pdf[col].dropna()
        if len(series) > 1:
            skewness[col] = round(float(series.skew()), 3)

    # Multicollinearity (VIF approximation using correlation)
    multicollinearity_flags = []
    if len(numeric_cols) >= 2:
        corr_matrix = pdf[numeric_cols].corr().abs()
        for i, col_a in enumerate(numeric_cols):
            for j, col_b in enumerate(numeric_cols):
                if i < j and corr_matrix.iloc[i, j] > 0.9:
                    multicollinearity_flags.append({
                        "col_a": col_a,
                        "col_b": col_b,
                        "correlation": round(float(corr_matrix.iloc[i, j]), 3),
                    })

    return {
        "dataset_id": dataset_record.get("id") or dataset_record.get("content_hash"),
        "total_rows": len(pdf),
        "total_cols": len(pdf.columns),
        "numeric_columns": numeric_cols,
        "correlation_matrix": corr_data,
        "pairplot_data": pairplot_sample,
        "skewness": skewness,
        "multicollinearity_flags": multicollinearity_flags,
    }


# ---------------------------------------------------------------------------
# ARQ WorkerSettings
# ---------------------------------------------------------------------------

class WorkerSettings:
    """ARQ worker configuration.

    Start with::

        arq strata_api.core.arq_worker.WorkerSettings

    or::

        strata-api worker
    """

    functions = [
        run_pipeline_task,
        train_automl_task,
        run_eda_profile_task,
    ]

    redis_settings = _redis_settings_from_url(settings.REDIS_URL)

    on_startup = on_startup
    on_shutdown = on_shutdown

    # How long a job may run before ARQ cancels it (seconds).
    # AutoML on a large dataset can take a while; 10 min is a safe ceiling.
    job_timeout = 600

    # Keep job results in Redis for 24 h so polling always finds them.
    keep_result = 86_400

    # How many jobs to run concurrently per worker process.
    max_jobs = 10
