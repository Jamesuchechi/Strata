"""Health and status check router."""

from fastapi import APIRouter
from strata_api.config import settings

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    """Verify backend API service is running and healthy."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "version": "0.1.0",
    }
