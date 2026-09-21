"""Dataset management schemas."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class DatasetCreate(BaseModel):
    name: str
    description: Optional[str] = None
    tags: List[str] = []


class DatasetResponse(BaseModel):
    id: str
    name: str
    filename: str
    description: Optional[str] = None
    tags: List[str] = []
    format: str
    content_hash: str
    view_name: Optional[str] = None
    total_rows: int = 0
    total_columns: int = 0
    size_bytes: int = 0
    created_at: Optional[str] = None
    quality_score: Optional[int] = None
    latest_version: Optional[str] = "v1.0.0"
    version_count: int = 1


class TransformOperation(BaseModel):
    op: str  # "drop_nulls", "fill_null", "trim_whitespace", "drop_duplicates", "cast_type", "filter_rows"
    column: Optional[str] = None
    columns: Optional[List[str]] = None
    strategy: Optional[str] = None  # "mean", "median", "mode", "zero", "forward", "custom"
    value: Optional[Any] = None
    target_type: Optional[str] = None  # "Int64", "Float64", "String", "Boolean"
    operator: Optional[str] = None  # ">", "<", "==", "!=", ">=", "<="


class DatasetTransformRequest(BaseModel):
    operations: List[TransformOperation]
    commit_message: Optional[str] = None


class DatasetTransformResponse(BaseModel):
    success: bool
    new_version_tag: str
    new_content_hash: str
    row_delta: int
    column_delta: int
    generated_python_code: str
    preview: Any


class ShareResponse(BaseModel):
    share_token: str
    share_url: str
    created_at: str
    dataset_name: str
