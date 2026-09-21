"""Instant preview router for multi-format datasets."""

import os
import shutil
import tempfile
from fastapi import APIRouter, File, UploadFile, HTTPException
import polars as pl
from strata_api.parsers import get_parser_for_file
from strata_api.versioning.hashing import compute_content_hash
from strata_api.profiling import compute_column_microstats, detect_pii_columns, calculate_quality_score
from strata_api.core.duckdb_engine import get_duckdb_engine
from strata_api.schemas.preview import PreviewResponse, ColumnSchema

router = APIRouter(prefix="/preview", tags=["Preview"])


@router.post("", response_model=PreviewResponse)
async def preview_uploaded_file(file: UploadFile = File(...)):
    """Upload any dataset file and receive instant schema, virtual rows, stats, and PII checks."""
    filename = file.filename or "uploaded_dataset"
    suffix = os.path.splitext(filename)[1]

    # Compute content hash
    content_hash = compute_content_hash(file.file)

    # Save to temp location for parsing and DuckDB registration
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        parser = get_parser_for_file(tmp_path)
        preview_data = parser.parse_preview(tmp_path, limit=200)

        # Register with DuckDB for instant SQL querying if tabular
        duckdb_engine = get_duckdb_engine()
        view_name = f"view_{content_hash[:12]}"
        try:
            duckdb_engine.register_file(view_name, tmp_path)
        except Exception:
            pass  # Fallback if non-standard format

        # Micro-statistics
        column_stats = []
        pii_flags = {}
        quality_score = None

        if preview_data["preview_rows"]:
            try:
                df = pl.DataFrame(preview_data["preview_rows"])
                column_stats = compute_column_microstats(df)
                pii_flags = detect_pii_columns(preview_data["preview_rows"])
                quality_score = calculate_quality_score(column_stats, pii_flags)
            except Exception:
                pass

        schema_fields = [ColumnSchema(**f) for f in preview_data.get("schema", [])]

        return PreviewResponse(
            filename=filename,
            format=preview_data.get("format", "unknown"),
            content_hash=content_hash,
            total_rows=preview_data.get("total_rows", len(preview_data["preview_rows"])),
            total_columns=len(schema_fields),
            schema_fields=schema_fields,
            preview_rows=preview_data.get("preview_rows", []),
            sheets=preview_data.get("sheets"),
            column_stats=column_stats,
            pii_flags=pii_flags,
            quality_score=quality_score,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
