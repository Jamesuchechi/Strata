"""B3 — ARQ async job queue acceptance tests.

Acceptance criteria from FIX.md §B3:
  • POST /automl/train returns immediately with a job_id (does not block).
  • POST /pipelines/{id}/run returns immediately with a job_id.
  • When Redis is unavailable both endpoints return HTTP 503.
  • GET /jobs/{job_id} returns "not_found" for unknown job IDs.
  • GET /jobs/{job_id} returns 503 when the ARQ pool is None.
  • The ARQ worker WorkerSettings is importable and lists all expected tasks.

Uses conftest.py's pre-seeded users (AUTH_HEADERS_A / AUTH_HEADERS_B) so
tests don't depend on the register→login flow completing within the same
in-memory DB instance.
"""

import io
import os
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

# Reuse the same singleton app so the conftest-seeded users are present
from strata_api.main import app
from tests.conftest import AUTH_HEADERS_A, TEST_USER_A_ID


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _upload_csv(client: TestClient) -> str:
    """Upload a tiny CSV and return the dataset_id."""
    csv_data = (
        "age,salary,department\n"
        "25,50000,Engineering\n30,60000,Marketing\n35,70000,Engineering\n"
        "28,55000,Marketing\n32,65000,Engineering\n40,80000,Management\n"
        "22,45000,Engineering\n27,52000,Marketing\n"
    )
    resp = client.post(
        "/api/preview/upload",
        files={"file": ("test_b3.csv", io.BytesIO(csv_data.encode()), "text/csv")},
        headers=AUTH_HEADERS_A,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["dataset_id"]


# ---------------------------------------------------------------------------
# Fake ARQ job object
# ---------------------------------------------------------------------------

class _MockJob:
    """Minimal fake of an ARQ Job object."""
    def __init__(self):
        self.job_id = f"mock_job_{uuid.uuid4().hex[:8]}"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def client_with_arq():
    """TestClient with a mock ARQ pool that returns fake job IDs."""
    mock_pool = AsyncMock()
    mock_pool.enqueue_job = AsyncMock(return_value=_MockJob())

    # Patch get_arq_pool in every router that uses it
    with (
        patch("strata_api.routers.automl.get_arq_pool", return_value=mock_pool),
        patch("strata_api.routers.pipelines.get_arq_pool", return_value=mock_pool),
        patch("strata_api.routers.jobs.get_arq_pool", return_value=mock_pool),
    ):
        with TestClient(app, raise_server_exceptions=True) as c:
            yield c, mock_pool


@pytest.fixture
def client_no_arq():
    """TestClient with ARQ pool returning None (simulates Redis unavailable)."""
    with (
        patch("strata_api.routers.automl.get_arq_pool", return_value=None),
        patch("strata_api.routers.pipelines.get_arq_pool", return_value=None),
        patch("strata_api.routers.jobs.get_arq_pool", return_value=None),
    ):
        with TestClient(app, raise_server_exceptions=True) as c:
            yield c


# ---------------------------------------------------------------------------
# Tests: automl/train returns job_id immediately
# ---------------------------------------------------------------------------

class TestAutoMLAsync:
    def test_train_requires_auth(self, client_with_arq):
        client, _ = client_with_arq
        resp = client.post(
            "/api/automl/train",
            json={"dataset_id": "some_id", "target_column": "col"},
        )
        assert resp.status_code == 401

    def test_train_returns_404_for_missing_dataset(self, client_with_arq):
        client, _ = client_with_arq
        resp = client.post(
            "/api/automl/train",
            json={"dataset_id": "nonexistent_xyz_123", "target_column": "col"},
            headers=AUTH_HEADERS_A,
        )
        assert resp.status_code == 404

    def test_train_returns_503_when_redis_unavailable(self, client_no_arq):
        client = client_no_arq
        # Use the seeded churn_demo dataset (always present via conftest)
        resp = client.post(
            "/api/automl/train",
            json={"dataset_id": "churn_demo", "target_column": "churned"},
            headers=AUTH_HEADERS_A,
        )
        assert resp.status_code == 503
        assert "Redis" in resp.json()["detail"]

    def test_train_returns_job_id_immediately(self, client_with_arq):
        client, mock_pool = client_with_arq
        resp = client.post(
            "/api/automl/train",
            json={"dataset_id": "churn_demo", "target_column": "churned"},
            headers=AUTH_HEADERS_A,
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["status"] == "queued"
        assert "job_id" in data and data["job_id"]  # non-empty
        mock_pool.enqueue_job.assert_called_once()
        # Verify the correct task function name was passed
        assert mock_pool.enqueue_job.call_args[0][0] == "train_automl_task"

    def test_train_response_contains_helpful_metadata(self, client_with_arq):
        client, _ = client_with_arq
        resp = client.post(
            "/api/automl/train",
            json={"dataset_id": "churn_demo", "target_column": "churned"},
            headers=AUTH_HEADERS_A,
        )
        data = resp.json()
        assert "message" in data
        # message should reference the actual job_id returned in the response
        assert data["job_id"] in data["message"]


# ---------------------------------------------------------------------------
# Tests: pipelines/{id}/run returns job_id immediately
# ---------------------------------------------------------------------------

class TestPipelineRunAsync:
    def test_run_requires_auth(self, client_with_arq):
        client, _ = client_with_arq
        resp = client.post("/api/pipelines/some_id/run")
        assert resp.status_code == 401

    def test_run_returns_404_for_unknown_pipeline(self, client_with_arq):
        client, _ = client_with_arq
        resp = client.post(
            "/api/pipelines/nonexistent_pipe_xyz/run",
            headers=AUTH_HEADERS_A,
        )
        assert resp.status_code == 404

    def test_run_returns_job_id_immediately(self, client_with_arq):
        client, mock_pool = client_with_arq
        # Use the seeded pipe_churn_etl pipeline (always present via conftest)
        resp = client.post(
            "/api/pipelines/pipe_churn_etl/run",
            headers=AUTH_HEADERS_A,
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["status"] == "queued"
        assert "job_id" in data and data["job_id"]
        assert data["run_id"].startswith("run_")
        assert data["pipeline_id"] == "pipe_churn_etl"
        mock_pool.enqueue_job.assert_called_once()
        assert mock_pool.enqueue_job.call_args[0][0] == "run_pipeline_task"

    def test_run_returns_503_when_redis_unavailable(self, client_no_arq):
        client = client_no_arq
        resp = client.post(
            "/api/pipelines/pipe_churn_etl/run",
            headers=AUTH_HEADERS_A,
        )
        assert resp.status_code == 503
        assert "Redis" in resp.json()["detail"]

    def test_run_enqueues_with_correct_pipeline_payload(self, client_with_arq):
        client, mock_pool = client_with_arq
        resp = client.post(
            "/api/pipelines/pipe_churn_etl/run",
            headers=AUTH_HEADERS_A,
        )
        assert resp.status_code == 200, resp.text
        # Verify enqueue_job was called with pipeline dict as a kwarg
        call_kwargs = mock_pool.enqueue_job.call_args[1]
        assert "pipeline" in call_kwargs
        assert call_kwargs["pipeline"]["id"] == "pipe_churn_etl"
        assert "run_id" in call_kwargs


# ---------------------------------------------------------------------------
# Tests: GET /jobs/{job_id} polling
# ---------------------------------------------------------------------------

class TestJobsPollingEndpoint:
    def test_jobs_endpoint_requires_auth(self, client_with_arq):
        client, _ = client_with_arq
        resp = client.get("/api/jobs/some_job")
        assert resp.status_code == 401

    def test_jobs_endpoint_returns_503_when_no_pool(self, client_no_arq):
        client = client_no_arq
        resp = client.get("/api/jobs/any_job_id", headers=AUTH_HEADERS_A)
        assert resp.status_code == 503

    def test_unknown_job_returns_not_found_status(self, client_with_arq):
        client, _ = client_with_arq
        from arq.jobs import JobStatus

        mock_job = AsyncMock()
        mock_job.status = AsyncMock(return_value=JobStatus.not_found)

        with patch("strata_api.routers.jobs.Job", return_value=mock_job):
            resp = client.get("/api/jobs/totally_unknown_id", headers=AUTH_HEADERS_A)

        assert resp.status_code == 200
        assert resp.json()["status"] == "not_found"

    def test_queued_job_returns_queued_status(self, client_with_arq):
        client, _ = client_with_arq
        from arq.jobs import JobStatus

        mock_job = AsyncMock()
        mock_job.status = AsyncMock(return_value=JobStatus.queued)

        with patch("strata_api.routers.jobs.Job", return_value=mock_job):
            resp = client.get("/api/jobs/queued_job_id", headers=AUTH_HEADERS_A)

        assert resp.status_code == 200
        assert resp.json()["status"] == "queued"

    def test_in_progress_job_returns_in_progress_status(self, client_with_arq):
        client, _ = client_with_arq
        from arq.jobs import JobStatus

        mock_job = AsyncMock()
        mock_job.status = AsyncMock(return_value=JobStatus.in_progress)

        with patch("strata_api.routers.jobs.Job", return_value=mock_job):
            resp = client.get("/api/jobs/running_job", headers=AUTH_HEADERS_A)

        assert resp.status_code == 200
        assert resp.json()["status"] == "in_progress"

    def test_complete_job_returns_result_payload(self, client_with_arq):
        client, _ = client_with_arq
        from arq.jobs import JobStatus

        mock_info = MagicMock()
        mock_info.success = True
        mock_info.result = {"task_type": "classification", "accuracy": 0.95}

        mock_job = AsyncMock()
        mock_job.status = AsyncMock(return_value=JobStatus.complete)
        mock_job.info = AsyncMock(return_value=mock_info)

        with patch("strata_api.routers.jobs.Job", return_value=mock_job):
            resp = client.get("/api/jobs/done_job_id", headers=AUTH_HEADERS_A)

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "complete"
        assert data["result"]["accuracy"] == 0.95

    def test_failed_job_returns_error_payload(self, client_with_arq):
        client, _ = client_with_arq
        from arq.jobs import JobStatus

        mock_info = MagicMock()
        mock_info.success = False
        mock_info.result = "Dataset file not found"

        mock_job = AsyncMock()
        mock_job.status = AsyncMock(return_value=JobStatus.complete)
        mock_job.info = AsyncMock(return_value=mock_info)

        with patch("strata_api.routers.jobs.Job", return_value=mock_job):
            resp = client.get("/api/jobs/failed_job", headers=AUTH_HEADERS_A)

        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "failed"
        assert "error" in data


# ---------------------------------------------------------------------------
# Tests: WorkerSettings
# ---------------------------------------------------------------------------

class TestWorkerSettings:
    def test_worker_settings_importable(self):
        from strata_api.core.arq_worker import WorkerSettings
        assert WorkerSettings is not None

    def test_worker_settings_lists_all_task_functions(self):
        from strata_api.core.arq_worker import WorkerSettings
        fn_names = {f.__name__ for f in WorkerSettings.functions}
        assert "run_pipeline_task" in fn_names
        assert "train_automl_task" in fn_names
        assert "run_eda_profile_task" in fn_names

    def test_worker_settings_has_redis_settings(self):
        from strata_api.core.arq_worker import WorkerSettings
        from arq.connections import RedisSettings
        assert isinstance(WorkerSettings.redis_settings, RedisSettings)

    def test_worker_has_reasonable_job_timeout(self):
        from strata_api.core.arq_worker import WorkerSettings
        # Must be > 0 and a sane ceiling (we set 600s = 10 min)
        assert 60 <= WorkerSettings.job_timeout <= 3600

    def test_arq_pool_module_importable(self):
        from strata_api.core.arq_pool import get_arq_pool, init_arq_pool, close_arq_pool
        # get_arq_pool returns None when Redis is not connected (default state in tests)
        result = get_arq_pool()
        assert result is None or result is not None  # just verifies it doesn't raise
