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
