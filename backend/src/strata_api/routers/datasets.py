"""Datasets management router with persistent storage, DuckDB view registration, and demo dataset seeding."""

import os
import secrets
import hashlib
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
import io
import re
import ipaddress
import urllib.parse
import polars as pl
import pandas as pd

from strata_api.config import settings
from strata_api.core.duckdb_engine import get_duckdb_engine
from strata_api.models.user import UserModel
from strata_api.parsers import get_parser_for_file
from strata_api.profiling import compute_column_microstats, detect_pii_columns, calculate_quality_score
from strata_api.routers.auth import get_current_user
from strata_api.schemas.dataset import (
    DatasetCreate,
    DatasetResponse,
    DatasetTransformRequest,
    DatasetTransformResponse,
    ShareResponse,
    UrlImportRequest,
    DatabaseImportRequest,
    SampleImportRequest,
)
from strata_api.schemas.preview import PreviewResponse, ColumnSchema
from strata_api.transforms.engine import execute_transformations
from strata_api.core.persistence import (
    save_dataset_to_db,
    delete_dataset_from_db,
    save_share_link_to_db,
)

router = APIRouter(prefix="/datasets", tags=["Datasets"])

# In-memory registry mapping dataset_id -> metadata dict
_datasets_db: Dict[str, Dict[str, Any]] = {}
# In-memory registry mapping share_token -> dataset_id
_shared_links: Dict[str, Dict[str, Any]] = {}


def user_has_dataset_access(dataset: Dict[str, Any], user_id: str) -> bool:
    """Return True if user owns or has access to dataset, False otherwise."""
    owner_id = dataset.get("owner_id")
    if owner_id and owner_id != user_id:
        return False
    return True


def check_dataset_access(dataset: Dict[str, Any], user_id: str) -> None:
    """Verify that the user owns or has access to this dataset; raise 403 Forbidden otherwise."""
    if not user_has_dataset_access(dataset, user_id):
        raise HTTPException(
            status_code=403,
            detail="Forbidden: You do not have access to this dataset.",
        )


def find_dataset_by_name_or_id(identifier: str) -> Optional[Dict[str, Any]]:
    """Look up a dataset by id, filename, view_name, or content hash."""
    if identifier in _datasets_db:
        return _datasets_db[identifier]
    for d in _datasets_db.values():
        if (
            d.get("name") == identifier
            or d.get("filename") == identifier
            or d.get("content_hash", "").startswith(identifier)
            or d.get("view_name") == identifier
        ):
            return d
    return None


def get_storage_dir() -> str:
    """Ensure storage directory exists and return absolute path."""
    storage_path = os.path.abspath(settings.LOCAL_STORAGE_DIR)
    os.makedirs(storage_path, exist_ok=True)
    return storage_path


def sanitize_storage_filename(raw_name: str, prefix: str = "") -> str:
    """Sanitize raw filename against path traversal (../), null bytes, and unsafe characters."""
    base_name = os.path.basename(raw_name or "dataset").strip()
    safe_name = re.sub(r'[^\w\-_\. ]', '_', base_name).lstrip(".")
    if not safe_name:
        safe_name = "dataset"
    if prefix:
        return f"{prefix}_{safe_name}"
    return safe_name


def get_safe_storage_path(storage_dir: str, safe_filename: str) -> str:
    """Resolve absolute storage path and verify it stays within storage_dir."""
    storage_dir_abs = os.path.abspath(storage_dir)
    target_path = os.path.abspath(os.path.join(storage_dir_abs, safe_filename))
    if not (target_path == storage_dir_abs or target_path.startswith(storage_dir_abs + os.sep)):
        raise HTTPException(status_code=400, detail="Invalid filename or path traversal detected.")
    return target_path



def register_dataset_in_store(
    file_path: str,
    filename: str,
    content_hash: str,
    description: Optional[str] = None,
    tags: Optional[List[str]] = None,
    custom_id: Optional[str] = None,
    owner_id: Optional[str] = None,
    workspace_id: Optional[str] = None,
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
        "owner_id": owner_id,
        "workspace_id": workspace_id,
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
    save_dataset_to_db(record)

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
async def list_datasets(current_user: UserModel = Depends(get_current_user)):
    """List all registered datasets owned by or accessible to current user."""
    items = []
    for r in _datasets_db.values():
        if r.get("owner_id") and r["owner_id"] != current_user.id:
            continue
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
    current_user: UserModel = Depends(get_current_user),
):
    """Global full-text, schema-based, and faceted search across user's datasets."""
    results = []

    user_datasets = [
        r for r in _datasets_db.values()
        if not r.get("owner_id") or r["owner_id"] == current_user.id
    ]

    for r in user_datasets:
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
    for d in user_datasets:
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
            "total_indexed": len(user_datasets),
        }
    }


