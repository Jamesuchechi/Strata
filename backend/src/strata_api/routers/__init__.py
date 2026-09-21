"""API routers module."""

from strata_api.routers.health import router as health_router
from strata_api.routers.preview import router as preview_router
from strata_api.routers.query import router as query_router
from strata_api.routers.datasets import router as datasets_router
from strata_api.routers.diff import router as diff_router
from strata_api.routers.auth import auth_router

__all__ = [
    "health_router",
    "preview_router",
    "query_router",
    "datasets_router",
    "diff_router",
    "auth_router",
]
