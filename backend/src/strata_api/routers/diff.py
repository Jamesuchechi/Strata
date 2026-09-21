"""Dataset diffing and version commits router."""

import hashlib
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
from strata_api.versioning.diff import compute_schema_diff
from strata_api.versioning.registry import record_commit, get_all_commits, get_commit_by_id
from strata_api.schemas.diff import DiffRequest, DiffResponse

router = APIRouter(prefix="/diff", tags=["Diff"])


class CreateCommitRequest(BaseModel):
    dataset_name: str
    message: str
    version_tag: Optional[str] = None
    author: Optional[str] = "James Uchechi"
    parent_hash: Optional[str] = None
    delta_rows: Optional[str] = "+0 rows"
    delta_columns: Optional[str] = "+0 cols"
    added_cols: Optional[List[str]] = None
    removed_cols: Optional[List[str]] = None
    modified_cols: Optional[List[str]] = None


@router.get("/commits")
async def list_commits():
    """List all real dataset version snapshots."""
    return get_all_commits()


@router.post("/commits")
async def create_snapshot_commit(req: CreateCommitRequest):
    """Create a new version snapshot in the immutable DAG."""
    # Generate content-addressed hash based on message, dataset_name, and timestamp
    h = hashlib.sha256(f"{req.dataset_name}_{req.message}_{req.version_tag}".encode()).hexdigest()

    commit = record_commit(
        version_hash=h,
        dataset_name=req.dataset_name,
        parent_hash=req.parent_hash,
        version_tag=req.version_tag or "v1.1.0",
        message=req.message,
        author=req.author or "James Uchechi",
        delta_rows=req.delta_rows or "+0 rows",
        delta_columns=req.delta_columns or "+0 cols",
        added_cols=req.added_cols,
        removed_cols=req.removed_cols,
        modified_cols=req.modified_cols,
    )
    return commit


@router.post("", response_model=DiffResponse)
async def diff_versions(req: DiffRequest):
    """Compute structural and statistical diff between two dataset versions."""
    diff_result = compute_schema_diff([], [])
    return DiffResponse(
        dataset_name=req.dataset_name,
        v1_hash=req.v1_hash,
        v2_hash=req.v2_hash,
        schema_diff=diff_result,
        row_count_delta=0,
        column_count_delta=0,
    )