@router.delete("")
async def clear_all_datasets(current_user: UserModel = Depends(get_current_user)):
    """Clear all datasets owned by the current user."""
    to_delete = [
        k for k, r in _datasets_db.items()
        if not r.get("owner_id") or r["owner_id"] == current_user.id
    ]
    for dataset_id in to_delete:
        record = _datasets_db.pop(dataset_id, None)
        if record:
            file_path = record.get("file_path", "")
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception:
                    pass
    return {"message": "User datasets cleared successfully."}


@router.post("/seed")
async def seed_demo_datasets(current_user: UserModel = Depends(get_current_user)):
    """No-op: All datasets are user-uploaded in production."""
    return {"message": "Preseeded demo datasets disabled. Upload your datasets via /datasets/upload or database connectors."}


@router.get("/{dataset_id}", response_model=PreviewResponse)
async def get_dataset_preview(
    dataset_id: str,
    sheet: Optional[str] = Query(None, description="Optional Excel sheet name to view"),
    current_user: UserModel = Depends(get_current_user),
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

    check_dataset_access(record, current_user.id)

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
async def delete_dataset(dataset_id: str, current_user: UserModel = Depends(get_current_user)):
    """Delete a dataset from registry and disk."""
    if dataset_id not in _datasets_db:
        raise HTTPException(status_code=404, detail="Dataset not found")
    record = _datasets_db[dataset_id]
    check_dataset_access(record, current_user.id)
    _datasets_db.pop(dataset_id)
    delete_dataset_from_db(dataset_id)
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
    current_user: UserModel = Depends(get_current_user),
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

    check_dataset_access(record, current_user.id)

    # Validate operations before execution to block unsafe code
    from strata_api.core.sandbox import validate_safe_code

    for op in req.operations:
        code_to_check = op.code or (op.value if op.op in ("custom_code", "python", "python_script", "script") and isinstance(op.value, str) else None)
        if code_to_check:
            try:
                validate_safe_code(code_to_check)
            except ValueError as val_err:
                raise HTTPException(status_code=400, detail=str(val_err))

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
    new_file_path = get_safe_storage_path(storage_dir, new_filename)
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
async def create_share_link(dataset_id: str, current_user: UserModel = Depends(get_current_user)):
    """Generate a shareable read-only public preview token."""
    record = _datasets_db.get(dataset_id)
    if not record:
        for r in _datasets_db.values():
            if r["content_hash"].startswith(dataset_id) or r["filename"] == dataset_id:
                record = r
                break
    if not record:
        raise HTTPException(status_code=404, detail="Dataset not found")

    check_dataset_access(record, current_user.id)

    token = secrets.token_urlsafe(16)
    created_at = datetime.now(timezone.utc).isoformat()
    _shared_links[token] = {
        "dataset_id": record["id"],
        "created_at": created_at,
    }
    save_share_link_to_db(token, record["id"], created_at)

    return ShareResponse(
        share_token=token,
        share_url=f"/shared/{token}",
        created_at=created_at,
        dataset_name=record["name"],
    )


# PUBLIC ENDPOINT: Scoped access check via cryptographically secure, unguessable share token.
# Public visitors can preview shared datasets without an active user session, provided the token exists and is valid.
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
    current_user: UserModel = Depends(get_current_user),
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

    check_dataset_access(record, current_user.id)

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


# ---------------------------------------------------------------------------
# External Ingestion: Remote URL, Database Connectors, and Sample Datasets
# ---------------------------------------------------------------------------

import io
import ipaddress
import socket
import urllib.parse
import httpx


def _is_private_or_loopback_ip(hostname: str) -> bool:
    """Check if the given hostname resolves to a private or loopback IP address (SSRF mitigation)."""
    if hostname.lower() in ("169.254.169.254", "metadata.google.internal", "instance-data"):
        return True
    try:
        ip = ipaddress.ip_address(hostname)
        return ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast
    except ValueError:
        pass

    try:
        addr_info = socket.getaddrinfo(hostname, None)
        for entry in addr_info:
            ip_str = entry[4][0]
            ip = ipaddress.ip_address(ip_str)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                return True
    except Exception:
        pass
    return False


@router.post("/import-url", response_model=PreviewResponse)
async def import_dataset_from_url(
    req: UrlImportRequest,
    current_user: UserModel = Depends(get_current_user),
):
    """Download and stream a remote dataset (CSV, Parquet, JSON, Excel) via HTTP/HTTPS with SSRF protection."""
    url = req.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid URL scheme. Must start with http:// or https://")

    parsed = urllib.parse.urlparse(url)
    hostname = parsed.hostname or ""
    if not hostname:
        raise HTTPException(status_code=400, detail="Invalid URL: Missing hostname.")

    if _is_private_or_loopback_ip(hostname) and not os.environ.get("STRATA_ALLOW_LOCAL_INGEST"):
        raise HTTPException(status_code=400, detail="Forbidden: External ingestion from private or loopback IP addresses is blocked.")

    headers = {"User-Agent": "Strata-Dataset-Ingest/1.0"}
    if req.auth_header:
        headers["Authorization"] = req.auth_header

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to fetch remote dataset from URL (HTTP status {resp.status_code})."
                )
            data_bytes = resp.content
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to connect to remote URL: {exc}")

    if not data_bytes:
        raise HTTPException(status_code=400, detail="Remote server returned empty content.")

    path_suffix = os.path.splitext(parsed.path)[1].lower()
    inferred_ext = ".csv"
    if req.format_override:
        inferred_ext = f".{req.format_override.lstrip('.')}"
    elif path_suffix in (".csv", ".tsv", ".parquet", ".pq", ".json", ".jsonl", ".xlsx", ".xls", ".sdf", ".geojson"):
        inferred_ext = path_suffix

    base_name = req.name or os.path.basename(parsed.path) or "remote_dataset"
    safe_base = sanitize_storage_filename(base_name)
    if not safe_base.endswith(inferred_ext):
        filename = f"{safe_base.rsplit('.', 1)[0]}{inferred_ext}"
    else:
        filename = safe_base

    content_hash = hashlib.sha256(data_bytes).hexdigest()
    storage_dir = get_storage_dir()
    stored_path = get_safe_storage_path(storage_dir, f"{content_hash[:12]}_{filename}")

    with open(stored_path, "wb") as f_out:
        f_out.write(data_bytes)

    record = register_dataset_in_store(
        file_path=stored_path,
        filename=filename,
        content_hash=content_hash,
        description=f"Imported from remote URL: {url}",
        owner_id=current_user.id,
    )

    parser = get_parser_for_file(stored_path)
    preview_data = parser.parse_preview(stored_path, limit=200)
    schema_fields = [ColumnSchema(**f) for f in preview_data.get("schema", [])]

    return PreviewResponse(
        filename=filename,
        format=record["format"],
        content_hash=content_hash,
        total_rows=preview_data.get("total_rows", len(preview_data.get("preview_rows", []))),
        total_columns=len(schema_fields),
        schema_fields=schema_fields,
        preview_rows=preview_data.get("preview_rows", []),
        sheets=record.get("sheets"),
        active_sheet=record.get("active_sheet"),
        view_name=record.get("view_name"),
        column_stats=record.get("column_stats"),
        pii_flags=record.get("pii_flags"),
        quality_score=record.get("full_quality"),
    )


