"""Configuration settings for Strata backend."""

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    PROJECT_NAME: str = "Strata"
    API_V1_PREFIX: str = "/api"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # Database (Defaults to SQLite for instant local dev, easily overridden with PostgreSQL)
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/strata.db"

    # Security & JWT Auth
    JWT_SECRET_KEY: str = "strata_super_secret_jwt_key_development_only_change_in_prod"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    RATE_LIMIT_ENABLED: bool = True

    # Storage (S3 / MinIO / Local)
    STORAGE_BACKEND: str = "local"  # "local" or "s3"
    LOCAL_STORAGE_DIR: str = "./data/storage"
    S3_ENDPOINT_URL: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET_NAME: str = "strata-datasets"
    S3_REGION: str = "us-east-1"

    # Redis / Celery
    REDIS_URL: str = "redis://localhost:6379/0"

    # DuckDB Execution
    DUCKDB_MEMORY_LIMIT: str = "4GB"
    DUCKDB_THREADS: int = 4

    # AI / LLM Configuration (Phase C)
    # Provider keys
    GROQ_API_KEY: str = ""
    MISTRAL_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    LLM_PROVIDER_ORDER: str = "groq,mistral,openrouter"

    # Default models per provider
    GROQ_DEFAULT_MODEL: str = "llama-3.3-70b-versatile"
    MISTRAL_DEFAULT_MODEL: str = "mistral-large-latest"
    OPENROUTER_DEFAULT_MODEL: str = "mistralai/mistral-large"

    # Timeouts and caps
    LLM_TIMEOUT_SECONDS: int = 15
    LLM_CAP_FREE: int = 25
    LLM_CAP_PRO: int = 500
    LLM_CAP_TEAM: int = 2000
    LLM_CACHE_TTL_SECONDS: int = 3600

    # Legacy keys (kept for future use)
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    DEFAULT_LLM_MODEL: str = "groq/llama-3.3-70b-versatile"

    # Email Delivery (Resend / SMTP / Console)
    EMAIL_PROVIDER: str = "console"  # "resend", "smtp", "console"
    RESEND_API_KEY: str = ""
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@strata.ai"
    APP_BASE_URL: str = "http://localhost:3000"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
