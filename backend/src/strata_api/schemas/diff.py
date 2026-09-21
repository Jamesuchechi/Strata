"""Diffing request and response schemas."""

from typing import Any, Dict, List
from pydantic import BaseModel


class DiffRequest(BaseModel):
    dataset_name: str
    v1_hash: str
    v2_hash: str


class DiffResponse(BaseModel):
    dataset_name: str
    v1_hash: str
    v2_hash: str
    schema_diff: Dict[str, Any]
    row_count_delta: int = 0
    column_count_delta: int = 0
