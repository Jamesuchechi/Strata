from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from strata_api.config import settings
from strata_api.core.database import init_db
from strata_api.routers import (
    health_router,
    preview_router,
    query_router,
    datasets_router,
    diff_router,
    auth_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context for startup and shutdown tasks."""
    # Ensure database tables exist
    await init_db()
    yield


def create_app() -> FastAPI:
    """Application factory for Strata API."""
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

    @app.get("/")
    async def root():
        return {
            "message": "Welcome to Strata API. Visit /api/docs for Swagger documentation.",
            "status": "online",
        }

    return app


app = create_app()


def start():
    """CLI runner for uvicorn."""
    import uvicorn
    uvicorn.run("strata_api.main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    start()
