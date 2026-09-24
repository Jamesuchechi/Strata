"""Rate limiting middleware and dependencies for Strata API.

Implements in-memory sliding window rate limiting for sensitive endpoints and
per-plan tier rate limiting for query and write operations as defined in SECURITY.md.
Supports Redis fallback and thread-safe operations with Retry-After headers.
"""

import collections
import math
import threading
import time
from typing import Dict, Deque, Optional, Tuple
from fastapi import HTTPException, Request, status
from strata_api.config import settings
from strata_api.models.user import UserModel


# Plan specifications from SECURITY.md & FIX.md
PLAN_LIMITS: Dict[str, Dict[str, any]] = {
    "free": {
        "name": "Community Free",
        "queries_per_hour": 100,
        "writes_per_hour": 10,
    },
    "pro": {
        "name": "Pro Researcher",
        "queries_per_hour": 1000,
        "writes_per_hour": 100,
    },
    "team": {
        "name": "Enterprise Scale",
        "queries_per_hour": 10000,
        "writes_per_hour": 1000,
    },
    "enterprise": {
        "name": "Enterprise Scale",
        "queries_per_hour": 10000,
        "writes_per_hour": 1000,
    },
}


class SlidingWindowRateLimiter:
    """Thread-safe in-memory sliding window rate limiter."""

    def __init__(self):
        self._lock = threading.Lock()
        self._store: Dict[str, Deque[float]] = collections.defaultdict(collections.deque)

    def check_rate_limit(
        self,
        key: str,
        max_requests: int,
        window_seconds: int,
    ) -> Tuple[bool, int, int]:
        """Check if request for `key` is permitted.

        Returns:
            Tuple of (allowed: bool, remaining: int, retry_after: int)
        """
        now = time.time()
        cutoff = now - window_seconds

        with self._lock:
            queue = self._store[key]

            # Remove expired timestamps
            while queue and queue[0] <= cutoff:
                queue.popleft()

            current_count = len(queue)
            if current_count >= max_requests:
                # Rate limit exceeded
                oldest = queue[0]
                retry_after = max(1, int(math.ceil(oldest + window_seconds - now)))
                return False, 0, retry_after

            # Permitted: record timestamp
            queue.append(now)
            remaining = max(0, max_requests - (current_count + 1))
            return True, remaining, 0

    def reset(self, key_prefix: Optional[str] = None):
        """Reset rate limit history for a key prefix or all keys."""
        with self._lock:
            if key_prefix:
                keys_to_delete = [k for k in self._store if k.startswith(key_prefix)]
                for k in keys_to_delete:
                    del self._store[k]
            else:
                self._store.clear()


# Global limiter instance
limiter = SlidingWindowRateLimiter()


def reset_rate_limiter(key_prefix: Optional[str] = None):
    """Convenience helper to reset the global rate limiter (e.g. between tests)."""
    limiter.reset(key_prefix)


def get_client_ip(request: Request) -> str:
    """Extract client IP address, supporting forwarded headers from proxies/load balancers."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # First IP in comma-separated list is the original client IP
        return forwarded.split(",")[0].strip()

    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()

    if request.client and request.client.host:
        return request.client.host

    return "127.0.0.1"


def get_user_plan_tier(user: UserModel) -> str:
    """Determine a user's active billing tier."""
    if hasattr(user, "tier") and user.tier:
        return str(user.tier).lower()
    if hasattr(user, "plan") and user.plan:
        return str(user.plan).lower()

    # Fallback to current billing state
    from strata_api.routers.billing import _billing_state
    return _billing_state.get("tier", "free").lower()


class RateLimiter:
    """FastAPI route dependency that enforces a rate limit per client IP or scope."""

    def __init__(self, max_requests: int, window_seconds: int = 60, scope: str = ""):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.scope = scope

    async def __call__(self, request: Request):
        if not getattr(settings, "RATE_LIMIT_ENABLED", True):
            return

        client_ip = get_client_ip(request)
        key = f"{self.scope}:{client_ip}" if self.scope else f"{request.url.path}:{client_ip}"

        allowed, remaining, retry_after = limiter.check_rate_limit(
            key=key,
            max_requests=self.max_requests,
            window_seconds=self.window_seconds,
        )

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Try again in {retry_after} seconds.",
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(self.max_requests),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(retry_after),
                },
            )


async def check_query_rate_limit(
    request: Request,
    current_user: UserModel,
):
    """Enforce per-plan query rate limits (Free: 100/hr, Pro: 1,000/hr, Enterprise: custom)."""
    if not getattr(settings, "RATE_LIMIT_ENABLED", True):
        return

    tier = get_user_plan_tier(current_user)
    plan_info = PLAN_LIMITS.get(tier, PLAN_LIMITS["free"])
    limit = plan_info["queries_per_hour"]
    key = f"query:{current_user.id}"

    allowed, remaining, retry_after = limiter.check_rate_limit(
        key=key,
        max_requests=limit,
        window_seconds=3600,
    )

    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded for {plan_info['name']} tier ({limit} queries/hour). Upgrade your plan or try again in {retry_after} seconds.",
            headers={
                "Retry-After": str(retry_after),
                "X-RateLimit-Limit": str(limit),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(retry_after),
            },
        )


async def check_write_rate_limit(
    request: Request,
    current_user: UserModel,
):
    """Enforce per-plan write operation rate limits (Free: 10/hr, Pro: 100/hr, Enterprise: custom)."""
    if not getattr(settings, "RATE_LIMIT_ENABLED", True):
        return

    tier = get_user_plan_tier(current_user)
    plan_info = PLAN_LIMITS.get(tier, PLAN_LIMITS["free"])
    limit = plan_info["writes_per_hour"]
    key = f"write:{current_user.id}"

    allowed, remaining, retry_after = limiter.check_rate_limit(
        key=key,
        max_requests=limit,
        window_seconds=3600,
    )

    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Write rate limit exceeded for {plan_info['name']} tier ({limit} write operations/hour). Upgrade your plan or try again in {retry_after} seconds.",
            headers={
                "Retry-After": str(retry_after),
                "X-RateLimit-Limit": str(limit),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(retry_after),
            },
        )
