"""Acceptance tests for Phase C3: Cost/latency guardrails, caching, and quota enforcement."""

import asyncio
import concurrent.futures
import datetime
from datetime import timezone
import pytest
from fastapi import HTTPException
from sqlalchemy import delete
from strata_api.ai.analyst import ConversationalAnalyst
from strata_api.ai.executor import QueryExecutor
from strata_api.ai.guardrails import DailyLLMQuotaManager, LLMResponseCache, llm_cache, quota_manager
from strata_api.core.database import AsyncSessionLocal
from strata_api.core.duckdb_engine import DuckDBEngine
from strata_api.models.llm_usage import LLMUsageModel
from strata_api.config import settings


class CountingMockProvider:
    """Mock provider that counts how many times complete() is called."""

    provider_name = "mock_provider"

    def __init__(self, response: str = '{"sql": "SELECT 1;", "explanation": "ok"}'):
        self.response = response
        self.call_count = 0

    async def complete(self, system: str, user: str, *, json_mode: bool = False, model: str = None) -> str:
        self.call_count += 1
        return self.response


def _sync_clean_llm_usage():
    async def _clean():
        try:
            async with AsyncSessionLocal() as session:
                await session.execute(delete(LLMUsageModel))
                await session.commit()
        except Exception:
            pass

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(lambda: asyncio.run(_clean()))
        future.result()


@pytest.fixture
def clean_guardrails():
    """Reset cache and database quotas before and after each test."""
    llm_cache.clear()
    quota_manager._mem_counters.clear()
    _sync_clean_llm_usage()
    yield
    llm_cache.clear()
    quota_manager._mem_counters.clear()
    _sync_clean_llm_usage()


@pytest.fixture
def mock_engine():
    engine = DuckDBEngine(":memory:")
    engine.conn.execute("CREATE TABLE test_data (id INTEGER, val VARCHAR); INSERT INTO test_data VALUES (1, 'alpha');")
    return engine


@pytest.mark.asyncio
async def test_c3_tier_caps_configuration():
    """Verify tier caps match default settings (Free=25, Pro=500, Team=2000)."""
    qm = DailyLLMQuotaManager()
    assert qm.get_tier_cap("free") == settings.LLM_CAP_FREE
    assert qm.get_tier_cap("pro") == settings.LLM_CAP_PRO
    assert qm.get_tier_cap("team") == settings.LLM_CAP_TEAM


@pytest.mark.asyncio
async def test_c3_hitting_cap_blocks_before_provider_is_invoked(clean_guardrails, mock_engine, monkeypatch):
    """When daily call limit is reached, further calls return 429 before invoking the provider."""
    # Set Free tier cap to 2 for fast test execution
    monkeypatch.setattr(settings, "LLM_CAP_FREE", 2)

    provider = CountingMockProvider('{"sql": "SELECT id, val FROM test_data;", "explanation": "test"}')
    executor = QueryExecutor(mock_engine)
    analyst = ConversationalAnalyst(executor, provider)

    # Call 1: should succeed
    res1 = await analyst.analyze(view_name="test_data", question="Q1", user_id="user-cap-123", plan_tier="free")
    assert res1["results"]["success"] is True
    assert provider.call_count == 1

    # Call 2: should succeed
    res2 = await analyst.analyze(view_name="test_data", question="Q2", user_id="user-cap-123", plan_tier="free")
    assert res2["results"]["success"] is True
    assert provider.call_count == 2

    # Call 3: cap is 2 -> must raise HTTP 429 and NOT invoke the provider
    with pytest.raises(HTTPException) as exc_info:
        await analyst.analyze(view_name="test_data", question="Q3", user_id="user-cap-123", plan_tier="free")

    assert exc_info.value.status_code == 429
    assert exc_info.value.detail["used"] >= 2
    assert exc_info.value.detail["limit"] == 2
    assert "resets_at" in exc_info.value.detail
    # Crucial assertion: provider must not have been invoked for call 3
    assert provider.call_count == 2


@pytest.mark.asyncio
async def test_c3_cache_hit_bypasses_quota_and_succeeds_even_when_cap_reached(clean_guardrails, mock_engine, monkeypatch):
    """A cache hit for identical (view/version, question) succeeds without calling provider or quota check."""
    monkeypatch.setattr(settings, "LLM_CAP_FREE", 1)

    provider = CountingMockProvider('{"sql": "SELECT id FROM test_data;", "explanation": "cached query"}')
    executor = QueryExecutor(mock_engine)
    analyst = ConversationalAnalyst(executor, provider)

    # Call 1: populates cache and uses the single available quota slot
    res1 = await analyst.analyze(
        view_name="test_data",
        question="What is the id?",
        user_id="user-cache-456",
        plan_tier="free",
        dataset_version="v1.0",
    )
    assert res1["results"]["success"] is True
    assert provider.call_count == 1

    # Call 2 with a new question: should fail with 429 (cap reached)
    with pytest.raises(HTTPException) as exc_429:
        await analyst.analyze(
            view_name="test_data",
            question="What is the val?",
            user_id="user-cache-456",
            plan_tier="free",
            dataset_version="v1.0",
        )
    assert exc_429.value.status_code == 429
    assert provider.call_count == 1

    # Call 3 with the identical original question: cache hit -> must succeed despite quota limit being reached!
    cached_res = await analyst.analyze(
        view_name="test_data",
        question="What is the id?",
        user_id="user-cache-456",
        plan_tier="free",
        dataset_version="v1.0",
    )
    assert cached_res["results"]["success"] is True
    assert cached_res["sql"] == "SELECT id FROM test_data;"
    # Provider was NOT invoked again
    assert provider.call_count == 1


@pytest.mark.asyncio
async def test_c3_daily_usage_reset_after_window(clean_guardrails, monkeypatch):
    """Usage count resets correctly for a new date window."""
    qm = DailyLLMQuotaManager()
    monkeypatch.setattr(settings, "LLM_CAP_FREE", 5)

    today = datetime.datetime.now(timezone.utc).date()
    tomorrow = today + datetime.timedelta(days=1)

    # Record 5 calls for today
    for _ in range(5):
        await qm.record_call(user_id="user-reset-test")

    # Check today's quota: should fail
    with pytest.raises(HTTPException) as exc_today:
        await qm.check_quota(user_id="user-reset-test", plan_tier="free")
    assert exc_today.value.status_code == 429

    # Simulate moving to tomorrow's date
    monkeypatch.setattr(qm, "_get_date_utc", lambda: tomorrow)

    # Tomorrow's usage should be 0, quota check must pass
    usage_info = await qm.get_usage_and_limit(user_id="user-reset-test", plan_tier="free")
    assert usage_info["used"] == 0
    assert usage_info["limit"] == 5
    # check_quota should not raise
    await qm.check_quota(user_id="user-reset-test", plan_tier="free")


@pytest.mark.asyncio
async def test_c3_team_workspace_pooled_quota(clean_guardrails):
    """Team tier limits are pooled per workspace."""
    qm = DailyLLMQuotaManager()

    # Two different users in the same team workspace
    await qm.record_call(user_id="user-A", workspace_id="ws-enterprise", plan_tier="team")
    await qm.record_call(user_id="user-B", workspace_id="ws-enterprise", plan_tier="team")

    usage_info = await qm.get_usage_and_limit(
        user_id="user-A",
        workspace_id="ws-enterprise",
        plan_tier="team",
    )

    assert usage_info["used"] == 2
    assert usage_info["limit"] == settings.LLM_CAP_TEAM
