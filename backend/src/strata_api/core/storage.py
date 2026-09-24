"""Storage Service for dataset blobs and artifacts.

Supports two backends, controlled by the ``STORAGE_BACKEND`` env-var:

* ``local``  – writes files to a local directory (dev-only fallback).
* ``s3``     – reads/writes via boto3 against S3 or MinIO.

The S3 backend is wired to the MinIO config that lives in
``docker-compose.yml`` and ``config.py``:
  S3_ENDPOINT_URL  (default: http://localhost:9000)
  S3_ACCESS_KEY    (default: minioadmin)
  S3_SECRET_KEY    (default: minioadmin)
  S3_BUCKET_NAME   (default: strata-datasets)
  S3_REGION        (default: us-east-1)
"""

import io
import logging
import os
from pathlib import Path
from typing import BinaryIO, Optional

import boto3
from botocore.config import Config as BotocoreConfig
from botocore.exceptions import BotoCoreError, ClientError

from strata_api.config import settings

logger = logging.getLogger(__name__)


class StorageService:
    """Handles object storage operations (local filesystem or S3/MinIO)."""

    def __init__(self):
        self.backend = settings.STORAGE_BACKEND
        self.local_dir = Path(settings.LOCAL_STORAGE_DIR)

        if self.backend == "local":
            # Local filesystem is a dev-only fallback.
            self.local_dir.mkdir(parents=True, exist_ok=True)
            self._s3 = None
        elif self.backend == "s3":
            self._s3 = self._make_s3_client()
            self._ensure_bucket()
        else:
            raise ValueError(
                f"Unknown STORAGE_BACKEND '{self.backend}'. "
                "Valid values: 'local', 's3'."
            )

    # ------------------------------------------------------------------
    # S3 / MinIO helpers
    # ------------------------------------------------------------------

    def _make_s3_client(self):
        """Create a boto3 S3 client pointed at the configured endpoint."""
        return boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name=settings.S3_REGION,
            config=BotocoreConfig(
                # Disable AWS SigV4 chunked upload – MinIO requires this off.
                s3={"addressing_style": "path"},
                retries={"max_attempts": 3, "mode": "standard"},
            ),
        )

    def _ensure_bucket(self):
        """Create the storage bucket if it doesn't already exist."""
        bucket = settings.S3_BUCKET_NAME
        try:
            self._s3.head_bucket(Bucket=bucket)
            logger.debug("S3 bucket '%s' already exists.", bucket)
        except ClientError as exc:
            error_code = exc.response["Error"]["Code"]
            if error_code in ("404", "NoSuchBucket"):
                logger.info("Creating S3 bucket '%s'.", bucket)
                try:
                    if settings.S3_REGION == "us-east-1":
                        # us-east-1 cannot specify LocationConstraint.
                        self._s3.create_bucket(Bucket=bucket)
                    else:
                        self._s3.create_bucket(
                            Bucket=bucket,
                            CreateBucketConfiguration={
                                "LocationConstraint": settings.S3_REGION
                            },
                        )
                except (BotoCoreError, ClientError) as create_err:
                    logger.error("Failed to create S3 bucket: %s", create_err)
                    raise
            else:
                logger.error(
                    "Unexpected error checking S3 bucket '%s': %s", bucket, exc
                )
                raise

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def save_file(
        self, content_hash: str, file_obj: BinaryIO, extension: str = ""
    ) -> str:
        """Store a file keyed by its content hash.

        Returns:
            A string key that can be passed back to ``get_file_path`` /
            ``download_file``. For the local backend this is an absolute path;
            for S3 it is the S3 object key.
        """
        filename = f"{content_hash}{extension}"

        if self.backend == "local":
            dest_path = self.local_dir / filename
            with open(dest_path, "wb") as f:
                f.write(file_obj.read())
            return str(dest_path.resolve())

        # --- S3 / MinIO ---
        bucket = settings.S3_BUCKET_NAME
        key = filename
        data = file_obj.read()
        try:
            self._s3.put_object(Bucket=bucket, Key=key, Body=data)
            logger.debug(
                "Uploaded %d bytes to s3://%s/%s", len(data), bucket, key
            )
        except (BotoCoreError, ClientError) as exc:
            logger.error("S3 upload failed for key '%s': %s", key, exc)
            raise
        return key

    def get_file_path(self, content_hash: str, extension: str = "") -> Optional[str]:
        """Return a local filesystem path to the file, if available.

        For the local backend this is always resolvable. For the S3 backend
        this returns ``None`` — callers should use ``download_file`` instead.
        """
        filename = f"{content_hash}{extension}"
        if self.backend == "local":
            dest_path = self.local_dir / filename
            if dest_path.exists():
                return str(dest_path.resolve())
            return None

        # S3 objects don't have a local path – signal to caller.
        return None

    def download_file(self, key: str) -> bytes:
        """Download a file by its storage key and return the raw bytes.

        Works for both the local and S3 backends.
        """
        if self.backend == "local":
            path = Path(key)
            if not path.exists():
                raise FileNotFoundError(f"Local file not found: {key}")
            return path.read_bytes()

        # --- S3 / MinIO ---
        bucket = settings.S3_BUCKET_NAME
        try:
            response = self._s3.get_object(Bucket=bucket, Key=key)
            data: bytes = response["Body"].read()
            logger.debug(
                "Downloaded %d bytes from s3://%s/%s", len(data), bucket, key
            )
            return data
        except ClientError as exc:
            error_code = exc.response["Error"]["Code"]
            if error_code in ("NoSuchKey", "404"):
                raise FileNotFoundError(
                    f"S3 object not found: s3://{bucket}/{key}"
                ) from exc
            logger.error("S3 download failed for key '%s': %s", key, exc)
            raise

    def delete_file(self, key: str) -> None:
        """Delete a file by its storage key (idempotent)."""
        if self.backend == "local":
            path = Path(key) if os.path.isabs(key) else self.local_dir / key
            path.unlink(missing_ok=True)
            return

        # --- S3 / MinIO ---
        bucket = settings.S3_BUCKET_NAME
        try:
            self._s3.delete_object(Bucket=bucket, Key=key)
            logger.debug("Deleted s3://%s/%s", bucket, key)
        except (BotoCoreError, ClientError) as exc:
            logger.error("S3 delete failed for key '%s': %s", key, exc)
            raise

    def file_exists(self, key: str) -> bool:
        """Check whether a file exists in the current backend."""
        if self.backend == "local":
            path = Path(key) if os.path.isabs(key) else self.local_dir / key
            return path.exists()

        # --- S3 / MinIO ---
        bucket = settings.S3_BUCKET_NAME
        try:
            self._s3.head_object(Bucket=bucket, Key=key)
            return True
        except ClientError as exc:
            if exc.response["Error"]["Code"] in ("404", "NoSuchKey"):
                return False
            raise


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

_storage_instance: Optional[StorageService] = None


def get_storage_service() -> StorageService:
    """Dependency provider for storage service."""
    global _storage_instance
    if _storage_instance is None:
        _storage_instance = StorageService()
    return _storage_instance


def _reset_storage_singleton() -> None:
    """Reset the storage singleton (test helper only)."""
    global _storage_instance
    _storage_instance = None
