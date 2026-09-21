"""Strata API Client."""

import os
from typing import Any, Dict, Optional
import httpx


class StrataClient:
    """Client for interacting with the Strata backend API."""

    def __init__(self, base_url: Optional[str] = None, api_key: Optional[str] = None):
        self.base_url = base_url or os.getenv("STRATA_API_URL", "http://localhost:8000/api")
        self.api_key = api_key or os.getenv("STRATA_API_KEY", "")
        self._client = httpx.Client(base_url=self.base_url, timeout=60.0)

    def preview_file(self, file_path: str) -> Dict[str, Any]:
        """Upload a file to the preview endpoint."""
        with open(file_path, "rb") as f:
            files = {"file": (os.path.basename(file_path), f)}
            response = self._client.post("/preview", files=files)
            response.raise_for_status()
            return response.json()

    def query(self, view_name: str, sql: Optional[str] = None, nl_question: Optional[str] = None) -> Dict[str, Any]:
        """Execute a SQL or natural language query against a dataset."""
        payload = {
            "view_name": view_name,
            "sql": sql,
            "natural_language_question": nl_question,
        }
        response = self._client.post("/query", json=payload)
        response.raise_for_status()
        return response.json()
