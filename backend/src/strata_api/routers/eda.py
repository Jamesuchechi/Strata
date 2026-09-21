"""Deep Exploratory Data Analysis (EDA) and Statistical Hypothesis Testing Router."""

import math
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import polars as pl
import pandas as pd
import numpy as np
from scipy import stats

from strata_api.routers.datasets import _datasets_db

router = APIRouter(prefix="/eda", tags=["EDA & Hypothesis Testing"])


class HypothesisTestRequest(BaseModel):
    test_type: str  # "ttest", "anova", "chi2", "mannwhitney"
    target_col: str
    group_col: Optional[str] = None
    col2: Optional[str] = None


@router.get("/{dataset_id}")
async def get_deep_eda_dossier(dataset_id: str):
    """Generate comprehensive EDA dossier: correlation matrix, multicollinearity, pairplot data, and distribution skewness."""
    record = _datasets_db.get(dataset_id)
    if not record:
        for r in _datasets_db.values():
            if r["content_hash"].startswith(dataset_id) or r["filename"] == dataset_id:
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
        elif fmt == "json":
            df = pl.read_json(file_path)
        else:
            df = pl.DataFrame(record.get("preview_rows", []))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to load dataset: {e}")

    # Identify numeric vs categorical columns
    numeric_cols = [c for c, dt in zip(df.columns, df.dtypes) if dt.is_numeric()]
    categorical_cols = [c for c, dt in zip(df.columns, df.dtypes) if not dt.is_numeric()]

    # 1. Pearson Correlation Matrix for numeric columns
    corr_matrix: Dict[str, Dict[str, float]] = {}
    multicollinearity_flags = []
    
    if len(numeric_cols) >= 2:
        pdf_num = df.select(numeric_cols).to_pandas().dropna()
        if not pdf_num.empty:
            corr_df = pdf_num.corr(method="pearson")
            for c1 in numeric_cols:
                corr_matrix[c1] = {}
                for c2 in numeric_cols:
                    val = corr_df.loc[c1, c2] if (c1 in corr_df.index and c2 in corr_df.columns) else 0.0
                    clean_val = 0.0 if (math.isnan(val) or math.isinf(val)) else round(float(val), 3)
                    corr_matrix[c1][c2] = clean_val
                    if c1 < c2 and abs(clean_val) >= 0.80:
                        multicollinearity_flags.append({
                            "col1": c1,
                            "col2": c2,
                            "r": clean_val,
                            "risk": "High Multicollinearity" if abs(clean_val) >= 0.90 else "Moderate Collinearity"
                        })

    # 2. Pairplot Sample Data (limit to top 4 numeric columns and 100 rows for high responsiveness)
    pairplot_cols = numeric_cols[:4]
    pairplot_data = []
    if pairplot_cols:
        sample_df = df.select(pairplot_cols).head(100).to_dicts()
        pairplot_data = sample_df

    # 3. Categorical Cardinality & Top Distributions
    cat_summaries = []
    for cat in categorical_cols[:6]:
        val_counts = df[cat].value_counts().head(5).to_dicts()
        cat_summaries.append({
            "column": cat,
            "cardinality": df[cat].n_unique(),
            "top_values": val_counts,
        })

    # 4. Distribution Skewness & Outliers (Tukey IQR)
    skewness_metrics = {}
    for num_col in numeric_cols[:8]:
        series = df[num_col].drop_nulls()
        if len(series) > 4:
            s_arr = series.to_numpy()
            q25, q75 = float(np.percentile(s_arr, 25)), float(np.percentile(s_arr, 75))
            iqr = q75 - q25
            lower_bound = q25 - 1.5 * iqr
            upper_bound = q75 + 1.5 * iqr
            outlier_count = int(np.sum((s_arr < lower_bound) | (s_arr > upper_bound)))
            mean_val = float(np.mean(s_arr))
            median_val = float(np.median(s_arr))
            std_val = float(np.std(s_arr))
            skew_val = float(stats.skew(s_arr)) if std_val > 0 else 0.0

            skewness_metrics[num_col] = {
                "mean": round(mean_val, 2),
                "median": round(median_val, 2),
                "std": round(std_val, 2),
                "skewness": round(skew_val, 2),
                "outlier_count": int(outlier_count),
                "outlier_pct": round(float((outlier_count / len(s_arr)) * 100), 1),
                "is_skewed": bool(abs(skew_val) > 1.0),
            }

    return {
        "dataset_name": record["filename"],
        "total_rows": len(df),
        "numeric_columns": numeric_cols,
        "categorical_columns": categorical_cols,
        "correlation_matrix": corr_matrix,
        "multicollinearity_flags": multicollinearity_flags,
        "pairplot_columns": pairplot_cols,
        "pairplot_data": pairplot_data,
        "categorical_summaries": cat_summaries,
        "skewness_metrics": skewness_metrics,
    }


