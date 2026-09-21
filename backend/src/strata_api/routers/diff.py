"""Dataset diffing router."""

from fastapi import APIRouter
from strata_api.versioning.diff import compute_schema_diff
from strata_api.schemas.diff import DiffRequest, DiffResponse

router = APIRouter(prefix="/diff", tags=["Diff"])


@router.post("", response_model=DiffResponse)
async def diff_versions(req: DiffRequest):
    """Compute structural and statistical diff between two dataset versions."""
    # Stub schemas for demonstration / initial API integration
    diff_result = compute_schema_diff([], [])
    return DiffResponse(
        dataset_name=req.dataset_name,
        v1_hash=req.v1_hash,
        v2_hash=req.v2_hash,
        schema_diff=diff_result,
        row_count_delta=0,
        column_count_delta=0,
    )