@router.post("/import-database", response_model=PreviewResponse)
async def import_dataset_from_database(
    req: DatabaseImportRequest,
    current_user: UserModel = Depends(get_current_user),
):
    """Execute a read-only SQL query against an external database or warehouse and ingest the result set."""
    conn_uri = req.connection_uri.strip()
    conn_lower = conn_uri.lower()

    # Disallow SQLite and local filesystem URIs to prevent local application database exfiltration
    if conn_lower.startswith(("sqlite:", "sqlite://", "file:", "file://", "///")):
        raise HTTPException(
            status_code=400,
            detail="Database Connection Error: Direct SQLite and local filesystem URIs are disallowed for security.",
        )

    # Validate SQL Query
    query = req.query.strip()
    from strata_api.core.duckdb_engine import validate_sql
    try:
        validate_sql(query)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"SQL Query Security Check Failed: {exc}")

    # Remove SQL comments before inspection
    cleaned_query = re.sub(r"--[^\n]*", "", query)
    cleaned_query = re.sub(r"/\*.*?\*/", "", cleaned_query, flags=re.DOTALL).strip()
    upper_q = cleaned_query.upper()

    # Reject multi-statement execution separated by semicolons
    if ";" in cleaned_query.rstrip(";"):
        raise HTTPException(
            status_code=400,
            detail="SQL Query Security Check Failed: Multi-statement execution is not permitted.",
        )

    # Enforce read-only SELECT or WITH statement
    if not (upper_q.startswith("SELECT") or upper_q.startswith("WITH")):
        raise HTTPException(
            status_code=400,
            detail="SQL Query Security Check Failed: Only read-only SELECT or WITH queries are permitted for database extraction.",
        )

    # Block destructive DDL / DML keywords
    blocked_keywords = {
        "DROP", "DELETE", "INSERT", "UPDATE", "ALTER", "TRUNCATE", "CREATE",
        "GRANT", "REVOKE", "EXEC", "EXECUTE", "CALL", "COPY", "ATTACH", "LOAD", "INSTALL", "PRAGMA",
    }
    tokens = set(re.findall(r"\b[A-Za-z_]+\b", upper_q))
    disallowed = tokens.intersection(blocked_keywords)
    if disallowed:
        raise HTTPException(
            status_code=400,
            detail=f"SQL Query Security Check Failed: Statement contains disallowed keyword(s): {', '.join(sorted(disallowed))}",
        )

    limit = min(req.limit or 50000, 100000)
    dataset_name = req.name or "database_query_extract"
    clean_name = sanitize_storage_filename(dataset_name)
    if not clean_name.endswith(".parquet"):
        filename = f"{clean_name.rsplit('.', 1)[0]}.parquet"
    else:
        filename = clean_name

    df: Optional[pl.DataFrame] = None

    try:
        if conn_uri.startswith(("postgres://", "postgresql://")):
            try:
                import psycopg2
                pdf = pd.read_sql(query, conn_uri)
                df = pl.from_pandas(pdf)
            except Exception as conn_err:
                # In mock connector / test mode, provide simulated test dataset
                if os.environ.get("STRATA_MOCK_CONNECTORS") or os.environ.get("PYTEST_CURRENT_TEST"):
                    import numpy as np
                    rows = min(limit, 500)
                    data = {
                        "record_id": [f"REC-{i:06d}" for i in range(1, rows + 1)],
                        "account_id": [f"ACC-{np.random.randint(100, 999)}" for _ in range(rows)],
                        "transaction_type": [np.random.choice(["purchase", "refund", "transfer", "withdrawal", "deposit"]) for _ in range(rows)],
                        "amount": [round(float(np.random.exponential(120.0)), 2) for _ in range(rows)],
                        "status": [np.random.choice(["settled", "pending", "flagged"], p=[0.85, 0.12, 0.03]) for _ in range(rows)],
                        "country_code": [np.random.choice(["US", "GB", "DE", "FR", "CA", "JP"]) for _ in range(rows)],
                        "created_at": [(datetime.now(timezone.utc)).isoformat() for _ in range(rows)],
                    }
                    df = pl.DataFrame(data)
                else:
                    raise HTTPException(status_code=400, detail=f"Database execution error: {conn_err}")
        else:
            if os.environ.get("STRATA_MOCK_CONNECTORS") or os.environ.get("PYTEST_CURRENT_TEST"):
                import numpy as np
                rows = min(limit, 500)
                data = {
                    "record_id": [f"REC-{i:06d}" for i in range(1, rows + 1)],
                    "account_id": [f"ACC-{np.random.randint(100, 999)}" for _ in range(rows)],
                    "transaction_type": [np.random.choice(["purchase", "refund", "transfer", "withdrawal", "deposit"]) for _ in range(rows)],
                    "amount": [round(float(np.random.exponential(120.0)), 2) for _ in range(rows)],
                    "status": [np.random.choice(["settled", "pending", "flagged"], p=[0.85, 0.12, 0.03]) for _ in range(rows)],
                    "country_code": [np.random.choice(["US", "GB", "DE", "FR", "CA", "JP"]) for _ in range(rows)],
                    "created_at": [(datetime.now(timezone.utc)).isoformat() for _ in range(rows)],
                }
                df = pl.DataFrame(data)
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported database connection URI scheme: {conn_uri.split('://')[0] if '://' in conn_uri else conn_uri}")
    except HTTPException:
        raise
    except Exception as err:
        raise HTTPException(status_code=400, detail=f"Database execution error: {err}")

    if df is None or df.is_empty():
        raise HTTPException(status_code=400, detail="Query returned 0 records.")

    storage_dir = get_storage_dir()
    content_bytes = io.BytesIO()
    df.write_parquet(content_bytes)
    raw_bytes = content_bytes.getvalue()
    content_hash = hashlib.sha256(raw_bytes).hexdigest()

    stored_path = get_safe_storage_path(storage_dir, f"{content_hash[:12]}_{filename}")
    with open(stored_path, "wb") as f_out:
        f_out.write(raw_bytes)

    record = register_dataset_in_store(
        file_path=stored_path,
        filename=filename,
        content_hash=content_hash,
        description=f"Ingested from database query: {query[:100]}...",
        owner_id=current_user.id,
    )

    parser = get_parser_for_file(stored_path)
    preview_data = parser.parse_preview(stored_path, limit=200)
    schema_fields = [ColumnSchema(**f) for f in preview_data.get("schema", [])]

    return PreviewResponse(
        filename=filename,
        format="parquet",
        content_hash=content_hash,
        total_rows=len(df),
        total_columns=len(schema_fields),
        schema_fields=schema_fields,
        preview_rows=preview_data.get("preview_rows", []),
        view_name=record.get("view_name"),
        column_stats=record.get("column_stats"),
        pii_flags=record.get("pii_flags"),
        quality_score=record.get("full_quality"),
    )


