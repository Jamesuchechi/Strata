"""Preview request and response schemas."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class ColumnSchema(BaseModel):
    name: str
    type: str


class PreviewResponse(BaseModel):
    filename: str
    format: str
    content_hash: str
    total_rows: int
    total_columns: int
    schema_fields: List[ColumnSchema]
    preview_rows: List[Dict[str, Any]]
    sheets: Optional[List[str]] = None
    active_sheet: Optional[str] = None
    view_name: Optional[str] = None
    column_stats: Optional[List[Dict[str, Any]]] = None
    pii_flags: Optional[Dict[str, str]] = None
    quality_score: Optional[Dict[str, Any]] = None
    is_duplicate: Optional[bool] = False
    existing_dataset_id: Optional[str] = None
    existing_dataset_name: Optional[str] = None

