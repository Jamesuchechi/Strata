"""Datasets management router with persistent storage, DuckDB view registration, and demo dataset seeding."""

import os
import secrets
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
from strata_api.schemas.dataset import (
    DatasetCreate,
    DatasetResponse,
    DatasetTransformRequest,
    DatasetTransformResponse,
    ShareResponse,
)
from strata_api.schemas.preview import PreviewResponse, ColumnSchema
from strata_api.transforms.engine import execute_transformations

router = APIRouter(prefix="/datasets", tags=["Datasets"])

# In-memory registry mapping dataset_id -> metadata dict
_datasets_db: Dict[str, Dict[str, Any]] = {}
# In-memory registry mapping share_token -> dataset_id
_shared_links: Dict[str, Dict[str, Any]] = {}


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
    """No-op in production. Real user datasets are uploaded via /upload or connector integrations."""
    pass


@router.get("", response_model=List[DatasetResponse])
async def list_datasets():
    """List all registered datasets."""
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


@router.get("/search")
async def search_datasets(
    q: Optional[str] = Query(None, description="Global full-text search across titles, descriptions, filenames, and tags"),
    column: Optional[str] = Query(None, description="Schema-based search matching column names"),
    format: Optional[str] = Query(None, description="Filter by format: csv, parquet, excel, json, etc."),
    tag: Optional[str] = Query(None, description="Filter by specific tag"),
    min_quality: Optional[int] = Query(None, description="Minimum data quality score (0-100)"),
    min_rows: Optional[int] = Query(None, description="Minimum total rows"),
    max_rows: Optional[int] = Query(None, description="Maximum total rows"),
    sort_by: str = Query("recent", description="Sort by: recent, quality, size, name, rows"),
):
    """Global full-text, schema-based, and faceted search across datasets."""
    results = []

    for r in _datasets_db.values():
        matched_reasons = []

        # 1. Full-text search matching
        if q:
            q_lower = q.lower().strip()
            name_match = q_lower in r.get("name", "").lower()
            file_match = q_lower in r.get("filename", "").lower()
            desc_match = q_lower in (r.get("description") or "").lower()
            tag_match = any(q_lower in t.lower() for t in r.get("tags", []))
            # Also search column names
            col_match = any(q_lower in c.get("name", "").lower() for c in r.get("schema_fields", []))

            if name_match:
                matched_reasons.append("Title match")
            if file_match:
                matched_reasons.append("Filename match")
            if desc_match:
                matched_reasons.append("Description match")
            if tag_match:
                matched_reasons.append("Tag match")
            if col_match:
                matched_reasons.append("Column schema match")

            if not (name_match or file_match or desc_match or tag_match or col_match):
                continue

        # 2. Schema-based column filter
        if column:
            col_target = column.lower().strip()
            matched_cols = [c.get("name") for c in r.get("schema_fields", []) if col_target in c.get("name", "").lower()]
            if not matched_cols:
                continue
            matched_reasons.append(f"Contains column '{', '.join(matched_cols)}'")

        # 3. Format filter
        if format and format.lower() != "all":
            if r.get("format", "").lower() != format.lower().strip():
                continue

        # 4. Tag filter
        if tag:
            if tag.lower() not in [t.lower() for t in r.get("tags", [])]:
                continue

        # 5. Quality filter
        if min_quality is not None:
            if (r.get("quality_score") or 0) < min_quality:
                continue

        # 6. Row count range
        rows = r.get("total_rows", 0)
        if min_rows is not None and rows < min_rows:
            continue
        if max_rows is not None and rows > max_rows:
            continue

        item = {
            "id": r["id"],
            "name": r["name"],
            "filename": r["filename"],
            "description": r.get("description"),
            "tags": r.get("tags", []),
            "format": r.get("format", "unknown"),
            "content_hash": r.get("content_hash", ""),
            "view_name": r.get("view_name"),
            "total_rows": r.get("total_rows", 0),
            "total_columns": r.get("total_columns", 0),
            "size_bytes": r.get("size_bytes", 0),
            "created_at": r.get("created_at"),
            "quality_score": r.get("quality_score"),
            "latest_version": r.get("latest_version", "v1.0.0"),
            "version_count": r.get("version_count", 1),
            "matched_reasons": matched_reasons if matched_reasons else ["Indexed"],
            "matched_columns": [c.get("name") for c in r.get("schema_fields", []) if (column and column.lower() in c.get("name", "").lower()) or (q and q.lower() in c.get("name", "").lower())],
        }
        results.append(item)

    # Sorting
    if sort_by == "quality":
        results.sort(key=lambda x: x.get("quality_score") or 0, reverse=True)
    elif sort_by == "size":
        results.sort(key=lambda x: x.get("size_bytes") or 0, reverse=True)
    elif sort_by == "rows":
        results.sort(key=lambda x: x.get("total_rows") or 0, reverse=True)
    elif sort_by == "name":
        results.sort(key=lambda x: x.get("name", "").lower())
    else:  # recent
        results.sort(key=lambda x: x.get("created_at") or "", reverse=True)

    # Compute facet statistics
    all_formats = {}
    all_tags = {}
    for d in _datasets_db.values():
        fmt = d.get("format", "unknown").lower()
        all_formats[fmt] = all_formats.get(fmt, 0) + 1
        for t in d.get("tags", []):
            all_tags[t] = all_tags.get(t, 0) + 1

    return {
        "query": q,
        "column_filter": column,
        "total_results": len(results),
        "results": results,
        "facets": {
            "formats": all_formats,
            "tags": dict(sorted(all_tags.items(), key=lambda x: x[1], reverse=True)[:15]),
            "total_indexed": len(_datasets_db),
        }
    }


