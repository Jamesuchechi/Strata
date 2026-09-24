"""Acceptance tests for Phase A6: Rate Limiting & Abuse Prevention.

Verifies:
1. /auth/login rate limit: 5 requests/minute per IP, 6th returns 429 with Retry-After.
2. /auth/register rate limit: 3 requests/minute per IP, 4th returns 429 with Retry-After.
3. /auth/forgot-password rate limit: 3 requests/minute per IP, 4th returns 429 with Retry-After.
4. /auth/magic-link rate limit: 3 requests/minute per IP, 4th returns 429 with Retry-After.
5. Plan-based query limits on /api/query: Free tier enforcement and Pro tier quota.
6. IP isolation: Requests from different client IPs maintain separate rate limit buckets.
"""

import pytest
from fastapi.testclient import TestClient
from strata_api.main import app
from strata_api.core.rate_limiter import reset_rate_limiter, limiter, PLAN_LIMITS
from tests.conftest import AUTH_HEADERS_A, TEST_USER_A_ID


@pytest.fixture(autouse=True)
def clean_rate_limits():
    """Ensure a clean rate limit state before each test."""
    reset_rate_limiter()
    yield
    reset_rate_limiter()


def test_auth_login_rate_limiting_exceeded_returns_429():
    """Verify exceeding limit on /api/auth/login returns 429 with Retry-After header."""
    client = TestClient(app)
    headers = {"X-Forwarded-For": "198.51.100.10"}

    # Limit is 5 requests per minute
    for i in range(5):
        res = client.post(
            "/api/auth/login",
            json={"email": "wrong@example.com", "password": "wrongpassword"},
            headers=headers,
        )
        assert res.status_code == 401, f"Attempt {i+1} should fail auth but not be rate limited"

    # 6th attempt should be blocked by rate limiter
    res_blocked = client.post(
        "/api/auth/login",
        json={"email": "wrong@example.com", "password": "wrongpassword"},
        headers=headers,
    )
    assert res_blocked.status_code == 429
    assert "Retry-After" in res_blocked.headers
    retry_after = int(res_blocked.headers["Retry-After"])
    assert retry_after > 0
    assert "Rate limit exceeded" in res_blocked.json()["detail"]


def test_auth_login_rate_limiting_isolated_by_ip():
    """Verify rate limits are partitioned by client IP address."""
    client = TestClient(app)
    ip_a = {"X-Forwarded-For": "198.51.100.21"}
    ip_b = {"X-Forwarded-For": "198.51.100.22"}

    # Exhaust limit for IP A
    for _ in range(5):
        client.post("/api/auth/login", json={"email": "a@example.com", "password": "pwd"}, headers=ip_a)

    blocked_a = client.post("/api/auth/login", json={"email": "a@example.com", "password": "pwd"}, headers=ip_a)
    assert blocked_a.status_code == 429

    # IP B should still be allowed
    allowed_b = client.post("/api/auth/login", json={"email": "b@example.com", "password": "pwd"}, headers=ip_b)
    assert allowed_b.status_code == 401  # Not rate limited (429), just failed credentials


def test_auth_register_rate_limiting_3_per_minute():
    """Verify /api/auth/register allows 3 requests/minute per IP and blocks on 4th."""
    client = TestClient(app)
    headers = {"X-Forwarded-For": "198.51.100.30"}

    for i in range(3):
        res = client.post(
            "/api/auth/register",
            json={
                "email": f"reg_user_{i}@example.com",
                "password": "Password123!",
                "full_name": f"User {i}",
            },
            headers=headers,
        )
        assert res.status_code in (201, 400), f"Attempt {i+1} should not be rate limited"

    # 4th attempt should return 429
    res_blocked = client.post(
        "/api/auth/register",
        json={
            "email": "reg_user_overflow@example.com",
            "password": "Password123!",
            "full_name": "User Overflow",
        },
        headers=headers,
    )
    assert res_blocked.status_code == 429
    assert "Retry-After" in res_blocked.headers
    assert int(res_blocked.headers["Retry-After"]) >= 1


def test_auth_forgot_password_rate_limiting_3_per_minute():
    """Verify /api/auth/forgot-password allows 3 requests/minute per IP and blocks on 4th."""
    client = TestClient(app)
    headers = {"X-Forwarded-For": "198.51.100.40"}

    for _ in range(3):
        res = client.post(
            "/api/auth/forgot-password",
            json={"email": "user@example.com"},
            headers=headers,
        )
        assert res.status_code == 200

    # 4th attempt must be 429
    res_blocked = client.post(
        "/api/auth/forgot-password",
        json={"email": "user@example.com"},
        headers=headers,
    )
    assert res_blocked.status_code == 429
    assert "Retry-After" in res_blocked.headers


def test_auth_magic_link_rate_limiting_3_per_minute():
    """Verify /api/auth/magic-link allows 3 requests/minute per IP and blocks on 4th."""
    client = TestClient(app)
    headers = {"X-Forwarded-For": "198.51.100.50"}

    for _ in range(3):
        res = client.post(
            "/api/auth/magic-link",
            json={"email": "magic@example.com"},
            headers=headers,
        )
        assert res.status_code == 200

    # 4th attempt must be 429
    res_blocked = client.post(
        "/api/auth/magic-link",
        json={"email": "magic@example.com"},
        headers=headers,
    )
    assert res_blocked.status_code == 429
    assert "Retry-After" in res_blocked.headers


def test_plan_based_query_rate_limiting():
    """Verify per-plan query rate limits on /api/query."""
    client = TestClient(app)
    user_key = f"query:{TEST_USER_A_ID}"

    # Verify query works normally under limit
    res = client.post(
        "/api/query",
        json={"sql": "SELECT 1 + 1 AS result;"},
        headers=AUTH_HEADERS_A,
    )
    assert res.status_code == 200
    assert res.json()["data"][0]["result"] == 2

    # Simulate hitting the query limit for Free plan (100 queries/hr)
    free_limit = PLAN_LIMITS["free"]["queries_per_hour"]
    # Fill the sliding window bucket directly to test boundary
    limiter.reset(user_key)
    for _ in range(free_limit):
        allowed, _, _ = limiter.check_rate_limit(user_key, free_limit, 3600)
        assert allowed is True

    # The 101st query must now be rejected with 429
    res_blocked = client.post(
        "/api/query",
        json={"sql": "SELECT 1 + 1 AS result;"},
        headers=AUTH_HEADERS_A,
    )
    assert res_blocked.status_code == 429
    assert "Retry-After" in res_blocked.headers
    assert "queries/hour" in res_blocked.json()["detail"]
