"""B2 — Real Object Storage acceptance tests.

These tests verify that the StorageService correctly persists and retrieves
files through both the local-filesystem backend (always available) and the
S3/MinIO backend (skipped automatically when MinIO is unreachable so CI stays
green without Docker).

Acceptance criteria from FIX.md §B2:
  • save_file / download_file round-trip returns the original bytes.
  • delete_file removes the object (file_exists returns False afterwards).
  • Unknown STORAGE_BACKEND raises ValueError on construction.
  • S3 backend: real boto3 calls against a running MinIO instance
    (STORAGE_BACKEND=s3 + S3_ENDPOINT_URL pointing at localhost:9000).
"""

import io
import os
import uuid
import pytest

from strata_api.core import storage as storage_module
from strata_api.core.storage import StorageService, _reset_storage_singleton


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _random_payload() -> bytes:
    return os.urandom(256)


def _make_hash() -> str:
    return uuid.uuid4().hex


# ---------------------------------------------------------------------------
# Local-backend tests (always run)
# ---------------------------------------------------------------------------

class TestLocalStorageBackend:
    """StorageService with STORAGE_BACKEND=local."""

    def setup_method(self):
        _reset_storage_singleton()

    def teardown_method(self):
        _reset_storage_singleton()

    def _make_local_service(self, tmp_path) -> StorageService:
        from unittest.mock import patch
        with patch.object(
            storage_module.settings, "STORAGE_BACKEND", "local"
        ), patch.object(
            storage_module.settings, "LOCAL_STORAGE_DIR", str(tmp_path)
        ):
            return StorageService()

    def test_save_and_download_roundtrip(self, tmp_path):
        """save_file then download_file returns the original bytes."""
        svc = self._make_local_service(tmp_path)
        payload = _random_payload()
        key = svc.save_file(_make_hash(), io.BytesIO(payload), extension=".csv")
        result = svc.download_file(key)
        assert result == payload

    def test_file_exists_after_save(self, tmp_path):
        """file_exists returns True immediately after save."""
        svc = self._make_local_service(tmp_path)
        payload = _random_payload()
        key = svc.save_file(_make_hash(), io.BytesIO(payload), extension=".parquet")
        assert svc.file_exists(key) is True

    def test_delete_removes_file(self, tmp_path):
        """delete_file makes file_exists return False."""
        svc = self._make_local_service(tmp_path)
        payload = _random_payload()
        key = svc.save_file(_make_hash(), io.BytesIO(payload))
        svc.delete_file(key)
        assert svc.file_exists(key) is False

    def test_download_missing_file_raises(self, tmp_path):
        """download_file on a nonexistent key raises FileNotFoundError."""
        svc = self._make_local_service(tmp_path)
        with pytest.raises(FileNotFoundError):
            svc.download_file("/nonexistent/path/no_such_file.csv")

    def test_get_file_path_returns_none_for_missing(self, tmp_path):
        """get_file_path returns None when file doesn't exist."""
        svc = self._make_local_service(tmp_path)
        result = svc.get_file_path("nonexistent_hash", ".csv")
        assert result is None

    def test_get_file_path_returns_path_after_save(self, tmp_path):
        """get_file_path returns the absolute path after a successful save."""
        svc = self._make_local_service(tmp_path)
        payload = _random_payload()
        content_hash = _make_hash()
        svc.save_file(content_hash, io.BytesIO(payload), extension=".csv")
        path = svc.get_file_path(content_hash, ".csv")
        assert path is not None
        assert path.endswith(".csv")

    def test_invalid_backend_raises(self):
        """An unknown STORAGE_BACKEND raises ValueError immediately."""
        from unittest.mock import patch
        with patch.object(storage_module.settings, "STORAGE_BACKEND", "gcs"):
            with pytest.raises(ValueError, match="Unknown STORAGE_BACKEND"):
                StorageService()


# ---------------------------------------------------------------------------
# S3 / MinIO backend tests (skipped when MinIO is unreachable)
# ---------------------------------------------------------------------------

def _minio_available() -> bool:
    """Return True if MinIO is reachable at the configured endpoint."""
    import urllib.request
    endpoint = os.environ.get("S3_ENDPOINT_URL", "http://localhost:9000")
    try:
        urllib.request.urlopen(endpoint + "/minio/health/live", timeout=2)
        return True
    except Exception:
        return False


@pytest.mark.skipif(
    not _minio_available(),
    reason="MinIO not running – start docker-compose to run S3 tests",
)
class TestS3StorageBackend:
    """StorageService with STORAGE_BACKEND=s3, using a live MinIO instance.

    These tests run real boto3 calls against MinIO.  They are automatically
    skipped when MinIO is not reachable, so CI without Docker stays green.
    """

    _TEST_BUCKET = f"strata-b2-test-{uuid.uuid4().hex[:8]}"

    def setup_method(self):
        _reset_storage_singleton()

    def teardown_method(self):
        _reset_storage_singleton()

    def _make_s3_service(self) -> StorageService:
        from unittest.mock import patch
        with patch.object(storage_module.settings, "STORAGE_BACKEND", "s3"), \
             patch.object(storage_module.settings, "S3_BUCKET_NAME", self._TEST_BUCKET), \
             patch.object(storage_module.settings, "S3_ENDPOINT_URL",
                          os.environ.get("S3_ENDPOINT_URL", "http://localhost:9000")), \
             patch.object(storage_module.settings, "S3_ACCESS_KEY",
                          os.environ.get("S3_ACCESS_KEY", "minioadmin")), \
             patch.object(storage_module.settings, "S3_SECRET_KEY",
                          os.environ.get("S3_SECRET_KEY", "minioadmin")), \
             patch.object(storage_module.settings, "S3_REGION", "us-east-1"):
            return StorageService()

    def test_s3_save_and_download_roundtrip(self):
        """Real S3 PUT then GET returns the original bytes."""
        svc = self._make_s3_service()
        payload = _random_payload()
        key = svc.save_file(_make_hash(), io.BytesIO(payload), extension=".csv")
        result = svc.download_file(key)
        assert result == payload

    def test_s3_file_exists_after_upload(self):
        """file_exists returns True after a successful S3 upload."""
        svc = self._make_s3_service()
        payload = _random_payload()
        key = svc.save_file(_make_hash(), io.BytesIO(payload))
        assert svc.file_exists(key) is True

    def test_s3_delete_removes_object(self):
        """delete_file removes the S3 object (file_exists → False)."""
        svc = self._make_s3_service()
        payload = _random_payload()
        key = svc.save_file(_make_hash(), io.BytesIO(payload))
        svc.delete_file(key)
        assert svc.file_exists(key) is False

    def test_s3_download_missing_key_raises(self):
        """download_file raises FileNotFoundError for nonexistent S3 key."""
        svc = self._make_s3_service()
        with pytest.raises(FileNotFoundError):
            svc.download_file("definitely-does-not-exist.parquet")

    def test_s3_large_file_roundtrip(self):
        """Upload and download a 1 MB object successfully."""
        svc = self._make_s3_service()
        payload = os.urandom(1024 * 1024)  # 1 MB
        key = svc.save_file(_make_hash(), io.BytesIO(payload), extension=".parquet")
        result = svc.download_file(key)
        assert result == payload