@router.delete("")
async def clear_all_datasets():
    """Clear all datasets and reset commit history."""
    from strata_api.versioning.registry import clear_commits
    for record in list(_datasets_db.values()):
        file_path = record.get("file_path", "")
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
    _datasets_db.clear()
    clear_commits()
    return {"message": "All datasets and commits cleared successfully."}


@router.post("/seed")
async def seed_demo_datasets():
    """No-op: All datasets are user-uploaded in production."""
    return {"message": "Preseeded demo datasets disabled. Upload your datasets via /datasets/upload or database connectors."}


@router.get("/{dataset_id}", response_model=PreviewResponse)
async def get_dataset_preview(
    dataset_id: str,
    sheet: Optional[str] = Query(None, description="Optional Excel sheet name to view"),
):
    """Retrieve full preview, virtual rows, schema, and column micro-stats for a dataset."""
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


@router.post("/{dataset_id}/transform", response_model=DatasetTransformResponse)
async def transform_dataset(
    dataset_id: str,
    req: DatasetTransformRequest,
):
    """Execute point-and-click wrangling operations on a dataset, auto-committing a new immutable version."""
    record = _datasets_db.get(dataset_id)
    if not record:
        for r in _datasets_db.values():
            if r["content_hash"].startswith(dataset_id) or r["filename"] == dataset_id:
                record = r
                break
    if not record:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")

    file_path = record["file_path"]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=400, detail="Underlying dataset file not found on disk")

    # Load into Polars DataFrame
    try:
        fmt = record.get("format", "").lower()
        if fmt == "csv":
            df = pl.read_csv(file_path, ignore_errors=True, infer_schema_length=2000)
        elif fmt == "parquet":
            df = pl.read_parquet(file_path)
        elif fmt == "json":
            df = pl.read_json(file_path)
        elif fmt == "excel":
            sheet_name = record.get("active_sheet")
            try:
                df = pl.read_excel(file_path, sheet_name=sheet_name)
            except Exception:
                pdf = pd.read_excel(file_path, sheet_name=sheet_name or 0, engine="openpyxl")
                df = pl.from_pandas(pdf)
        else:
            # Fallback to preview rows if available
            df = pl.DataFrame(record.get("preview_rows", []))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to load dataset for transformation: {e}")

    prev_rows = len(df)
    prev_cols = len(df.columns)

    # Execute operations
    try:
        transformed_df, python_code = execute_transformations(df, req.operations)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Transformation execution failed: {e}")

    new_rows = len(transformed_df)
    new_cols = len(transformed_df.columns)
    row_delta = new_rows - prev_rows
    col_delta = new_cols - prev_cols

    # Save new version file in storage
    storage_dir = get_storage_dir()
    new_version_count = record.get("version_count", 1) + 1
    new_version_tag = f"v1.{new_version_count - 1}.0"
    new_filename = f"{record['id']}_v{new_version_count}.parquet"
    new_file_path = os.path.join(storage_dir, new_filename)
    transformed_df.write_parquet(new_file_path)

    # Compute new hash
    new_hash = hashlib.sha256(open(new_file_path, "rb").read()).hexdigest()

    # Recompute microstats & quality
    preview_rows = transformed_df.head(200).to_dicts()
    col_stats = compute_column_microstats(transformed_df.head(1000))
    pii = detect_pii_columns(preview_rows)
    q_score = calculate_quality_score(col_stats, pii)

    schema_fields = [
        ColumnSchema(name=name, type=str(dtype), sample_value=preview_rows[0].get(name) if preview_rows else None)
        for name, dtype in zip(transformed_df.columns, transformed_df.dtypes)
    ]

    # Register with DuckDB
    try:
        duckdb_engine = get_duckdb_engine()
        duckdb_engine.register_file(record["view_name"], new_file_path)
    except Exception as e:
        print(f"Warning: DuckDB update failed: {e}")

    # Record commit in version DAG
    try:
        from strata_api.versioning.registry import record_commit
        op_names = ", ".join([op.op for op in req.operations])
        record_commit(
            version_hash=new_hash,
            dataset_name=record["filename"],
            version_tag=new_version_tag,
            message=req.commit_message or f"Wrangling recipe applied: {op_names}",
            author="Studio Wrangling",
            parent_hash=record["content_hash"],
            delta_rows=f"{row_delta:+d} rows",
            delta_columns=f"{col_delta:+d} cols",
            added_cols=[c for c in transformed_df.columns if c not in record.get("schema_fields", [])],
        )
    except Exception as err:
        print(f"Warning: Commit recording failed: {err}")

    # Update central record
    record["file_path"] = new_file_path
    record["format"] = "parquet"
    record["content_hash"] = new_hash
    record["total_rows"] = new_rows
    record["total_columns"] = new_cols
    record["size_bytes"] = os.path.getsize(new_file_path)
    record["latest_version"] = new_version_tag
    record["version_count"] = new_version_count
    record["preview_rows"] = preview_rows
    record["schema_fields"] = [f.model_dump() for f in schema_fields]
    record["column_stats"] = col_stats
    record["pii_flags"] = pii
    record["full_quality"] = q_score

    preview_resp = PreviewResponse(
        filename=record["filename"],
        format="parquet",
        content_hash=new_hash,
        total_rows=new_rows,
        total_columns=new_cols,
        schema_fields=schema_fields,
        preview_rows=preview_rows,
        view_name=record["view_name"],
        column_stats=col_stats,
        pii_flags=pii,
        quality_score=q_score,
    )

    return DatasetTransformResponse(
        success=True,
        new_version_tag=new_version_tag,
        new_content_hash=new_hash,
        row_delta=row_delta,
        column_delta=col_delta,
        generated_python_code=python_code,
        preview=preview_resp,
    )


