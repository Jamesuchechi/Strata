"""Billing and Onboarding router: Plan tiers, storage quota tracking, and domain sample datasets."""

import os
import hashlib
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
import polars as pl

from strata_api.routers.datasets import (
    _datasets_db,
    get_storage_dir,
    register_dataset_in_store,
)

router = APIRouter(prefix="/billing", tags=["Billing & Plans"])

# Billing state
_billing_state = {
    "current_plan": "Community Free",
    "tier": "free",
    "price_per_month": 0,
    "storage_limit_bytes": 5 * 1024 * 1024 * 1024,  # 5 GB
    "dataset_limit": 10,
    "ai_queries_limit": 1000,
    "ai_queries_used": 142,
    "compute_hours_limit": 20,
    "compute_hours_used": 3.8,
    "auto_ml_models_limit": 10,
    "auto_ml_models_used": 4,
    "next_billing_date": "2026-10-01",
}


@router.get("/usage")
async def get_usage_and_plan():
    """Retrieve active plan details, storage consumption, dataset count, and compute quotas."""
    total_bytes = sum(d.get("size_bytes", 0) for d in _datasets_db.values())
    dataset_count = len(_datasets_db)

    storage_pct = round((total_bytes / _billing_state["storage_limit_bytes"]) * 100, 2)
    dataset_pct = round((dataset_count / _billing_state["dataset_limit"]) * 100, 2)

    return {
        **_billing_state,
        "storage_used_bytes": total_bytes,
        "storage_used_mb": round(total_bytes / (1024 * 1024), 2),
        "storage_limit_mb": round(_billing_state["storage_limit_bytes"] / (1024 * 1024), 2),
        "storage_percentage": min(100.0, storage_pct),
        "datasets_count": dataset_count,
        "datasets_percentage": min(100.0, dataset_pct),
        "tiers_available": [
            {
                "id": "free",
                "name": "Community Free",
                "price": "$0",
                "billing_period": "forever",
                "features": [
                    "5 GB High-Performance Storage",
                    "Up to 10 Datasets",
                    "Sub-second DuckDB WASM SQL",
                    "Standard AutoML (LightGBM / Random Forest)",
                    "1,000 AI Analyst Queries / month",
                    "Immutable Git Versioning DAG",
                ],
                "is_current": _billing_state["tier"] == "free",
            },
            {
                "id": "pro",
                "name": "Pro Researcher",
                "price": "$29",
                "billing_period": "per user / month",
                "features": [
                    "100 GB High-Performance Storage",
                    "Unlimited Datasets & Tables",
                    "Priority GPU Cloud Runners",
                    "Full Automated Hypotheses Testing & SHAP",
                    "Unlimited AI Analyst Execution",
                    "Team Workspaces & Role-Based Access Control",
                    "Exportable PDF/Markdown Audit Reports",
                ],
                "is_current": _billing_state["tier"] == "pro",
            },
            {
                "id": "team",
                "name": "Enterprise Scale",
                "price": "Custom",
                "billing_period": "annual contract",
                "features": [
                    "Unlimited Dedicated S3 / GCS Storage",
                    "SOC 2 Type II & HIPAA Compliance",
                    "SAML 2.0 / Okta SSO & SCIM",
                    "Private VPC & On-Premises Runners",
                    "Dedicated Solutions Engineer & 99.99% SLA",
                ],
                "is_current": False,
            },
        ],
    }


class UpgradePlanRequest(BaseModel):
    tier: str  # "pro" or "free"


@router.post("/upgrade")
async def upgrade_plan(req: UpgradePlanRequest):
    """Simulate upgrading or changing plan tier."""
    if req.tier == "pro":
        _billing_state["current_plan"] = "Pro Researcher"
        _billing_state["tier"] = "pro"
        _billing_state["price_per_month"] = 29
        _billing_state["storage_limit_bytes"] = 100 * 1024 * 1024 * 1024  # 100 GB
        _billing_state["dataset_limit"] = 1000
        _billing_state["ai_queries_limit"] = 100000
        _billing_state["compute_hours_limit"] = 200
        _billing_state["auto_ml_models_limit"] = 500
        return {"message": "Successfully upgraded to Pro Researcher plan!", "plan": _billing_state}
    elif req.tier == "free":
        _billing_state["current_plan"] = "Community Free"
        _billing_state["tier"] = "free"
        _billing_state["price_per_month"] = 0
        _billing_state["storage_limit_bytes"] = 5 * 1024 * 1024 * 1024
        _billing_state["dataset_limit"] = 10
        return {"message": "Downgraded to Community Free plan.", "plan": _billing_state}
    else:
        raise HTTPException(status_code=400, detail="Unknown tier")


