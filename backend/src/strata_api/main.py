from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from strata_api.config import settings
from strata_api.core.database import init_db
from strata_api.core.arq_pool import init_arq_pool, close_arq_pool
from strata_api.routers import (
    health_router,
    preview_router,
    query_router,
    datasets_router,
    diff_router,
    auth_router,
    eda_router,
    automl_router,
    collaboration_router,
    billing_router,
    branches_router,
    lineage_router,
    discovery_router,
    showcase_router,
    pipelines_router,
    integrations_router,
    security_router,
)
from strata_api.routers.jobs import router as jobs_router


from strata_api.core.security import validate_jwt_security_config


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context for startup and shutdown tasks."""
    validate_jwt_security_config()
    # Ensure database tables exist
    await init_db()
    # Connect to Redis for background job queue (non-fatal if Redis is down)
    await init_arq_pool()
    yield
    # Graceful shutdown: close ARQ pool
    await close_arq_pool()


def create_app() -> FastAPI:
    """Application factory for Strata API."""
    validate_jwt_security_config()
    app = FastAPI(
        title=settings.PROJECT_NAME,
        description="The AI-Native Data Science Studio & Version Control API.",
        version="0.1.0",
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
        docs_url=f"{settings.API_V1_PREFIX}/docs",
        lifespan=lifespan,
    )

    # CORS Middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register Routers
    app.include_router(health_router, prefix=settings.API_V1_PREFIX)
    app.include_router(preview_router, prefix=settings.API_V1_PREFIX)
    app.include_router(query_router, prefix=settings.API_V1_PREFIX)
    app.include_router(datasets_router, prefix=settings.API_V1_PREFIX)
    app.include_router(diff_router, prefix=settings.API_V1_PREFIX)
    app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
    app.include_router(eda_router, prefix=settings.API_V1_PREFIX)
    app.include_router(automl_router, prefix=settings.API_V1_PREFIX)
    app.include_router(collaboration_router, prefix=settings.API_V1_PREFIX)
    app.include_router(billing_router, prefix=settings.API_V1_PREFIX)
    app.include_router(branches_router, prefix=settings.API_V1_PREFIX)
    app.include_router(lineage_router, prefix=settings.API_V1_PREFIX)
    app.include_router(discovery_router, prefix=settings.API_V1_PREFIX)
    app.include_router(showcase_router, prefix=settings.API_V1_PREFIX)
    app.include_router(pipelines_router, prefix=settings.API_V1_PREFIX)
    app.include_router(integrations_router, prefix=settings.API_V1_PREFIX)
    app.include_router(security_router, prefix=settings.API_V1_PREFIX)
    app.include_router(jobs_router, prefix=settings.API_V1_PREFIX)

    from strata_api.routers.datasets import get_shared_dataset
    app.add_api_route(
        f"{settings.API_V1_PREFIX}/shared/{{token}}",
        get_shared_dataset,
        methods=["GET"],
        tags=["Datasets"],
    )

    @app.get("/")
    async def root():
        return {
            "message": "Welcome to Strata API. Visit /api/docs for Swagger documentation.",
            "status": "online",
        }

    return app


app = create_app()


def start():
    """CLI runner: 'strata-api' (API server) or 'strata-api worker' (ARQ worker)."""
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "worker":
        _start_worker()
    else:
        import uvicorn
        uvicorn.run("strata_api.main:app", host="0.0.0.0", port=8000, reload=True)


def _start_worker():
    """Launch the ARQ background job worker.

    Run::

        strata-api worker

    or directly::

        arq strata_api.core.arq_worker.WorkerSettings
    """
    import asyncio
    from arq import run_worker
    from strata_api.core.arq_worker import WorkerSettings
    run_worker(WorkerSettings)


if __name__ == "__main__":
    start()
