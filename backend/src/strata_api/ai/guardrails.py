"""Cost, latency guardrails, caching, and daily LLM quota enforcement."""

import hashlib
import json
import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from fastapi import HTTPException
from sqlalchemy import select
from strata_api.config import settings
from strata_api.core.database import AsyncSessionLocal
from strata_api.models.llm_usage import LLMUsageModel

logger = logging.getLogger(__name__)


class LLMResponseCache:
    """In-memory TTL response cache for (dataset_version/view, question) pairs."""

    def __init__(self, default_ttl_seconds: Optional[int] = None):
        self.default_ttl = default_ttl_seconds or settings.LLM_CACHE_TTL_SECONDS
        self._cache: Dict[str, Dict[str, Any]] = {}

    def make_key(self, dataset_or_view: str, question: str) -> str:
        """Create a deterministic SHA-256 cache key from dataset identity and question."""
        normalized = f"{dataset_or_view.strip().lower()}::{question.strip().lower()}"
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    def get(self, key: str) -> Optional[Dict[str, Any]]:
        """Retrieve cached response if present and unexpired."""
        entry = self._cache.get(key)
        if not entry:
            return None
        if time.time() > entry["expires_at"]:
            del self._cache[key]
            return None
        logger.info("LLM cache HIT for key %s (will not count against daily usage cap)", key[:12])
        return entry["data"]

    def set(self, key: str, data: Dict[str, Any], ttl_seconds: Optional[int] = None) -> None:
        """Cache response data with expiration timestamp."""
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl
        self._cache[key] = {
            "data": data,
            "expires_at": time.time() + ttl,
        }
        logger.debug("Cached LLM response with TTL %ss for key %s", ttl, key[:12])

    def clear(self) -> None:
        """Clear all cached entries."""
        self._cache.clear()


class DailyLLMQuotaManager:
    """Manages daily LLM call limits and tracks persistent usage in llm_usage table."""

    def __init__(self):
        self._mem_counters: Dict[str, int] = {}

    def get_tier_cap(self, plan_tier: str) -> int:
        """Get the configured daily call cap for a given plan tier."""
        tier = (plan_tier or "free").lower()
        if tier == "team":
            return settings.LLM_CAP_TEAM
        elif tier == "pro":
            return settings.LLM_CAP_PRO
        else:
            return settings.LLM_CAP_FREE

    def get_resets_at_iso(self) -> str:
        """Calculate next midnight UTC reset timestamp."""
        now = datetime.now(timezone.utc)
        midnight_utc = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        return midnight_utc.isoformat()

    def _get_date_utc(self):
        """Get current UTC date."""
        return datetime.now(timezone.utc).date()

    async def get_usage_and_limit(
        self,
        user_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        plan_tier: Optional[str] = "free",
    ) -> Dict[str, Any]:
        """Fetch current call count, limit, and reset timestamp for a user/workspace."""
        tier = (plan_tier or "free").lower()
        limit = self.get_tier_cap(tier)
        resets_at = self.get_resets_at_iso()
        today = self._get_date_utc()

        used = 0
        try:
            async with AsyncSessionLocal() as session:
                query = select(LLMUsageModel).where(
                    LLMUsageModel.date == today,
                )
                if tier == "team" and workspace_id:
                    query = query.where(LLMUsageModel.workspace_id == workspace_id)
                elif user_id:
                    query = query.where(LLMUsageModel.user_id == user_id)

                result = await session.execute(query)
                record = result.scalars().first()
                if record:
                    used = record.call_count
        except Exception as e:
            logger.debug("Database error fetching LLM usage, checking fallback: %s", e)
            mem_key = f"{user_id or workspace_id or 'anon'}:{today}"
            used = self._mem_counters.get(mem_key, 0)

        return {
            "used": used,
            "limit": limit,
            "remaining": max(0, limit - used),
            "resets_at": resets_at,
            "plan_tier": tier,
        }

    async def check_quota(
        self,
        user_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        plan_tier: Optional[str] = "free",
    ) -> None:
        """Check if current user/workspace is within quota. Raises HTTP 429 if exceeded."""
        tier = (plan_tier or "free").lower()
        usage_info = await self.get_usage_and_limit(user_id, workspace_id, tier)
        if usage_info["used"] >= usage_info["limit"]:
            logger.warning(
                "Daily LLM quota exceeded for user=%s, workspace=%s (used=%d, limit=%d)",
                user_id,
                workspace_id,
                usage_info["used"],
                usage_info["limit"],
            )
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Daily AI query limit exceeded",
                    "message": f"You have reached your daily quota of {usage_info['limit']} AI queries for the {tier.upper()} plan.",
                    "used": usage_info["used"],
                    "limit": usage_info["limit"],
                    "resets_at": usage_info["resets_at"],
                },
                headers={"Retry-After": "86400"},
            )

    async def record_call(
        self,
        user_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        plan_tier: Optional[str] = "free",
    ) -> int:
        """Atomically increment the call counter for today in the database."""
        today = self._get_date_utc()
        tier = (plan_tier or "free").lower()
        target_uid = user_id if (tier != "team" or not workspace_id) else None
        target_wsid = workspace_id if tier == "team" else None

        new_count = 1
        try:
            async with AsyncSessionLocal() as session:
                query = select(LLMUsageModel).where(
                    LLMUsageModel.date == today,
                )
                if target_wsid:
                    query = query.where(LLMUsageModel.workspace_id == target_wsid)
                elif target_uid:
                    query = query.where(LLMUsageModel.user_id == target_uid)

                result = await session.execute(query)
                record = result.scalars().first()

                if record:
                    record.call_count += 1
                    new_count = int(record.call_count)
                else:
                    record = LLMUsageModel(
                        user_id=target_uid,
                        workspace_id=target_wsid,
                        date=today,
                        call_count=1,
                    )
                    session.add(record)
                    new_count = 1

                await session.commit()
                logger.info("Recorded LLM usage: user=%s, count=%d for date=%s", target_uid, new_count, today)
                return int(new_count)
        except Exception as e:
            logger.debug("Database error recording LLM call, fallback to in-memory: %s", e)
            mem_key = f"{user_id or workspace_id or 'anon'}:{today}"
            self._mem_counters[mem_key] = self._mem_counters.get(mem_key, 0) + 1
            return self._mem_counters[mem_key]

    def reset_for_date(self, user_id: Optional[str] = None, date_val = None) -> None:
        """Reset usage (useful for testing or window rollover)."""
        today = date_val or self._get_date_utc()
        mem_key = f"{user_id or 'anon'}:{today}"
        if mem_key in self._mem_counters:
            del self._mem_counters[mem_key]


# Global singletons
llm_cache = LLMResponseCache()
quota_manager = DailyLLMQuotaManager()
