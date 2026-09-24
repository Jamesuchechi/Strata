"""Acceptance tests for A4: Prevent credential and token leakage in API responses."""

import re
import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from strata_api.main import app
from strata_api.core.email import get_latest_token_for_email, clear_dispatched_emails


JWT_REGEX = re.compile(r"^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$")


@pytest.mark.asyncio
async def test_magic_link_does_not_leak_credentials():
    """Acceptance test: /api/auth/magic-link response never contains demo_link or usable tokens."""
    clear_dispatched_emails()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        test_email = f"test_leak_{uuid.uuid4().hex[:6]}@example.com"
        res = await client.post("/api/auth/magic-link", json={"email": test_email})
        assert res.status_code == 200
        data = res.json()

        # Verify no token or link fields exist in response
        assert "demo_link" not in data
        assert "demo_token" not in data
        assert "token" not in data
        assert "magic_token" not in data

        # Check all values in the JSON response to ensure no JWT token is leaked anywhere
        for val in data.values():
            if isinstance(val, str) and len(val) > 20:
                assert not JWT_REGEX.match(val), f"JWT token leaked in response field: {val}"

        # Verify token was securely recorded server-side
        dispatched_token = get_latest_token_for_email(test_email, "magic_link")
        assert dispatched_token is not None


@pytest.mark.asyncio
async def test_forgot_password_does_not_leak_credentials():
    """Acceptance test: /api/auth/forgot-password response never contains demo_token or usable tokens."""
    clear_dispatched_emails()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # First register an account
        test_email = f"user_{uuid.uuid4().hex[:6]}@example.com"
        reg_res = await client.post(
            "/api/auth/register",
            json={
                "email": test_email,
                "full_name": "Security Test User",
                "password": "SecurePassword123!",
            },
        )
        assert reg_res.status_code == 201

        # Request password reset
        res = await client.post("/api/auth/forgot-password", json={"email": test_email})
        assert res.status_code == 200
        data = res.json()

        # Verify no token fields exist in response
        assert "demo_token" not in data
        assert "demo_link" not in data
        assert "token" not in data
        assert "reset_token" not in data

        # Check all values to ensure no JWT token is leaked anywhere
        for val in data.values():
            if isinstance(val, str) and len(val) > 20:
                assert not JWT_REGEX.match(val), f"JWT token leaked in response field: {val}"

        # Verify token was securely recorded server-side
        dispatched_token = get_latest_token_for_email(test_email, "reset_password")
        assert dispatched_token is not None

        # Verify password can be reset with the securely delivered token
        reset_res = await client.post(
            "/api/auth/reset-password",
            json={"token": dispatched_token, "new_password": "BrandNewPassword456!"},
        )
        assert reset_res.status_code == 200

        # Verify old password fails and new password succeeds
        fail_login = await client.post(
            "/api/auth/login",
            json={"email": test_email, "password": "SecurePassword123!"},
        )
        assert fail_login.status_code == 401

        success_login = await client.post(
            "/api/auth/login",
            json={"email": test_email, "password": "BrandNewPassword456!"},
        )
        assert success_login.status_code == 200


@pytest.mark.asyncio
async def test_forgot_password_nonexistent_email_does_not_leak_enumeration():
    """Verify non-existent emails return the same generic message and no tokens."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/auth/forgot-password", json={"email": "nonexistent_random_user@domain.com"})
        assert res.status_code == 200
        data = res.json()
        assert "demo_token" not in data
        assert "token" not in data
        assert data["status"] == "success"
