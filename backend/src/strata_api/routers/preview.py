"""Instant preview router for multi-format datasets with persistent storage and DuckDB view registration."""

import os
import shutil
from typing import Optional
from fastapi import APIRouter, File, UploadFile, HTTPException, Query
import polars as pl
from strata_api.parsers import get_parser_for_file
from strata_api.versioning.hashing import compute_content_hash
from strata_api.profiling import compute_column_microstats, detect_pii_columns, calculate_quality_score
from strata_api.core.duckdb_engine import get_duckdb_engine
from strata_api.schemas.preview import PreviewResponse, ColumnSchema
from strata_api.routers.datasets import get_storage_dir, register_dataset_in_store

router = APIRouter(prefix="/preview", tags=["Preview"])


@router.post("", response_model=PreviewResponse)
async def preview_uploaded_file(
    file: UploadFile = File(...),
    sheet: Optional[str] = Query(None, description="Optional Excel sheet to parse")
):
    """Upload any dataset file (CSV, Excel, Parquet, JSON, SDF) and receive instant schema, virtual rows, stats, and PII checks."""
    filename = file.filename or "uploaded_dataset"
    suffix = os.path.splitext(filename)[1]

    # Compute content hash
    content_hash = compute_content_hash(file.file)

    storage_dir = get_storage_dir()
    stored_path = os.path.join(storage_dir, f"{content_hash[:12]}_{filename}")

    # Reset cursor and save persistently to storage_dir
    file.file.seek(0)
    with open(stored_path, "wb") as f_out:
        shutil.copyfileobj(file.file, f_out)

    try:
        # Register in central datasets registry and duckdb
        record = register_dataset_in_store(
            file_path=stored_path,
            filename=filename,
            content_hash=content_hash,
            description=f"Uploaded {filename} via Universal Previewer",
        )

        parser = get_parser_for_file(stored_path)

        # Handle specific Excel sheet if specified
        if sheet and record["format"] == "excel":
            from strata_api.parsers.excel import ExcelParser
            if isinstance(parser, ExcelParser):
                sheet_data = parser.parse_sheet(stored_path, sheet_name=sheet, limit=200)
                df = pl.DataFrame(sheet_data["preview_rows"]) if sheet_data["preview_rows"] else pl.DataFrame()
                col_stats = compute_column_microstats(df) if not df.is_empty() else []
                pii = detect_pii_columns(sheet_data["preview_rows"]) if sheet_data["preview_rows"] else {}
                q_score = calculate_quality_score(col_stats, pii) if col_stats else None

                schema_fields = [ColumnSchema(**f) for f in sheet_data.get("schema", [])]
                return PreviewResponse(
                    filename=filename,
                    format="excel",
                    content_hash=content_hash,
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

        schema_fields = [ColumnSchema(**f) for f in record["schema_fields"]]

        return PreviewResponse(
            filename=filename,
            format=record["format"],
            content_hash=content_hash,
            total_rows=record["total_rows"],
            total_columns=record["total_columns"],
            schema_fields=schema_fields,
            preview_rows=record["preview_rows"],
            sheets=record.get("sheets"),
            active_sheet=record.get("active_sheet"),
            view_name=record.get("view_name"),
            column_stats=record.get("column_stats"),
            pii_flags=record.get("pii_flags"),
            quality_score=record.get("full_quality"),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")
