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
    """No-op: Sample seeding is disabled in production."""
    return {"message": "Sample datasets are disabled. Upload your datasets via /datasets/upload or connectors.", "seeded_datasets": []}
