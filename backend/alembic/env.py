from logging.config import fileConfig
from sqlalchemy import create_engine, pool
from alembic import context

from strata_api.config import settings
from strata_api.core.database import Base
import strata_api.models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_sync_url() -> str:
    url = settings.DATABASE_URL
    # Convert async drivers to synchronous drivers for standard Alembic runners
    if "+aiosqlite" in url:
        url = url.replace("+aiosqlite", "")
    elif "+asyncpg" in url:
        url = url.replace("+asyncpg", "")
    return url


def run_migrations_offline() -> None:
    url = get_sync_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    sync_url = get_sync_url()
    connectable = create_engine(sync_url, poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
