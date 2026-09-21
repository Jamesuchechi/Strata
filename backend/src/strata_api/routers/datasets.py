"""Datasets management router."""

from typing import List
from fastapi import APIRouter
from strata_api.schemas.dataset import DatasetCreate, DatasetResponse

router = APIRouter(prefix="/datasets", tags=["Datasets"])

# In-memory registry for initial Phase 0/1 development
_datasets_db = {}


@router.get("", response_model=List[DatasetResponse])
async def list_datasets():
    """List all registered datasets."""
    return list(_datasets_db.values())


@router.post("", response_model=DatasetResponse)
async def create_dataset(payload: DatasetCreate):
    """Register a new tracked dataset."""
    record = DatasetResponse(
        name=payload.name,
        description=payload.description,
        tags=payload.tags,
        latest_version=None,
        version_count=0,
    )
    _datasets_db[payload.name] = record
    return record
