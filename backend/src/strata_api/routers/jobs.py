"""Job status polling router.

Every long-running background job (AutoML training, pipeline runs, EDA
profiling) is dispatched via ARQ and immediately returns a ``job_id``.
Clients poll this router to check status and retrieve results.

Endpoints
---------
GET /jobs/{job_id}
    Returns the current status of a queued ARQ job.

Response shape::

    {
        "job_id": "...",
        "status": "queued" | "in_progress" | "complete" | "not_found" | "failed",
        "result": { ... }   # present only when status == "complete"
        "error": "..."      # present only when status == "failed"
    }
"""

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from arq.jobs import Job, JobStatus

from strata_api.models.user import UserModel
from strata_api.routers.auth import get_current_user
from strata_api.core.arq_pool import get_arq_pool

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["Async Jobs"])


@router.get("/{job_id}")
async def get_job_status(
    job_id: str,
    current_user: UserModel = Depends(get_current_user),
) -> Dict[str, Any]:
    """Poll the status of a queued background job.

    Returns ``status: "not_found"`` (HTTP 200) rather than 404 when the job
    ID is unknown — this lets the frontend distinguish "never existed" from
    transient "not yet visible" without error-handling noise.
    """
    pool = get_arq_pool()
    if pool is None:
        # ARQ pool not available (no Redis) — surface a useful error.
        raise HTTPException(
            status_code=503,
            detail=(
                "Job queue unavailable: Redis is not connected. "
                "Start Redis (docker-compose up redis) and restart the API."
            ),
        )

    job = Job(job_id=job_id, redis=pool)
    try:
        status: JobStatus = await job.status()
    except Exception as exc:
        logger.error("Error fetching status for job %s: %s", job_id, exc)
        raise HTTPException(status_code=500, detail=f"Failed to query job status: {exc}")

    if status == JobStatus.not_found:
        return {"job_id": job_id, "status": "not_found"}

    if status in (JobStatus.queued, JobStatus.deferred):
        return {"job_id": job_id, "status": "queued"}

    if status == JobStatus.in_progress:
        return {"job_id": job_id, "status": "in_progress"}

    if status == JobStatus.complete:
        try:
            info = await job.info()
        except Exception as exc:
            logger.error("Error fetching result for job %s: %s", job_id, exc)
            raise HTTPException(status_code=500, detail=f"Failed to retrieve job result: {exc}")

        if info and info.success:
            return {"job_id": job_id, "status": "complete", "result": info.result}
        else:
            error_msg = str(info.result) if info else "Unknown error"
            return {"job_id": job_id, "status": "failed", "error": error_msg}

    # Catch-all for any future ARQ statuses
    return {"job_id": job_id, "status": str(status)}
