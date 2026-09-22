"""API routers module."""

from strata_api.routers.health import router as health_router
from strata_api.routers.preview import router as preview_router
from strata_api.routers.query import router as query_router
from strata_api.routers.datasets import router as datasets_router
from strata_api.routers.diff import router as diff_router
from strata_api.routers.auth import auth_router
from strata_api.routers.eda import router as eda_router
from strata_api.routers.automl import router as automl_router
from strata_api.routers.collaboration import router as collaboration_router
from strata_api.routers.billing import router as billing_router
from strata_api.routers.branches import router as branches_router
from strata_api.routers.lineage import router as lineage_router

__all__ = [
    "health_router",
    "preview_router",
    "query_router",
    "datasets_router",
    "diff_router",
    "auth_router",
    "eda_router",
    "automl_router",
    "collaboration_router",
    "billing_router",
    "branches_router",
    "lineage_router",
]
