from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query

from strata_api.models.user import UserModel
from strata_api.routers.auth import get_current_user
from strata_api.routers.datasets import check_dataset_access, find_dataset_by_name_or_id
from strata_api.versioning.branches import (
    list_branches,
    get_active_branch,
    checkout_branch,
    create_branch,
    delete_branch,
    compute_three_way_merge,
    execute_merge,
    compute_blame,
)

router = APIRouter(prefix="/branches", tags=["Branching & Merging"])


class CreateBranchRequest(BaseModel):
    dataset_name: str = Field(..., description="Dataset name to branch")
    branch_name: str = Field(..., description="Name for the new branch")
    from_commit_or_branch: Optional[str] = Field(None, description="Starting branch or commit hash")
    description: Optional[str] = Field(None, description="Purpose of this feature branch")
    author: Optional[str] = Field("James Uchechi", description="Author creating the branch")


class CheckoutBranchRequest(BaseModel):
    dataset_name: str
    branch_name: str


class MergeBranchRequest(BaseModel):
    dataset_name: str
    target_branch: str = "main"
    source_branch: str
    strategy: str = Field("auto", description="Strategy: auto, ours, theirs, union")
    resolutions: Optional[Dict[str, str]] = Field(None, description="Manual per-column resolution map")
    author: Optional[str] = "James Uchechi"
    message: Optional[str] = None


@router.get("")
async def get_branches(
    dataset_name: Optional[str] = Query(None, description="Target dataset name"),
    current_user: UserModel = Depends(get_current_user),
):
    """List all branches for a dataset, indicating active branch and head commit info."""
    if not dataset_name:
        return {
            "dataset_name": "",
            "active_branch": "main",
            "branches": [],
            "total_branches": 0,
        }
    ds = find_dataset_by_name_or_id(dataset_name)
    if ds:
        check_dataset_access(ds, current_user.id)
    try:
        branches = list_branches(dataset_name)
        active = get_active_branch(dataset_name)
        return {
            "dataset_name": dataset_name,
            "active_branch": active,
            "branches": branches,
            "total_branches": len(branches),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("")
async def create_new_branch(
    req: CreateBranchRequest,
    current_user: UserModel = Depends(get_current_user),
):
    """Create a new Git-style branch for isolated experimentation or transformation."""
    ds = find_dataset_by_name_or_id(req.dataset_name)
    if ds:
        check_dataset_access(ds, current_user.id)
    try:
        b = create_branch(
            dataset_name=req.dataset_name,
            branch_name=req.branch_name,
            from_commit_or_branch=req.from_commit_or_branch,
            author=req.author or current_user.full_name,
            description=req.description,
        )
        return {"message": f"Branch '{req.branch_name}' created successfully", "branch": b}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.post("/checkout")
async def checkout_active_branch(
    req: CheckoutBranchRequest,
    current_user: UserModel = Depends(get_current_user),
):
    """Switch active working branch for dataset."""
    ds = find_dataset_by_name_or_id(req.dataset_name)
    if ds:
        check_dataset_access(ds, current_user.id)
    try:
        b = checkout_branch(req.dataset_name, req.branch_name)
        return {"message": f"Switched to branch '{req.branch_name}'", "active_branch": b}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.delete("/{branch_name:path}")
async def delete_existing_branch(
    branch_name: str,
    dataset_name: str = Query(..., description="Target dataset name"),
    current_user: UserModel = Depends(get_current_user),
):
    """Delete a non-default branch."""
    ds = find_dataset_by_name_or_id(dataset_name)
    if ds:
        check_dataset_access(ds, current_user.id)
    try:
        delete_branch(dataset_name, branch_name)
        return {"message": f"Branch '{branch_name}' deleted"}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.get("/compare")
async def compare_branches(
    target_branch: str = Query("main", description="Target branch (ours)"),
    source_branch: str = Query("staging", description="Source branch to merge in (theirs)"),
    dataset_name: str = Query(..., description="Dataset name"),
    current_user: UserModel = Depends(get_current_user),
):
    """Preview 3-way merge between target and source branches against their Lowest Common Ancestor (LCA).
    Detects clean auto-mergeable column additions as well as schema conflicts."""
    ds = find_dataset_by_name_or_id(dataset_name)
    if ds:
        check_dataset_access(ds, current_user.id)
    try:
        comparison = compute_three_way_merge(
            dataset_name=dataset_name,
            target_branch=target_branch,
            source_branch=source_branch,
        )
        return comparison
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.post("/merge")
async def merge_branches(
    req: MergeBranchRequest,
    current_user: UserModel = Depends(get_current_user),
):
    """Execute 3-way merge from source into target branch, producing an immutable merge commit."""
    ds = find_dataset_by_name_or_id(req.dataset_name)
    if ds:
        check_dataset_access(ds, current_user.id)
    try:
        result = execute_merge(
            dataset_name=req.dataset_name,
            target_branch=req.target_branch,
            source_branch=req.source_branch,
            strategy=req.strategy,
            resolutions=req.resolutions,
            author=req.author or current_user.full_name,
            message=req.message,
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


@router.get("/blame")
async def get_dataset_blame(
    dataset_name: Optional[str] = Query(None, description="Dataset name"),
    commit_id: Optional[str] = Query(None, description="Optional target commit hash"),
    current_user: UserModel = Depends(get_current_user),
):
    """Retrieve column-level and row-level attribution history (who introduced what, when, and in which commit)."""
    if not dataset_name:
        return {
            "dataset_name": "",
            "total_rows_analyzed": 0,
            "total_columns_analyzed": 0,
            "column_blame": [],
            "row_sample_blame": [],
        }
    ds = find_dataset_by_name_or_id(dataset_name)
    if ds:
        check_dataset_access(ds, current_user.id)
    try:
        blame_data = compute_blame(dataset_name, commit_id)
        return blame_data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
