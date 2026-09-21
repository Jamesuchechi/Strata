"""AutoML Sandbox, Feature Importance, and Model Diagnostics Router."""

import math
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import polars as pl
import pandas as pd
import numpy as np

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    roc_curve,
    auc,
    r2_score,
    mean_absolute_error,
    root_mean_squared_error,
)

from strata_api.routers.datasets import _datasets_db

router = APIRouter(prefix="/automl", tags=["AutoML"])


class TrainModelRequest(BaseModel):
    dataset_id: str
    target_column: str
    task_type: Optional[str] = "auto"  # "auto", "classification", "regression"
    model_family: Optional[str] = "random_forest"


@router.post("/train")
async def train_baseline_model(req: TrainModelRequest):
    """Train a baseline ML model with automated task detection, feature importance, and diagnostic curves."""
    record = _datasets_db.get(req.dataset_id)
    if not record:
        for r in _datasets_db.values():
            if r["content_hash"].startswith(req.dataset_id) or r["filename"] == req.dataset_id:
                record = r
                break
    if not record:
        raise HTTPException(status_code=404, detail="Dataset not found")

    file_path = record["file_path"]
    fmt = record.get("format", "").lower()

    try:
        if fmt == "csv":
            df = pl.read_csv(file_path, ignore_errors=True, infer_schema_length=2000)
        elif fmt == "parquet":
            df = pl.read_parquet(file_path)
        elif fmt == "excel":
            try:
                df = pl.read_excel(file_path, sheet_name=record.get("active_sheet"))
            except Exception:
                df = pl.from_pandas(pd.read_excel(file_path, engine="openpyxl"))
        else:
            df = pl.DataFrame(record.get("preview_rows", []))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to load dataset: {e}")

    pdf = df.to_pandas()
    target_col = req.target_column
    if target_col not in pdf.columns:
        raise HTTPException(status_code=400, detail=f"Target column '{target_col}' not found in dataset")

    # Drop rows where target is null
    clean_df = pdf.dropna(subset=[target_col]).copy()
    if len(clean_df) < 10:
        raise HTTPException(status_code=400, detail="Dataset has too few rows for AutoML training (minimum 10 rows)")

    # Auto-detect task type
    target_series = clean_df[target_col]
    unique_target_count = target_series.nunique()
    is_numeric = pd.api.types.is_numeric_dtype(target_series)

    if req.task_type == "auto":
        if not is_numeric or unique_target_count <= 8:
            task = "classification"
        else:
            task = "regression"
    else:
        task = req.task_type.lower()

    # Separate X and Y
    y_raw = target_series
    X_raw = clean_df.drop(columns=[target_col])

    # Filter out identifier-like or heavy text columns (cardinality > 80% or len string > 100)
    drop_cols = []
    for col in X_raw.columns:
        if X_raw[col].dtype == "object":
            if X_raw[col].nunique() / len(X_raw) > 0.85:
                drop_cols.append(col)
    X_clean = X_raw.drop(columns=drop_cols)

    # Impute and One-Hot Encode features
    numeric_features = X_clean.select_dtypes(include=[np.number]).columns.tolist()
    categorical_features = X_clean.select_dtypes(exclude=[np.number]).columns.tolist()

    for col in numeric_features:
        median_val = X_clean[col].median()
        X_clean[col] = X_clean[col].fillna(median_val if not pd.isna(median_val) else 0)

    if categorical_features:
        X_clean = pd.get_dummies(X_clean, columns=categorical_features, drop_first=True)

    if X_clean.shape[1] == 0:
        raise HTTPException(status_code=400, detail="No suitable predictive features available after preprocessing")

    # Target encoding for classification if categorical
    class_labels = []
    if task == "classification":
        if not is_numeric or y_raw.dtype == "object" or y_raw.dtype.name == "category":
            unique_labels = sorted(y_raw.unique().tolist())
            label_map = {lbl: idx for idx, lbl in enumerate(unique_labels)}
            y = y_raw.map(label_map)
            class_labels = [str(lbl) for lbl in unique_labels]
        else:
            y = y_raw.astype(int)
            class_labels = [str(c) for c in sorted(y.unique().tolist())]
    else:
        y = y_raw.astype(float)

    # Train / Test split
    stratify = y if (task == "classification" and unique_target_count > 1 and y.value_counts().min() >= 2) else None
    X_train, X_test, y_train, y_test = train_test_split(
        X_clean, y, test_size=0.25, random_state=42, stratify=stratify
    )

    leakage_warnings = []

    # Fit Model
    if task == "classification":
        model = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        y_prob = model.predict_proba(X_test) if hasattr(model, "predict_proba") else None

        acc = float(accuracy_score(y_test, y_pred))
        prec = float(precision_score(y_test, y_pred, average="weighted", zero_division=0))
        rec = float(recall_score(y_test, y_pred, average="weighted", zero_division=0))
        f1 = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))

        cm = confusion_matrix(y_test, y_pred).tolist()

        # ROC Curve for binary classification
        roc_data = None
        if len(class_labels) == 2 and y_prob is not None:
            fpr, tpr, _ = roc_curve(y_test, y_prob[:, 1])
            roc_auc = float(auc(fpr, tpr))
            roc_data = {
                "auc": round(roc_auc, 3),
                "points": [{"fpr": round(float(f), 3), "tpr": round(float(t), 3)} for f, t in zip(fpr, tpr)][:50]
            }

        diagnostics = {
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

        r2 = float(r2_score(y_test, y_pred))
        mae = float(mean_absolute_error(y_test, y_pred))
        rmse = float(root_mean_squared_error(y_test, y_pred))

        residuals = [
            {"actual": round(float(a), 2), "predicted": round(float(p), 2), "residual": round(float(a - p), 2)}
            for a, p in zip(y_test, y_pred)
        ][:40]

        diagnostics = {
            "task": "regression",
            "r2_score": round(r2, 3),
            "mae": round(mae, 2),
            "rmse": round(rmse, 2),
            "residuals": residuals,
        }

    # Feature Importance
    importances = model.feature_importances_
    features_ranked = sorted(
        [{"feature": col, "importance": round(float(imp), 4)} for col, imp in zip(X_clean.columns, importances)],
        key=lambda x: x["importance"],
        reverse=True
    )

    # Check for target leakage
    if features_ranked and features_ranked[0]["importance"] > 0.85:
        leakage_warnings.append(
            f"Possible Data Leakage: Feature '{features_ranked[0]['feature']}' accounts for "
            f"{features_ranked[0]['importance']*100:.1f}% of model importance."
        )

    return {
        "dataset_name": record["filename"],
        "target_column": target_col,
        "task_type": task,
        "model_name": "Random Forest Baseline",
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "features_count": X_clean.shape[1],
        "diagnostics": diagnostics,
        "feature_importances": features_ranked[:12],
        "leakage_warnings": leakage_warnings,
    }
