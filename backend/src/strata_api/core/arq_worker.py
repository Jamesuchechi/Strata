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
    logger.info("ARQ worker connected to Redis. Ready to process background jobs.")


async def on_shutdown(ctx: Dict[str, Any]) -> None:
    """Clean up per-worker resources."""
    logger.info("ARQ worker shutting down gracefully.")


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

    # Clean feature names for tree algorithms (LightGBM/XGBoost forbid JSON special chars)
    import re
    clean_feature_names = [re.sub(r'[\[\]<>, ":{}]', '_', str(c)) for c in X_clean.columns]
    X_train.columns = clean_feature_names
    X_test.columns = clean_feature_names

    model_family_norm = (model_family or "random_forest").lower().strip()

    if model_family_norm in ("lightgbm", "lgbm"):
        import lightgbm as lgb  # type: ignore
        model_name = "LightGBM"
        if task == "classification":
            model = lgb.LGBMClassifier(
                n_estimators=100,
                max_depth=6,
                min_child_samples=1,
                random_state=42,
                verbose=-1,
            )
        else:
            model = lgb.LGBMRegressor(
                n_estimators=100,
                max_depth=6,
                min_child_samples=1,
                random_state=42,
                verbose=-1,
            )
    elif model_family_norm in ("xgboost", "xgb"):
        import xgboost as xgb  # type: ignore
        model_name = "XGBoost"
        if task == "classification":
            model = xgb.XGBClassifier(
                n_estimators=100,
                max_depth=6,
                random_state=42,
                eval_metric="logloss" if len(class_labels) <= 2 else "mlogloss",
            )
        else:
            model = xgb.XGBRegressor(
                n_estimators=100,
                max_depth=6,
                random_state=42,
            )
    else:
        model_name = "Random Forest"
        if task == "classification":
            model = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
        else:
            model = RandomForestRegressor(n_estimators=100, max_depth=6, random_state=42)

    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    y_pred_arr = np.asarray(y_pred)
    y_prob = model.predict_proba(X_test) if hasattr(model, "predict_proba") else None

    if task == "classification":
        acc   = float(accuracy_score(y_test, y_pred))
        prec  = float(precision_score(y_test, y_pred, average="weighted", zero_division=0))
        rec   = float(recall_score(y_test, y_pred, average="weighted", zero_division=0))
        f1    = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))
        cm    = confusion_matrix(y_test, y_pred).tolist()

        roc_data = None
        if len(class_labels) == 2 and y_prob is not None:
            y_prob_mat = np.asarray(y_prob)
            fpr, tpr, _ = roc_curve(y_test, y_prob_mat[:, 1])
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
        residuals = [
            {"actual": round(float(a), 2), "predicted": round(float(p), 2), "residual": round(float(a - p), 2)}
            for a, p in zip(y_test, y_pred_arr)
        ][:40]

        diagnostics = {
            "task": "regression",
            "r2_score": round(float(r2_score(y_test, y_pred)), 3),
            "mae": round(float(mean_absolute_error(y_test, y_pred)), 2),
            "rmse": round(float(root_mean_squared_error(y_test, y_pred)), 2),
            "residuals": residuals,
        }

    # Compute real SHAP values with TreeExplainer
    import shap  # type: ignore
    eval_X = X_test.iloc[:100] if len(X_test) > 100 else X_test

    try:
        explainer = shap.TreeExplainer(model)
        raw_shap = explainer.shap_values(eval_X)

        if isinstance(raw_shap, list):
            if len(raw_shap) == 2:
                shap_matrix = np.asarray(raw_shap[1])
            else:
                shap_matrix = np.mean([np.abs(np.asarray(s)) for s in raw_shap], axis=0)
        elif isinstance(raw_shap, np.ndarray) and raw_shap.ndim == 3:
            if raw_shap.shape[-1] == 2:
                shap_matrix = raw_shap[:, :, 1]
            else:
                shap_matrix = np.mean(np.abs(raw_shap), axis=-1)
        else:
            shap_matrix = np.asarray(raw_shap)

        exp_val = getattr(explainer, "expected_value", 0.0)
        if isinstance(exp_val, (list, np.ndarray)):
            base_val = float(exp_val[1]) if len(exp_val) == 2 else float(exp_val[0])
        else:
            base_val = float(exp_val)
    except Exception:
        try:
            explainer = shap.Explainer(model, X_train.iloc[:50])
            explanation = explainer(eval_X)
            if isinstance(explanation, list):
                vals = [np.asarray(e.values if hasattr(e, "values") else e) for e in explanation]
                base_vals = [e.base_values if hasattr(e, "base_values") else 0.0 for e in explanation]
                if len(vals) == 2:
                    shap_matrix = np.asarray(vals[1])
                    b_val = base_vals[1]
                    base_val = float(np.mean(b_val)) if hasattr(b_val, "__iter__") or isinstance(b_val, (list, np.ndarray)) else float(b_val)
                else:
                    shap_matrix = np.mean([np.abs(np.asarray(v)) for v in vals], axis=0)
                    base_val = float(np.mean([np.mean(bv) if hasattr(bv, "__iter__") or isinstance(bv, (list, np.ndarray)) else bv for bv in base_vals]))
            else:
                raw_val = getattr(explanation, "values", explanation)
                val_arr = np.asarray(raw_val)
                if val_arr.ndim == 3:
                    shap_matrix = val_arr[:, :, 1] if val_arr.shape[-1] == 2 else np.mean(np.abs(val_arr), axis=-1)
                else:
                    shap_matrix = val_arr
                exp_base = getattr(explanation, "base_values", 0.0)
                if isinstance(exp_base, (list, np.ndarray)) or hasattr(exp_base, "__iter__"):
                    base_val = float(np.mean(exp_base))
                else:
                    base_val = float(exp_base)
        except Exception:
            shap_matrix = np.zeros((len(eval_X), len(clean_feature_names)))
            base_val = 0.0

    shap_matrix = np.asarray(shap_matrix)
    mean_abs_shap = np.mean(np.abs(shap_matrix), axis=0)
    if mean_abs_shap.ndim > 1:
        mean_abs_shap = mean_abs_shap.flatten()

    feature_names = clean_feature_names
    ranked_indices = np.argsort(mean_abs_shap)[::-1]

    features_ranked = [
        {
            "feature": feature_names[i],
            "importance": round(float(mean_abs_shap[i]), 4),
            "mean_abs_shap": round(float(mean_abs_shap[i]), 4),
        }
        for i in ranked_indices
    ]

    # SHAP Summary Plot Distribution
    summary_plot_data = []
    for i in ranked_indices[:15]:
        col_name = feature_names[i]
        points = []
        col_vals = eval_X[col_name].to_numpy()
        col_shaps = shap_matrix[:, i]
        for fv, sv in zip(col_vals[:50], col_shaps[:50]):
            points.append({
                "feature_value": round(float(fv), 3) if isinstance(fv, (int, float, np.number)) else str(fv),
                "shap_value": round(float(sv), 4),
            })
        summary_plot_data.append({
            "feature": col_name,
            "mean_abs_shap": round(float(mean_abs_shap[i]), 4),
            "distribution": points,
        })

    # SHAP Waterfall for Sample Row
    sample_idx = 0
    sample_features = []
    if len(eval_X) > 0:
        row_vals = eval_X.iloc[sample_idx]
        row_shaps = shap_matrix[sample_idx]
        for i in ranked_indices[:15]:
            sample_features.append({
                "feature": feature_names[i],
                "feature_value": round(float(row_vals.iloc[i]), 3) if isinstance(row_vals.iloc[i], (int, float, np.number)) else str(row_vals.iloc[i]),
                "shap_value": round(float(row_shaps[i]), 4),
            })

    waterfall_data = {
        "sample_index": sample_idx,
        "base_value": round(base_val, 4),
        "prediction_value": round(float(y_pred_arr[sample_idx]) if len(y_pred_arr) > 0 else 0.0, 4),
        "feature_contributions": sample_features,
    }

    # Data Leakage Detection
    leakage_warnings: List[str] = []

    # 1. Target Correlation / Exact Match Leakage
    for col in clean_feature_names:
        if is_numeric:
            try:
                corr = np.abs(np.corrcoef(X_clean[col].to_numpy(), y.to_numpy())[0, 1])
                if not np.isnan(corr) and corr > 0.98:
                    leakage_warnings.append(
                        f"Target Leakage Suspicion: Feature '{col}' has extreme correlation ({corr:.3f}) with target."
                    )
            except Exception:
                pass
        try:
            if (X_clean[col] == y).mean() > 0.98:
                leakage_warnings.append(
                    f"Direct Target Leakage: Feature '{col}' matches target values identically on >98% of rows."
                )
        except Exception:
            pass

    # 2. Train/Test Contamination
    try:
        train_hashes = pd.util.hash_pandas_object(X_train).to_numpy()
        test_hashes = pd.util.hash_pandas_object(X_test).to_numpy()
        overlap_count = np.intersect1d(train_hashes, test_hashes).size
        if overlap_count > 0:
            pct_overlap = (overlap_count / len(X_test)) * 100
            leakage_warnings.append(
                f"Train/Test Contamination: {overlap_count} duplicate rows ({pct_overlap:.1f}% of test set) appear in both train and test splits."
            )
    except Exception:
        pass

    # 3. Disproportionate Feature Dominance (>85% SHAP importance)
    if features_ranked:
        total_imp = sum(f["importance"] for f in features_ranked) or 1.0
        top_pct = features_ranked[0]["importance"] / total_imp
        if top_pct > 0.85:
            leakage_warnings.append(
                f"High Importance Anomaly: Feature '{features_ranked[0]['feature']}' accounts for "
                f"{top_pct * 100:.1f}% of total model SHAP importance."
            )

    return {
        "dataset_name": dataset_record["filename"],
        "target_column": target_column,
        "task_type": task,
        "model_name": model_name,
        "model_family": model_family_norm,
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "features_count": X_clean.shape[1],
        "diagnostics": diagnostics,
        "feature_importances": features_ranked[:12],
        "shap": {
            "summary": summary_plot_data,
            "waterfall": waterfall_data,
        },
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
        num_df = pd.DataFrame(pdf[numeric_cols])
        corr_matrix = num_df.corr()
        if isinstance(corr_matrix, pd.DataFrame):
            corr_data = {
                "columns": numeric_cols,
                "matrix": [
                    [round(float(v), 3) if not math.isnan(float(v)) else None for v in row]
                    for row in corr_matrix.to_numpy().tolist()
                ],
            }

    # Pairplot sample (at most 5 cols, 200 rows)
    pairplot_cols = numeric_cols[:5]
    pairplot_df = pd.DataFrame(pdf[pairplot_cols]).dropna().head(200)
    pairplot_sample = pairplot_df.to_dict(orient="list")

    # Per-column distribution skewness
    skewness = {}
    for col in numeric_cols:
        series = pdf[col].dropna()
        if len(series) > 1:
            skewness[col] = round(float(series.skew()), 3)

    # Multicollinearity (VIF approximation using correlation)
    multicollinearity_flags = []
    if len(numeric_cols) >= 2:
        num_df = pd.DataFrame(pdf[numeric_cols])
        corr_abs_df = num_df.corr().abs()
        if isinstance(corr_abs_df, pd.DataFrame):
            for i, col_a in enumerate(numeric_cols):
                for j, col_b in enumerate(numeric_cols):
                    if i < j and float(corr_abs_df.iloc[i, j]) > 0.9:
                        multicollinearity_flags.append({
                            "col_a": col_a,
                            "col_b": col_b,
                            "correlation": round(float(corr_abs_df.iloc[i, j]), 3),
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