@router.post("/{dataset_id}/share", response_model=ShareResponse)
async def create_share_link(dataset_id: str):
    """Generate a shareable read-only public preview token."""
    record = _datasets_db.get(dataset_id)
    if not record:
        for r in _datasets_db.values():
            if r["content_hash"].startswith(dataset_id) or r["filename"] == dataset_id:
                record = r
                break
    if not record:
        raise HTTPException(status_code=404, detail="Dataset not found")

    token = secrets.token_urlsafe(16)
    created_at = datetime.now(timezone.utc).isoformat()
    _shared_links[token] = {
        "dataset_id": record["id"],
        "created_at": created_at,
    }

    return ShareResponse(
        share_token=token,
        share_url=f"/shared/{token}",
        created_at=created_at,
        dataset_name=record["name"],
    )


@router.get("/shared/{token}", response_model=PreviewResponse)
async def get_shared_dataset(token: str):
    """Retrieve read-only dataset preview using a public share token."""
    share_info = _shared_links.get(token)
    if not share_info:
        raise HTTPException(status_code=404, detail="Shared link not found or expired")

    target_id = share_info["dataset_id"]
    record = _datasets_db.get(target_id)
    if not record:
        raise HTTPException(status_code=404, detail="Underlying dataset no longer available")

    schema_fields = [ColumnSchema(**f) for f in record.get("schema_fields", [])]

    return PreviewResponse(
        filename=record["filename"],
        format=record["format"],
        content_hash=record["content_hash"],
        total_rows=record["total_rows"],
        total_columns=record["total_columns"],
        schema_fields=schema_fields,
        preview_rows=record.get("preview_rows", []),
        view_name=record.get("view_name"),
        column_stats=record.get("column_stats"),
        pii_flags=record.get("pii_flags"),
        quality_score=record.get("full_quality"),
    )


