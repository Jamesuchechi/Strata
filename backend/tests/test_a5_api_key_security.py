"""Acceptance tests for A5: Real API key validation, hashing, expiry, revocation, and SDK integration."""

import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from strata_api.main import app
from strata_api.core.security import (
    clear_api_keys,
    generate_api_key,
    revoke_api_key,
    verify_api_key,
)
from strata_sdk.client import StrataClient


@pytest.fixture(autouse=True)
def clean_keys():
    """Ensure clean API key state for each test."""
    clear_api_keys()
    yield
    clear_api_keys()


def test_verify_api_key_unit():
    """Verify verify_api_key is no longer a stub returning True unconditionally."""
    # 1. Non-existent and malformed keys must be rejected
    assert verify_api_key(None) is False
    assert verify_api_key("") is False
    assert verify_api_key("strata_live_fake_random_key_12345") is False

    # 2. Real generated key must pass
    raw_key, record = generate_api_key(user_id="user_123", name="Production API Key")
    assert raw_key.startswith("strata_live_")
    assert verify_api_key(raw_key) is True

    # 3. Revoked key must fail
    assert revoke_api_key(record["id"]) is True
    assert verify_api_key(raw_key) is False

    # 4. Expired key must fail
    expired_key, _ = generate_api_key(user_id="user_456", expires_in_days=-1)
    assert verify_api_key(expired_key) is False


@pytest.mark.asyncio
async def test_api_request_with_invalid_and_revoked_api_key_rejected():
    """Acceptance test: A request with an invalid or revoked API key is rejected with HTTP 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Register a user
        uid = uuid.uuid4().hex[:6]
        user_email = f"dev_{uid}@strata.ai"
        reg_res = await client.post(
            "/api/auth/register",
            json={
                "email": user_email,
                "full_name": "API Key Tester",
                "password": "StrongPassword123!",
            },
        )
        assert reg_res.status_code == 201
        user_id = reg_res.json()["user"]["id"]

        # 2. Request with invalid API key must return 401
        invalid_res = await client.get("/api/auth/me", headers={"X-API-Key": "strata_live_invalid_key_999"})
        assert invalid_res.status_code == 401
        assert "api key" in invalid_res.json()["detail"].lower()

        # 3. Request with valid API key succeeds with 200
        valid_key, key_rec = generate_api_key(user_id=user_id, name="Test Key")
        valid_res = await client.get("/api/auth/me", headers={"X-API-Key": valid_key})
        assert valid_res.status_code == 200
        assert valid_res.json()["email"] == user_email

        # 4. Also verify API key works in Authorization: Bearer <api_key> header
        bearer_key_res = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {valid_key}"})
        assert bearer_key_res.status_code == 200
        assert bearer_key_res.json()["email"] == user_email

        # 5. Revoking the key immediately causes subsequent requests to return 401
        revoke_api_key(key_rec["id"])
        revoked_res = await client.get("/api/auth/me", headers={"X-API-Key": valid_key})
        assert revoked_res.status_code == 401
        assert "api key" in revoked_res.json()["detail"].lower()

        # 6. Request with expired API key returns 401
        exp_key, _ = generate_api_key(user_id=user_id, expires_in_days=-5)
        exp_res = await client.get("/api/auth/me", headers={"X-API-Key": exp_key})
        assert exp_res.status_code == 401
        assert "api key" in exp_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_api_key_management_endpoints():
    """Verify creating, listing, and revoking API keys via /api/auth/api-keys."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Register user
        uid = uuid.uuid4().hex[:6]
        reg_res = await client.post(
            "/api/auth/register",
            json={
                "email": f"keymgr_{uid}@strata.ai",
                "full_name": "Key Manager",
                "password": "Password123!",
            },
        )
        assert reg_res.status_code == 201
        token = reg_res.json()["access_token"]
        auth_hdr = {"Authorization": f"Bearer {token}"}

        # 1. Create API key
        create_res = await client.post(
            "/api/auth/api-keys",
            json={"name": "CLI Automation Key", "expires_in_days": 60},
            headers=auth_hdr,
        )
        assert create_res.status_code == 200
        created = create_res.json()
        assert created["status"] == "success"
        raw_key = created["raw_key"]
        key_id = created["key"]["id"]
        assert raw_key.startswith("strata_live_")

        # 2. List API keys
        list_res = await client.get("/api/auth/api-keys", headers=auth_hdr)
        assert list_res.status_code == 200
        keys = list_res.json()["api_keys"]
        assert len(keys) == 1
        assert keys[0]["id"] == key_id
        assert keys[0]["name"] == "CLI Automation Key"
        assert keys[0]["is_revoked"] is False
        # Raw secret must NEVER be exposed in list response
        assert "raw_key" not in keys[0]
        assert "key_hash" not in keys[0]

        # 3. Test that the created key can authenticate
        key_auth_res = await client.get("/api/auth/me", headers={"X-API-Key": raw_key})
        assert key_auth_res.status_code == 200
        assert key_auth_res.json()["email"] == f"keymgr_{uid}@strata.ai"

        # 4. Revoke API key via endpoint
        del_res = await client.delete(f"/api/auth/api-keys/{key_id}", headers=auth_hdr)
        assert del_res.status_code == 200
        assert del_res.json()["status"] == "success"

        # 5. Key no longer authenticates
        post_revoke_res = await client.get("/api/auth/me", headers={"X-API-Key": raw_key})
        assert post_revoke_res.status_code == 401


def test_sdk_client_initialization_with_api_key():
    """Verify StrataClient wires api_key into headers."""
    client = StrataClient(base_url="http://test:8000/api", api_key="strata_live_test_12345")
    assert client.headers["X-API-Key"] == "strata_live_test_12345"