@router.post("/seed-samples")
async def seed_domain_sample_datasets():
    """Seed comprehensive domain datasets (Finance, Healthcare, E-Commerce, Bioinformatics, Geospatial)."""
    storage_dir = get_storage_dir()
    seeded = []

    # 1. E-Commerce Customer Analytics CSV
    ecom_path = os.path.join(storage_dir, "ecommerce_rfm_segments.csv")
    if not os.path.exists(ecom_path):
        ecom_df = pl.DataFrame({
            "customer_id": [f"USR-{2000 + i}" for i in range(30)],
            "frequency_purchases": [1, 5, 12, 3, 22, 8, 15, 2, 9, 31, 4, 18, 7, 11, 26, 6, 14, 2, 19, 28, 5, 8, 16, 3, 21, 10, 13, 1, 24, 17],
            "monetary_value": [45.0, 280.5, 1420.0, 110.0, 3950.0, 680.0, 1890.0, 95.0, 820.0, 5100.0, 210.0, 2350.0, 590.0, 1180.0, 4200.0, 490.0, 1640.0, 85.0, 2600.0, 4800.0, 390.0, 720.0, 1950.0, 130.0, 3450.0, 940.0, 1320.0, 50.0, 3800.0, 2100.0],
            "recency_days": [180, 25, 4, 90, 2, 14, 7, 120, 18, 1, 65, 5, 30, 12, 3, 40, 9, 150, 6, 2, 45, 20, 8, 110, 4, 16, 11, 200, 3, 7],
            "rfm_segment": ["Lost", "Loyal", "Champions", "At Risk", "Champions", "Potential", "Champions", "Lost", "Loyal", "Champions", "At Risk", "Champions", "Potential", "Loyal", "Champions", "Potential", "Champions", "Lost", "Champions", "Champions", "Potential", "Loyal", "Champions", "At Risk", "Champions", "Loyal", "Loyal", "Lost", "Champions", "Champions"],
            "lifetime_margin_pct": [0.18, 0.32, 0.45, 0.22, 0.51, 0.35, 0.42, 0.15, 0.38, 0.54, 0.25, 0.48, 0.30, 0.39, 0.52, 0.28, 0.44, 0.16, 0.49, 0.53, 0.29, 0.36, 0.46, 0.20, 0.50, 0.37, 0.40, 0.14, 0.51, 0.47]
        })
        ecom_df.write_csv(ecom_path)
    
    ecom_hash = hashlib.sha256(open(ecom_path, "rb").read()).hexdigest()
    r1 = register_dataset_in_store(
        file_path=ecom_path,
        filename="ecommerce_rfm_segments.csv",
        content_hash=ecom_hash,
        description="Customer Recency, Frequency, and Monetary (RFM) segmentation benchmark for behavioral retention.",
        tags=["csv", "ecommerce", "rfm", "marketing", "sample"],
        custom_id="ecom_rfm_sample",
    )
    seeded.append(r1["name"])

    # 2. Clinical Trial Biomarkers Parquet
    bio_path = os.path.join(storage_dir, "clinical_biomarkers.parquet")
    if not os.path.exists(bio_path):
        bio_df = pl.DataFrame({
            "subject_id": [f"SUBJ-{500 + i}" for i in range(25)],
            "cohort": ["Control", "Treatment A", "Treatment B", "Treatment A", "Treatment B"] * 5,
            "biomarker_alpha_pg_ml": [12.4, 45.8, 62.1, 48.2, 59.9, 14.1, 51.0, 68.4, 44.5, 63.2, 11.9, 49.3, 65.7, 46.8, 61.4, 13.5, 47.1, 64.0, 43.9, 66.8, 12.8, 52.4, 69.1, 45.0, 60.5],
            "systolic_bp": [120, 118, 115, 122, 114, 121, 119, 116, 120, 113, 124, 117, 115, 121, 112, 119, 118, 114, 122, 115, 123, 116, 113, 120, 114],
            "response_status": ["Non-Responder", "Partial", "Complete", "Partial", "Complete", "Non-Responder", "Complete", "Complete", "Partial", "Complete", "Non-Responder", "Partial", "Complete", "Partial", "Complete", "Non-Responder", "Partial", "Complete", "Partial", "Complete", "Non-Responder", "Complete", "Complete", "Partial", "Complete"],
            "adverse_events_count": [0, 1, 0, 2, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1]
        })
        bio_df.write_parquet(bio_path)

    bio_hash = hashlib.sha256(open(bio_path, "rb").read()).hexdigest()
    r2 = register_dataset_in_store(
        file_path=bio_path,
        filename="clinical_biomarkers.parquet",
        content_hash=bio_hash,
        description="Phase II double-blind clinical biomarker cohort response and adverse event telemetry.",
        tags=["parquet", "healthcare", "clinical", "biomarkers", "sample"],
        custom_id="clinical_sample",
    )
    seeded.append(r2["name"])

    return {"message": "Domain sample datasets initialized successfully", "seeded_datasets": seeded}
