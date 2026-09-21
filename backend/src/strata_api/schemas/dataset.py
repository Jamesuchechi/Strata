"""Dataset management schemas."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class DatasetCreate(BaseModel):
    name: str
    description: Optional[str] = None
    tags: List[str] = []


class DatasetResponse(BaseModel):
    name: str
    description: Optional[str] = None
    tags: List[str] = []
    latest_version: Optional[str] = None
    version_count: int = 0