@router.post("/{dataset_id}/hypothesis-test")
async def run_statistical_hypothesis_test(
    dataset_id: str,
    req: HypothesisTestRequest,
):
    """Execute hypothesis tests (Student's t-test, ANOVA, Chi-Square, Mann-Whitney) with plain-English takeaway."""
    record = _datasets_db.get(dataset_id)
    if not record:
        for r in _datasets_db.values():
            if r["content_hash"].startswith(dataset_id) or r["filename"] == dataset_id:
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

    if req.test_type in ("ttest", "mannwhitney"):
        # Requires numeric target_col and categorical group_col with 2 unique values
        if not req.group_col or req.group_col not in pdf.columns or req.target_col not in pdf.columns:
            raise HTTPException(status_code=400, detail="Target and grouping column required")

        clean_sub = pdf[[req.target_col, req.group_col]].dropna()
        groups = clean_sub[req.group_col].unique()
        if len(groups) < 2:
            raise HTTPException(status_code=400, detail=f"Grouping column '{req.group_col}' needs at least 2 distinct groups")

        g1_name, g2_name = str(groups[0]), str(groups[1])
        s1 = clean_sub[clean_sub[req.group_col] == groups[0]][req.target_col].astype(float)
        s2 = clean_sub[clean_sub[req.group_col] == groups[1]][req.target_col].astype(float)

        if len(s1) < 2 or len(s2) < 2:
            raise HTTPException(status_code=400, detail="Insufficient observations per group for hypothesis test")

        if req.test_type == "ttest":
            stat, p_val = stats.ttest_ind(s1, s2, equal_var=False)
            test_name = "Two-Sample Welch's t-test"
        else:
            stat, p_val = stats.mannwhitneyu(s1, s2)
            test_name = "Mann-Whitney U Test"

        is_sig = bool(p_val < 0.05)
        diff = float(s1.mean() - s2.mean())
        takeaway = (
            f"Statistically significant difference detected ({test_name}, statistic = {stat:.2f}, p = {p_val:.4g}). "
            f"Group '{g1_name}' (mean = {s1.mean():.2f}) is significantly {'higher' if diff > 0 else 'lower'} than '{g2_name}' (mean = {s2.mean():.2f})."
            if is_sig else
            f"No statistically significant difference detected ({test_name}, statistic = {stat:.2f}, p = {p_val:.4g}). "
            f"The mean difference between '{g1_name}' ({s1.mean():.2f}) and '{g2_name}' ({s2.mean():.2f}) could likely be due to random chance."
        )

        return {
            "test_name": test_name,
            "target_col": req.target_col,
            "group_col": req.group_col,
            "statistic": round(float(stat), 4),
            "p_value": float(p_val),
            "is_significant": bool(is_sig),
            "significance_level": "p < 0.05",
            "takeaway": takeaway,
            "group_summaries": [
                {"group": g1_name, "count": len(s1), "mean": round(float(s1.mean()), 2), "std": round(float(s1.std()), 2)},
                {"group": g2_name, "count": len(s2), "mean": round(float(s2.mean()), 2), "std": round(float(s2.std()), 2)},
            ]
        }

    elif req.test_type == "anova":
        if not req.group_col or req.group_col not in pdf.columns or req.target_col not in pdf.columns:
            raise HTTPException(status_code=400, detail="Target and grouping column required for ANOVA")

        clean_sub = pdf[[req.target_col, req.group_col]].dropna()
        groups = clean_sub[req.group_col].unique()
        group_series = [
            clean_sub[clean_sub[req.group_col] == g][req.target_col].astype(float)
            for g in groups if len(clean_sub[clean_sub[req.group_col] == g]) >= 2
        ]

        if len(group_series) < 2:
            raise HTTPException(status_code=400, detail="ANOVA requires at least 2 groups with >= 2 observations")

        stat, p_val = stats.f_oneway(*group_series)
        is_sig = bool(p_val < 0.05)
        takeaway = (
            f"One-Way ANOVA shows statistically significant variance across '{req.group_col}' categories (F = {stat:.2f}, p = {p_val:.4g}). "
            f"At least one category exhibits a systematically distinct mean for '{req.target_col}'."
            if is_sig else
            f"One-Way ANOVA indicates no significant difference across '{req.group_col}' categories (F = {stat:.2f}, p = {p_val:.4g})."
        )

        return {
            "test_name": "One-Way ANOVA (F-Test)",
            "target_col": req.target_col,
            "group_col": req.group_col,
            "statistic": round(float(stat), 4),
            "p_value": float(p_val),
            "is_significant": bool(is_sig),
            "takeaway": takeaway,
            "groups_tested": len(group_series),
        }

    elif req.test_type == "chi2":
        col2 = req.col2 or req.group_col
        if not col2 or req.target_col not in pdf.columns or col2 not in pdf.columns:
            raise HTTPException(status_code=400, detail="Two categorical columns required for Chi-Square test")

        contingency_table = pd.crosstab(pdf[req.target_col], pdf[col2])
        chi2_stat, p_val, dof, _ = stats.chi2_contingency(contingency_table)
        is_sig = bool(p_val < 0.05)
        takeaway = (
            f"Chi-Square test of independence reveals a statistically significant dependency between '{req.target_col}' and '{col2}' "
            f"(χ² = {chi2_stat:.2f}, df = {dof}, p = {p_val:.4g})."
            if is_sig else
            f"Chi-Square test indicates no significant association between '{req.target_col}' and '{col2}' (χ² = {chi2_stat:.2f}, p = {p_val:.4g}). "
            f"These variables appear independently distributed."
        )

        return {
            "test_name": "Chi-Square Test of Independence",
            "target_col": req.target_col,
            "col2": col2,
            "statistic": round(float(chi2_stat), 4),
            "degrees_of_freedom": int(dof),
            "p_value": float(p_val),
            "is_significant": bool(is_sig),
            "takeaway": takeaway,
        }

    raise HTTPException(status_code=400, detail=f"Unsupported test type '{req.test_type}'.")
