"""Database connection and session management for Strata."""

import os
from pathlib import Path
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from strata_api.config import settings


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""
    pass


# Ensure data directory exists if using local SQLite
if "sqlite" in settings.DATABASE_URL:
    db_path = settings.DATABASE_URL.replace("sqlite+aiosqlite:///", "")
    parent_dir = Path(db_path).parent
    if parent_dir and not parent_dir.exists():
        parent_dir.mkdir(parents=True, exist_ok=True)

# Engine configuration
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG and False,
    future=True,
)

# Async session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for obtaining an asynchronous database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database tables and sync persistence state."""
    # Import all models here so they register with Base.metadata
    import strata_api.models  # noqa: F401
    from strata_api.core.persistence import load_all_from_db

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Sync any persisted entities from database into runtime
    load_all_from_db()
