"""AutoML Sandbox, Feature Importance, and Model Diagnostics Router.

POST /automl/train
    Enqueues an AutoML training job via ARQ (Redis-backed async queue)
    and returns a ``job_id`` immediately.  The heavy ML work runs in the
    ARQ worker process.

GET /jobs/{job_id}
    Poll this endpoint (from ``routers/jobs.py``) to retrieve progress /
    the final result once training completes.

If Redis is unavailable the endpoint returns HTTP 503 with a clear message.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from strata_api.models.user import UserModel
from strata_api.routers.auth import get_current_user
from strata_api.routers.datasets import _datasets_db, check_dataset_access
from strata_api.core.arq_pool import get_arq_pool

router = APIRouter(prefix="/automl", tags=["AutoML"])


class TrainModelRequest(BaseModel):
    dataset_id: str
    target_column: str
    task_type: Optional[str] = "auto"   # "auto" | "classification" | "regression"
    model_family: Optional[str] = "random_forest"


@router.post("/train")
async def train_baseline_model(
    req: TrainModelRequest,
    current_user: UserModel = Depends(get_current_user),
):
    """Enqueue an AutoML training job.

    Returns immediately with a ``job_id``.
    Poll ``GET /api/jobs/{job_id}`` for status and result.
    """
    # Resolve dataset
    record = _datasets_db.get(req.dataset_id)
    if not record:
        for r in _datasets_db.values():
            if (
                r["content_hash"].startswith(req.dataset_id)
                or r["filename"] == req.dataset_id
            ):
                record = r
                break
    if not record:
        raise HTTPException(status_code=404, detail="Dataset not found")

    check_dataset_access(record, current_user.id)

    # Require ARQ pool (Redis)
    pool = get_arq_pool()
    if pool is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "Background job queue unavailable: Redis is not connected. "
                "Start Redis (docker-compose up redis) and restart the API."
            ),
        )

    # Enqueue — returns immediately with an ARQ Job object
    job = await pool.enqueue_job(
        "train_automl_task",
        dataset_record=record,
        target_column=req.target_column,
        task_type=req.task_type or "auto",
        model_family=req.model_family or "random_forest",
    )

    return {
        "status": "queued",
        "job_id": job.job_id,
        "message": (
            f"AutoML training job queued for dataset '{record['filename']}'. "
            f"Poll GET /api/jobs/{job.job_id} for status and result."
        ),
        "dataset_name": record["filename"],
        "target_column": req.target_column,
        "task_type": req.task_type,
        "model_family": req.model_family,
    }
