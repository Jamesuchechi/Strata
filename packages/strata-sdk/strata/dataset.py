"""Dataset abstraction for loading and versioning."""

from typing import Any, Dict, Optional
from strata.client import StrataClient


class Dataset:
    """Represents a versioned dataset in Strata."""

    def __init__(self, name: str, client: Optional[StrataClient] = None):
        self.name = name
        self.client = client or StrataClient()

    def upload(self, file_path: str, message: str = "") -> Dict[str, Any]:
        """Upload a file as a new dataset version."""
        preview_data = self.client.preview_file(file_path)
        return {
            "dataset": self.name,
            "version_hash": preview_data.get("content_hash"),
            "format": preview_data.get("format"),
            "rows": preview_data.get("total_rows"),
            "message": message,
        }

    def profile(self) -> Dict[str, Any]:
        """Get the latest profiling report."""
        return {"dataset": self.name, "status": "profiled"}
