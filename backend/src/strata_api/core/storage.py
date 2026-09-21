"""Storage Service for dataset blobs and artifacts."""

import os
from pathlib import Path
from typing import BinaryIO, Optional
from strata_api.config import settings


class StorageService:
    """Handles object storage operations (local filesystem or S3/MinIO)."""

    def __init__(self):
        self.backend = settings.STORAGE_BACKEND
        self.local_dir = Path(settings.LOCAL_STORAGE_DIR)
        if self.backend == "local":
            self.local_dir.mkdir(parents=True, exist_ok=True)

    def save_file(self, content_hash: str, file_obj: BinaryIO, extension: str = "") -> str:
        """Store a file keyed by its content hash."""
        filename = f"{content_hash}{extension}"
        if self.backend == "local":
            dest_path = self.local_dir / filename
            with open(dest_path, "wb") as f:
                f.write(file_obj.read())
            return str(dest_path.resolve())
        else:
            # S3 / MinIO backend placeholder
            raise NotImplementedError("S3 storage backend will be enabled in Phase 1")

    def get_file_path(self, content_hash: str, extension: str = "") -> Optional[str]:
        """Get local file path if available."""
        filename = f"{content_hash}{extension}"
        dest_path = self.local_dir / filename
        if dest_path.exists():
            return str(dest_path.resolve())
        return None


_storage_instance: Optional[StorageService] = None


def get_storage_service() -> StorageService:
    """Dependency provider for storage service."""
    global _storage_instance
    if _storage_instance is None:
        _storage_instance = StorageService()
    return _storage_instance
