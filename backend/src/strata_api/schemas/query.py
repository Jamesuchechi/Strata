"""Query execution request and response schemas."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class QueryRequest(BaseModel):
    view_name: Optional[str] = None
    sql: Optional[str] = None
    natural_language_question: Optional[str] = None
    limit: int = 500


class QueryResponse(BaseModel):
    success: bool
    executed_sql: Optional[str] = None
    row_count: int = 0
    columns: List[str] = []
    data: List[Dict[str, Any]] = []
    explanation: Optional[str] = None
    error: Optional[str] = None
