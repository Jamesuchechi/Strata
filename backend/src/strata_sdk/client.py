"""Strata Python SDK Client.

Provides programmatic access to Strata Studio's ingestion, DuckDB querying,
version control DAG, and point-and-click wrangling engines.
"""

import os
from typing import Any, Dict, List, Optional
import httpx


class StrataClient:
    """Python Client for the Strata Studio API."""

    def __init__(
        self,
        base_url: str = "http://127.0.0.1:8000/api",
        auth_token: Optional[str] = None,
        timeout: float = 30.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.headers = {}
        if auth_token:
            self.headers["Authorization"] = f"Bearer {auth_token}"
        self.timeout = timeout

    def check_health(self) -> bool:
        """Check if Strata API is running and healthy."""
        try:
            with httpx.Client(timeout=5.0) as client:
                res = client.get(f"{self.base_url}/health")
                return res.status_code == 200 and res.json().get("status") == "healthy"
        except Exception:
            return False

    def upload_dataset(self, file_path: str, sheet: Optional[str] = None) -> Dict[str, Any]:
        """Upload a dataset file (CSV, Parquet, Excel, JSON, SDF) to Strata."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        filename = os.path.basename(file_path)
        params = {}
        if sheet:
            params["sheet"] = sheet

        with open(file_path, "rb") as f:
            files = {"file": (filename, f)}
            with httpx.Client(timeout=self.timeout) as client:
                res = client.post(
                    f"{self.base_url}/preview",
                    files=files,
                    params=params,
                    headers=self.headers,
                )
                res.raise_for_status()
                return res.json()

    def list_datasets(self) -> List[Dict[str, Any]]:
        """List all registered datasets in the active workspace."""
        with httpx.Client(timeout=self.timeout) as client:
            res = client.get(f"{self.base_url}/datasets", headers=self.headers)
            res.raise_for_status()
            return res.json()

    def get_dataset(self, dataset_id: str) -> Dict[str, Any]:
        """Retrieve dataset preview, virtual schema, and microstats."""
        with httpx.Client(timeout=self.timeout) as client:
            res = client.get(f"{self.base_url}/datasets/{dataset_id}", headers=self.headers)
            res.raise_for_status()
            return res.json()

    def query(
        self,
        view_name: str,
        sql: Optional[str] = None,
        natural_language_question: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Run DuckDB SQL queries or natural language analytical queries."""
        payload = {
            "view_name": view_name,
            "sql": sql,
            "natural_language_question": natural_language_question,
        }
        with httpx.Client(timeout=self.timeout) as client:
            res = client.post(f"{self.base_url}/query", json=payload, headers=self.headers)
            res.raise_for_status()
            return res.json()

    def transform(
        self,
        dataset_id: str,
        operations: List[Dict[str, Any]],
        commit_message: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Execute wrangling operations and auto-commit a new version to the DAG."""
        payload = {
            "operations": operations,
            "commit_message": commit_message,
        }
        with httpx.Client(timeout=self.timeout) as client:
            res = client.post(
                f"{self.base_url}/datasets/{dataset_id}/transform",
                json=payload,
                headers=self.headers,
            )
            res.raise_for_status()
            return res.json()

    def get_commit_log(self, dataset_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieve the immutable Git-like version commit history DAG."""
        params = {}
        if dataset_name:
            params["dataset_name"] = dataset_name
        with httpx.Client(timeout=self.timeout) as client:
            res = client.get(f"{self.base_url}/diff/commits", params=params, headers=self.headers)
            res.raise_for_status()
            return res.json()

    def compare_snapshots(self, base_id: str, target_id: str) -> Dict[str, Any]:
        """Compute multi-dimensional schema, row, and statistical diff between two versions."""
        params = {"base_id": base_id, "target_id": target_id}
        with httpx.Client(timeout=self.timeout) as client:
            res = client.get(f"{self.base_url}/diff/compare", params=params, headers=self.headers)
            res.raise_for_status()
            return res.json()

    def rollback(self, commit_id: str) -> Dict[str, Any]:
        """Rollback dataset state to a specific commit snapshot."""
        with httpx.Client(timeout=self.timeout) as client:
            res = client.post(
                f"{self.base_url}/diff/commits/{commit_id}/rollback",
                headers=self.headers,
            )
            res.raise_for_status()
            return res.json()