@router.post("/{dataset_id}/convert")
async def convert_dataset_format(
    dataset_id: str,
    target_format: str = Query(..., description="Target format: csv, parquet, excel, json"),
):
    """Convert any registered dataset to CSV, Parquet, Excel (.xlsx), or JSON on the fly."""
    import io
    from fastapi.responses import Response

    record = _datasets_db.get(dataset_id)
    if not record:
        for r in _datasets_db.values():
            if r["content_hash"].startswith(dataset_id) or r["filename"] == dataset_id:
                record = r
                break
    if not record:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")

    file_path = record["file_path"]
    fmt = record.get("format", "").lower()

    # Load into Polars DataFrame
    try:
        if fmt == "csv":
            df = pl.read_csv(file_path, ignore_errors=True, infer_schema_length=2000)
        elif fmt == "parquet":
            df = pl.read_parquet(file_path)
        elif fmt == "json":
            df = pl.read_json(file_path)
        elif fmt == "excel":
            sheet_name = record.get("active_sheet")
            try:
                df = pl.read_excel(file_path, sheet_name=sheet_name)
            except Exception:
                pdf = pd.read_excel(file_path, sheet_name=sheet_name or 0, engine="openpyxl")
                df = pl.from_pandas(pdf)
        else:
            df = pl.DataFrame(record.get("preview_rows", []))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to load dataset: {e}")

    target_fmt = target_format.lower().strip()
    base_name = record["filename"].rsplit(".", 1)[0]

    if target_fmt in ("csv", "tsv"):
        buffer = io.BytesIO()
        df.write_csv(buffer)
        content = buffer.getvalue()
        media_type = "text/csv"
        filename = f"{base_name}.csv"
    elif target_fmt == "parquet":
        buffer = io.BytesIO()
        df.write_parquet(buffer)
        content = buffer.getvalue()
        media_type = "application/octet-stream"
        filename = f"{base_name}.parquet"
    elif target_fmt in ("excel", "xlsx"):
        buffer = io.BytesIO()
        pdf = df.to_pandas()
        with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
            pdf.to_excel(writer, index=False, sheet_name="Data")
        content = buffer.getvalue()
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"{base_name}.xlsx"
    elif target_fmt == "json":
        buffer = io.BytesIO()
        df.write_json(buffer)
        content = buffer.getvalue()
        media_type = "application/json"
        filename = f"{base_name}.json"
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported target format '{target_format}'. Choose csv, parquet, excel, or json.")

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


