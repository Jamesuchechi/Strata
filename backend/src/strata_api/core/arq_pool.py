"""ARQ connection pool management.

The pool is created once at FastAPI startup and shared across all request
handlers that need to enqueue background jobs.  If Redis is unreachable at
startup the pool is left as ``None`` — endpoints that require it will return
HTTP 503, keeping the rest of the app fully functional.
"""

from __future__ import annotations

import logging
from typing import Optional

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings

from strata_api.config import settings

logger = logging.getLogger(__name__)

# Module-level singleton — set by ``init_arq_pool`` at startup.
_arq_pool: Optional[ArqRedis] = None


def _redis_settings_from_url(url: str) -> RedisSettings:
    """Parse ``redis://host:port/db`` into ``RedisSettings``."""
    import re
    m = re.match(
        r"redis://(?:(?P<user>[^:@]*)(?::(?P<password>[^@]*))?@)?"
        r"(?P<host>[^:/]+)(?::(?P<port>\d+))?(?:/(?P<db>\d+))?",
        url,
    )
    if not m:
        return RedisSettings()
    return RedisSettings(
        host=m.group("host") or "localhost",
        port=int(m.group("port") or 6379),
        database=int(m.group("db") or 0),
        password=m.group("password") or None,
    )


async def init_arq_pool() -> None:
    """Create the ARQ Redis pool.  Called from FastAPI's ``lifespan`` hook."""
    global _arq_pool
    try:
        _arq_pool = await create_pool(_redis_settings_from_url(settings.REDIS_URL))
        logger.info("ARQ pool connected to Redis at %s", settings.REDIS_URL)
    except Exception as exc:
        logger.warning(
            "Could not connect to Redis (%s). "
            "Background jobs will be unavailable — start Redis to enable them.",
            exc,
        )
        _arq_pool = None


async def close_arq_pool() -> None:
    """Close the ARQ pool.  Called from FastAPI's ``lifespan`` hook."""
    global _arq_pool
    if _arq_pool is not None:
        try:
            await _arq_pool.aclose()
        except Exception as exc:
            logger.warning("Error closing ARQ pool: %s", exc)
        _arq_pool = None


def get_arq_pool() -> Optional[ArqRedis]:
    """Return the active ARQ pool, or ``None`` if Redis is unavailable."""
    return _arq_pool
