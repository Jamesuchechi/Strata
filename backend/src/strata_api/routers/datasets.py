"""Datasets management router with persistent storage, DuckDB view registration, and demo dataset seeding."""

import os
import hashlib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
import polars as pl
import pandas as pd

from strata_api.config import settings
from strata_api.core.duckdb_engine import get_duckdb_engine
from strata_api.parsers import get_parser_for_file
from strata_api.profiling import compute_column_microstats, detect_pii_columns, calculate_quality_score
from strata_api.schemas.dataset import DatasetCreate, DatasetResponse
from strata_api.schemas.preview import PreviewResponse, ColumnSchema

router = APIRouter(prefix="/datasets", tags=["Datasets"])

# In-memory registry mapping dataset_id -> metadata dict
_datasets_db: Dict[str, Dict[str, Any]] = {}


def get_storage_dir() -> str:
    """Ensure storage directory exists and return absolute path."""
    storage_path = os.path.abspath(settings.LOCAL_STORAGE_DIR)
    os.makedirs(storage_path, exist_ok=True)
    return storage_path


def register_dataset_in_store(
    file_path: str,
    filename: str,
    content_hash: str,
    description: Optional[str] = None,
    tags: Optional[List[str]] = None,
    custom_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Parse dataset file, register with DuckDB, and track in _datasets_db."""
    dataset_id = custom_id or content_hash[:12]
    view_name = f"view_{dataset_id}"

    parser = get_parser_for_file(file_path)
    preview_data = parser.parse_preview(file_path, limit=200)

    # Register with DuckDB
    duckdb_engine = get_duckdb_engine()
    try:
        duckdb_engine.register_file(view_name, file_path)
    except Exception as e:
        print(f"Warning: DuckDB view registration failed for {filename}: {e}")

    # Compute microstats and quality score
    column_stats = []
    pii_flags = {}
    quality_score = None
    if preview_data.get("preview_rows"):
        try:
            df = pl.DataFrame(preview_data["preview_rows"])
            column_stats = compute_column_microstats(df)
            pii_flags = detect_pii_columns(preview_data["preview_rows"])
            quality_score = calculate_quality_score(column_stats, pii_flags)
        except Exception:
            pass

    size_bytes = os.path.getsize(file_path) if os.path.exists(file_path) else 0

    record = {
        "id": dataset_id,
        "name": filename.rsplit(".", 1)[0].replace("_", " ").title(),
        "filename": filename,
        "file_path": file_path,
        "description": description or f"Tabular dataset loaded from {filename}",
        "tags": tags or [preview_data.get("format", "data")],
        "format": preview_data.get("format", "unknown"),
        "content_hash": content_hash,
        "view_name": view_name,
        "total_rows": preview_data.get("total_rows", len(preview_data.get("preview_rows", []))),
        "total_columns": preview_data.get("total_columns", len(preview_data.get("schema", []))),
        "size_bytes": size_bytes,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "quality_score": quality_score.get("overall_score") if quality_score else 92,
        "latest_version": "v1.0.0",
        "version_count": 1,
        # Preview details cached for detail view
        "schema_fields": preview_data.get("schema", []),
        "preview_rows": preview_data.get("preview_rows", []),
        "sheets": preview_data.get("sheets"),
        "active_sheet": preview_data.get("active_sheet"),
        "column_stats": column_stats,
        "pii_flags": pii_flags,
        "full_quality": quality_score,
    }

    _datasets_db[dataset_id] = record

    # Track in immutable version DAG
    try:
        from strata_api.versioning.registry import record_commit
        record_commit(
            version_hash=content_hash,
            dataset_name=filename,
            version_tag="v1.0.0",
            message=f"Initial ingestion and DuckDB registration of {filename}",
            author="System Ingest",
            delta_rows=f"+{record['total_rows']:,} rows",
            delta_columns=f"+{record['total_columns']} cols",
            added_cols=[f["name"] for f in preview_data.get("schema", [])],
        )
    except Exception as err:
        print(f"Warning: Version tracking record failed: {err}")

    return record


def seed_default_datasets_if_needed():
    """Seed 3 initial datasets if registry is empty."""
    if _datasets_db:
        return

    storage_dir = get_storage_dir()

    # 1. Customer Churn CSV
    churn_path = os.path.join(storage_dir, "customer_churn.csv")
    if not os.path.exists(churn_path):
        churn_df = pl.DataFrame({
            "customer_id": [f"CUST-{1000 + i}" for i in range(25)],
            "customer_name": [
                "Alice Johnson", "Bob Smith", "Charlie Davis", "Diana Prince", "Evan Wright",
                "Fiona Gallagher", "George Clark", "Hannah Abbott", "Ian Malcolm", "Julia Roberts",
                "Kevin Bacon", "Laura Croft", "Michael Scott", "Nora Jones", "Oscar Martinez",
                "Pam Beesly", "Quentin Tarantino", "Rachel Green", "Steve Rogers", "Tony Stark",
                "Uma Thurman", "Victor Stone", "Wanda Maximoff", "Xavier Charles", "Yvonne Strahovski"
            ],
            "email": [f"user_{i}@company.com" for i in range(25)],
            "country": [
                "United States", "Germany", "United Kingdom", "Canada", "France",
                "Japan", "Australia", "Brazil", "Netherlands", "United States",
                "Sweden", "Canada", "United States", "Germany", "United States",
                "United States", "United Kingdom", "United States", "United States", "United States",
                "France", "United States", "Sokovia", "United States", "Australia"
            ],
            "tenure_months": [12, 3, 45, 8, 60, 24, 18, 5, 36, 48, 15, 2, 54, 30, 42, 65, 9, 21, 72, 80, 14, 11, 28, 90, 33],
            "monthly_charges": [65.5, 89.2, 45.0, 110.4, 75.8, 55.2, 95.0, 70.3, 85.5, 62.0, 78.4, 105.0, 50.5, 82.1, 91.0, 64.2, 99.9, 74.5, 115.0, 120.0, 88.0, 68.5, 102.5, 49.0, 84.0],
            "total_spend": [786.0, 267.6, 2025.0, 883.2, 4548.0, 1324.8, 1710.0, 351.5, 3078.0, 2976.0, 1176.0, 210.0, 2727.0, 2463.0, 3822.0, 4173.0, 899.1, 1564.5, 8280.0, 9600.0, 1232.0, 753.5, 2870.0, 4410.0, 2772.0],
            "churn_probability": [0.12, 0.78, 0.05, 0.65, 0.08, 0.22, 0.45, 0.81, 0.15, 0.10, 0.38, 0.89, 0.07, 0.29, 0.19, 0.04, 0.71, 0.33, 0.02, 0.01, 0.42, 0.58, 0.61, 0.03, 0.25],
            "churned": ["No", "Yes", "No", "Yes", "No", "No", "No", "Yes", "No", "No", "No", "Yes", "No", "No", "No", "No", "Yes", "No", "No", "No", "No", "Yes", "Yes", "No", "No"]
        })
        churn_df.write_csv(churn_path)
    
    churn_hash = hashlib.sha256(open(churn_path, "rb").read()).hexdigest()
    register_dataset_in_store(
        file_path=churn_path,
        filename="customer_churn.csv",
        content_hash=churn_hash,
        description="Subscription churn metrics, customer lifetime values, and churn probability predictions.",
        tags=["csv", "marketing", "churn", "saas"],
        custom_id="churn_demo",
    )

    # 2. Financial Projections Multi-Sheet Excel
    fin_path = os.path.join(storage_dir, "financial_projections.xlsx")
    if not os.path.exists(fin_path):
        with pd.ExcelWriter(fin_path, engine="openpyxl") as writer:
            df_q1 = pd.DataFrame({
                "Month": ["January", "February", "March"],
                "Gross_Revenue": [124000, 142000, 158000],
                "Cost_of_Goods": [34000, 38000, 41000],
                "Operating_Expenses": [45000, 47000, 49000],
                "Net_Operating_Income": [45000, 57000, 68000],
                "EBITDA_Margin": [0.36, 0.40, 0.43],
            })
            df_q1.to_excel(writer, sheet_name="Q1_Forecast", index=False)

            df_annual = pd.DataFrame({
                "Fiscal_Year": [2024, 2025, 2026, 2027],
                "Projected_ARR": [1850000, 3400000, 6200000, 11500000],
                "YoY_Growth_Pct": [0.85, 0.84, 0.82, 0.85],
                "Headcount": [18, 34, 58, 95],
                "Burn_Multiple": [1.4, 1.1, 0.8, 0.4],
            })
            df_annual.to_excel(writer, sheet_name="Annual_Strategy", index=False)

    fin_hash = hashlib.sha256(open(fin_path, "rb").read()).hexdigest()
    register_dataset_in_store(
        file_path=fin_path,
        filename="financial_projections.xlsx",
        content_hash=fin_hash,
        description="Multi-sheet strategic financial projections, Q1 forecast, and 4-year SaaS expansion model.",
        tags=["excel", "finance", "forecast", "executive"],
        custom_id="finance_demo",
    )

    # 3. Genomic Variant Frequencies Parquet
    gen_path = os.path.join(storage_dir, "genomic_variants.parquet")
    if not os.path.exists(gen_path):
        gen_df = pl.DataFrame({
            "variant_id": [f"rs{200000 + i}" for i in range(20)],
            "chromosome": [f"chr{(i % 22) + 1}" for i in range(20)],
            "position": [1004500 + (i * 12345) for i in range(20)],
            "gene_symbol": ["BRCA1", "TP53", "EGFR", "KRAS", "BRAF", "PIK3CA", "PTEN", "MYC", "APC", "HER2", "BRCA2", "ATM", "CHEK2", "PALB2", "RAD51D", "CDH1", "STK11", "SMAD4", "VHL", "RB1"],
            "allele_frequency": [0.0012, 0.045, 0.12, 0.003, 0.28, 0.015, 0.089, 0.33, 0.004, 0.18, 0.02, 0.06, 0.01, 0.005, 0.015, 0.04, 0.002, 0.09, 0.03, 0.01],
            "clinical_significance": ["Pathogenic", "Benign", "Likely Pathogenic", "Uncertain", "Pathogenic", "Benign", "Likely Benign", "Benign", "Pathogenic", "Pathogenic", "Likely Pathogenic", "Uncertain", "Pathogenic", "Benign", "Likely Pathogenic", "Benign", "Pathogenic", "Uncertain", "Pathogenic", "Benign"],
            "read_depth": [120, 450, 310, 890, 240, 670, 520, 390, 480, 720, 610, 340, 810, 290, 430, 550, 680, 410, 530, 760]
        })
        gen_df.write_parquet(gen_path)

    gen_hash = hashlib.sha256(open(gen_path, "rb").read()).hexdigest()
    register_dataset_in_store(
        file_path=gen_path,
        filename="genomic_variants.parquet",
        content_hash=gen_hash,
        description="High-throughput genomic sequencing variant frequencies with clinical annotations.",
        tags=["parquet", "genomics", "bioinformatics", "clinical"],
        custom_id="genomic_demo",
    )


@router.get("", response_model=List[DatasetResponse])
async def list_datasets():
    """List all registered and seeded datasets."""
    seed_default_datasets_if_needed()
    items = []
    for r in _datasets_db.values():
        items.append(DatasetResponse(
            id=r["id"],
            name=r["name"],
            filename=r["filename"],
            description=r.get("description"),
            tags=r.get("tags", []),
            format=r.get("format", "unknown"),
            content_hash=r.get("content_hash", ""),
            view_name=r.get("view_name"),
            total_rows=r.get("total_rows", 0),
            total_columns=r.get("total_columns", 0),
            size_bytes=r.get("size_bytes", 0),
            created_at=r.get("created_at"),
            quality_score=r.get("quality_score"),
            latest_version=r.get("latest_version", "v1.0.0"),
            version_count=r.get("version_count", 1),
        ))
    return items


@router.get("/{dataset_id}", response_model=PreviewResponse)
async def get_dataset_preview(
    dataset_id: str,
    sheet: Optional[str] = Query(None, description="Optional Excel sheet name to view"),
):
    """Retrieve full preview, virtual rows, schema, and column micro-stats for a dataset."""
    seed_default_datasets_if_needed()

    record = _datasets_db.get(dataset_id)
    if not record:
        # Check by content_hash prefix or filename
        for r in _datasets_db.values():
            if r["content_hash"].startswith(dataset_id) or r["filename"] == dataset_id:
                record = r
                break

    if not record:
        raise HTTPException(status_code=404, detail=f"Dataset with ID '{dataset_id}' not found.")

    file_path = record.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Underlying storage file missing.")

    parser = get_parser_for_file(file_path)

    # Handle Excel sheet switching
    if sheet and record["format"] == "excel":
        from strata_api.parsers.excel import ExcelParser
        if isinstance(parser, ExcelParser):
            sheet_data = parser.parse_sheet(file_path, sheet_name=sheet, limit=200)
            df = pl.DataFrame(sheet_data["preview_rows"]) if sheet_data["preview_rows"] else pl.DataFrame()
            col_stats = compute_column_microstats(df) if not df.is_empty() else []
            pii = detect_pii_columns(sheet_data["preview_rows"]) if sheet_data["preview_rows"] else {}
            q_score = calculate_quality_score(col_stats, pii) if col_stats else None

            # Register sheet in DuckDB as view_{id}_{sheet}
            try:
                sheet_view = f"{record['view_name']}_{sheet.replace(' ', '_').lower()}"
                duckdb_engine = get_duckdb_engine()
                duckdb_engine.register_df(sheet_view, pd.DataFrame(sheet_data["preview_rows"]))
            except Exception:
                pass

            schema_fields = [ColumnSchema(**f) for f in sheet_data.get("schema", [])]
            return PreviewResponse(
                filename=record["filename"],
                format="excel",
                content_hash=record["content_hash"],
                total_rows=len(sheet_data["preview_rows"]),
                total_columns=len(schema_fields),
                schema_fields=schema_fields,
                preview_rows=sheet_data.get("preview_rows", []),
                sheets=record.get("sheets"),
                active_sheet=sheet,
                view_name=record.get("view_name"),
                column_stats=col_stats,
                pii_flags=pii,
                quality_score=q_score,
            )

    # Standard preview
    preview_data = parser.parse_preview(file_path, limit=200)
    schema_fields = [ColumnSchema(**f) for f in preview_data.get("schema", [])]
    
    col_stats = record.get("column_stats")
    pii = record.get("pii_flags")
    q_score = record.get("full_quality")

    if not col_stats and preview_data.get("preview_rows"):
        try:
            df = pl.DataFrame(preview_data["preview_rows"])
            col_stats = compute_column_microstats(df)
            pii = detect_pii_columns(preview_data["preview_rows"])
            q_score = calculate_quality_score(col_stats, pii)
        except Exception:
            pass

    return PreviewResponse(
        filename=record["filename"],
        format=record["format"],
        content_hash=record["content_hash"],
        total_rows=preview_data.get("total_rows", len(preview_data.get("preview_rows", []))),
        total_columns=len(schema_fields),
        schema_fields=schema_fields,
        preview_rows=preview_data.get("preview_rows", []),
        sheets=preview_data.get("sheets"),
        active_sheet=preview_data.get("active_sheet"),
        view_name=record.get("view_name"),
        column_stats=col_stats,
        pii_flags=pii,
        quality_score=q_score,
    )


@router.delete("/{dataset_id}")
async def delete_dataset(dataset_id: str):
    """Delete a dataset from registry and disk."""
    if dataset_id not in _datasets_db:
        raise HTTPException(status_code=404, detail="Dataset not found")
    record = _datasets_db.pop(dataset_id)
    if os.path.exists(record.get("file_path", "")):
        try:
            os.remove(record["file_path"])
        except Exception:
            pass
    return {"message": f"Dataset {dataset_id} deleted successfully"}