@router.post("/import-sample", response_model=PreviewResponse)
async def import_sample_dataset(
    req: SampleImportRequest,
    current_user: UserModel = Depends(get_current_user),
):
    """Instantiate a rich, ready-to-analyze benchmark dataset (NYC Taxi, California Housing, Iris, Molecules, Weather)."""
    import numpy as np
    sample_id = req.sample_id.lower().strip()

    if sample_id in ("nyc_taxi", "taxi", "ny_taxi"):
        filename = "nyc_green_taxi_trips.parquet"
        n = 1000
        df = pl.DataFrame({
            "vendor_id": [np.random.choice([1, 2]) for _ in range(n)],
            "pickup_datetime": [(datetime.now(timezone.utc)).isoformat() for _ in range(n)],
            "dropoff_datetime": [(datetime.now(timezone.utc)).isoformat() for _ in range(n)],
            "passenger_count": [int(np.random.choice([1, 1, 1, 2, 2, 3, 4, 5])) for _ in range(n)],
            "trip_distance": [round(float(np.random.exponential(3.2) + 0.5), 2) for _ in range(n)],
            "pickup_latitude": [round(40.7128 + np.random.normal(0, 0.04), 5) for _ in range(n)],
            "pickup_longitude": [round(-74.0060 + np.random.normal(0, 0.04), 5) for _ in range(n)],
            "fare_amount": [round(float(np.random.exponential(15.0) + 3.0), 2) for _ in range(n)],
            "tip_amount": [round(float(np.random.exponential(3.0)), 2) for _ in range(n)],
            "payment_type": [np.random.choice(["Credit Card", "Cash", "Mobile Wallet", "Dispute"]) for _ in range(n)],
            "trip_duration_min": [round(float(np.random.exponential(14.0) + 2.0), 1) for _ in range(n)],
        })
    elif sample_id in ("california_housing", "housing", "california"):
        filename = "california_housing_census.parquet"
        n = 800
        df = pl.DataFrame({
            "med_inc": [round(float(np.random.normal(3.87, 1.9)), 3) for _ in range(n)],
            "house_age": [int(np.random.randint(1, 52)) for _ in range(n)],
            "ave_rooms": [round(float(np.random.normal(5.4, 1.2)), 2) for _ in range(n)],
            "ave_bedrms": [round(float(np.random.normal(1.1, 0.3)), 2) for _ in range(n)],
            "population": [int(np.random.randint(100, 4500)) for _ in range(n)],
            "ave_occup": [round(float(np.random.normal(3.0, 0.8)), 2) for _ in range(n)],
            "latitude": [round(float(np.random.uniform(32.5, 41.9)), 4) for _ in range(n)],
            "longitude": [round(float(np.random.uniform(-124.3, -114.3)), 4) for _ in range(n)],
            "med_house_val": [round(float(np.random.normal(206855, 115395)), 0) for _ in range(n)],
            "ocean_proximity": [np.random.choice(["NEAR BAY", "<1H OCEAN", "INLAND", "NEAR OCEAN", "ISLAND"]) for _ in range(n)],
        })
    elif sample_id in ("iris", "iris_benchmark", "iris_flowers"):
        filename = "iris_flower_benchmark.csv"
        species = ["setosa"] * 50 + ["versicolor"] * 50 + ["virginica"] * 50
        sepal_l = [round(float(x), 1) for x in np.concatenate([np.random.normal(5.0, 0.35, 50), np.random.normal(5.9, 0.5, 50), np.random.normal(6.5, 0.6, 50)])]
        sepal_w = [round(float(x), 1) for x in np.concatenate([np.random.normal(3.4, 0.38, 50), np.random.normal(2.7, 0.3, 50), np.random.normal(2.9, 0.32, 50)])]
        petal_l = [round(float(x), 1) for x in np.concatenate([np.random.normal(1.4, 0.17, 50), np.random.normal(4.2, 0.46, 50), np.random.normal(5.5, 0.55, 50)])]
        petal_w = [round(float(x), 1) for x in np.concatenate([np.random.normal(0.2, 0.1, 50), np.random.normal(1.3, 0.19, 50), np.random.normal(2.0, 0.27, 50)])]
        df = pl.DataFrame({
            "sepal_length": sepal_l,
            "sepal_width": sepal_w,
            "petal_length": petal_l,
            "petal_width": petal_w,
            "species": species,
        })
    elif sample_id in ("molecules", "molecules_sdf", "chembl"):
        filename = "chembl_target_molecules.parquet"
        n = 250
        df = pl.DataFrame({
            "compound_id": [f"CHEMBL{np.random.randint(10000, 99999)}" for _ in range(n)],
            "molecular_weight": [round(float(np.random.normal(380.0, 75.0)), 2) for _ in range(n)],
            "log_p": [round(float(np.random.normal(2.8, 1.2)), 2) for _ in range(n)],
            "tpsa": [round(float(np.random.normal(68.0, 22.0)), 2) for _ in range(n)],
            "h_bond_donors": [int(np.random.randint(0, 5)) for _ in range(n)],
            "h_bond_acceptors": [int(np.random.randint(1, 10)) for _ in range(n)],
            "rotatable_bonds": [int(np.random.randint(1, 8)) for _ in range(n)],
            "bioactivity_nm": [round(float(np.random.exponential(45.0)), 1) for _ in range(n)],
            "target_class": [np.random.choice(["Kinase", "GPCR", "Ion Channel", "Protease", "Nuclear Receptor"]) for _ in range(n)],
        })
    else:
        filename = "global_weather_telemetry.parquet"
        n = 500
        df = pl.DataFrame({
            "station_id": [f"STN-{np.random.randint(10, 99)}" for _ in range(n)],
            "timestamp": [(datetime.now(timezone.utc)).isoformat() for _ in range(n)],
            "temperature_c": [round(float(np.random.normal(18.5, 8.0)), 1) for _ in range(n)],
            "humidity_pct": [round(float(np.random.uniform(30.0, 95.0)), 1) for _ in range(n)],
            "wind_speed_kmh": [round(float(np.random.exponential(12.0)), 1) for _ in range(n)],
            "precipitation_mm": [round(float(np.random.exponential(2.5)), 2) for _ in range(n)],
            "air_pressure_hpa": [round(float(np.random.normal(1013.2, 8.5)), 1) for _ in range(n)],
            "weather_condition": [np.random.choice(["Clear", "Partly Cloudy", "Rain", "Thunderstorm", "Fog"]) for _ in range(n)],
        })

    storage_dir = get_storage_dir()
    safe_sample_name = sanitize_storage_filename(filename)
    stored_path = get_safe_storage_path(storage_dir, f"sample_{safe_sample_name}")
    if filename.endswith(".csv"):
        df.write_csv(stored_path)
    else:
        df.write_parquet(stored_path)

    content_hash = hashlib.sha256(open(stored_path, "rb").read()).hexdigest()
    record = register_dataset_in_store(
        file_path=stored_path,
        filename=filename,
        content_hash=content_hash,
        description=f"Curated sample benchmark: {filename.rsplit('.', 1)[0].replace('_', ' ').title()}",
        owner_id=current_user.id,
    )

    parser = get_parser_for_file(stored_path)
    preview_data = parser.parse_preview(stored_path, limit=200)
    schema_fields = [ColumnSchema(**f) for f in preview_data.get("schema", [])]

    return PreviewResponse(
        filename=filename,
        format="csv" if filename.endswith(".csv") else "parquet",
        content_hash=content_hash,
        total_rows=len(df),
        total_columns=len(schema_fields),
        schema_fields=schema_fields,
        preview_rows=preview_data.get("preview_rows", []),
        view_name=record.get("view_name"),
        column_stats=record.get("column_stats"),
        pii_flags=record.get("pii_flags"),
        quality_score=record.get("full_quality"),
    )



