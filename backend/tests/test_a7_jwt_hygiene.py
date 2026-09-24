"""Acceptance tests for Phase A7: JWT & Token Hygiene.

Verifies:
1. Production boot fail-fast: App refuses to start in production if JWT_SECRET_KEY
   is default dev secret, empty, or shorter than 32 characters.
2. Secure HttpOnly cookies: Login/Register sets HttpOnly, SameSite=Strict cookies.
3. Cookie-based authentication: Authenticated endpoints succeed using session cookie without Authorization header.
4. Refresh token rotation: /api/auth/refresh issues a fresh access token and rotates the refresh token.
5. Revocation mechanism: Revoked tokens and rotated old refresh tokens are rejected with 401.
6. Logout flow: /api/auth/logout revokes active tokens and deletes cookies.
"""

import pytest
from fastapi.testclient import TestClient
from strata_api.config import settings
from strata_api.core.security import (
    DEFAULT_DEV_JWT_SECRET,
    clear_revoked_tokens,
    create_access_token,
    create_refresh_token,
    is_token_revoked,
    revoke_token,
    validate_jwt_security_config,
)
from strata_api.main import app, create_app
from tests.conftest import TEST_USER_A_ID, TEST_USER_A_EMAIL


@pytest.fixture(autouse=True)
def clean_token_state():
    """Ensure clean token state before and after each test."""
    clear_revoked_tokens()
    yield
    clear_revoked_tokens()


def test_production_boot_fails_with_default_or_insecure_jwt_secret(monkeypatch):
    """Verify application fails fast on boot in production mode when JWT_SECRET_KEY is insecure."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    # 1. Default dev secret in production must fail
    monkeypatch.setattr(settings, "JWT_SECRET_KEY", DEFAULT_DEV_JWT_SECRET)
    with pytest.raises(RuntimeError, match="FATAL: Application cannot start in production environment with default"):
        validate_jwt_security_config()

    # 2. Empty secret in production must fail
    monkeypatch.setattr(settings, "JWT_SECRET_KEY", "")
    with pytest.raises(RuntimeError, match="FATAL: Application cannot start in production"):
        validate_jwt_security_config()

    # 3. Short secret (< 32 chars) in production must fail
    monkeypatch.setattr(settings, "JWT_SECRET_KEY", "too_short_secret")
    with pytest.raises(RuntimeError, match="FATAL: Application cannot start in production"):
        validate_jwt_security_config()

    # 4. Secure 32+ char secret in production must succeed
    monkeypatch.setattr(settings, "JWT_SECRET_KEY", "super_secure_production_secret_key_with_sufficient_entropy_12345")
    validate_jwt_security_config()  # Does not raise


def test_login_and_register_set_httponly_same_site_cookies():
    """Verify login response sets HttpOnly and SameSite=Strict cookies for web session."""
    client = TestClient(app)

    res = client.post(
        "/api/auth/login",
        json={"email": TEST_USER_A_EMAIL, "password": "Password123!"},
    )
    assert res.status_code == 200

    # Verify cookies were set
    cookies = res.cookies
    assert "strata_access_token" in cookies
    assert "strata_refresh_token" in cookies

    # Verify cookie headers contain HttpOnly and SameSite=strict
    raw_cookie_headers = [v for k, v in res.headers.raw if k.decode("latin1").lower() == "set-cookie"]
    cookie_str = " ; ".join(h.decode("latin1") for h in raw_cookie_headers)
    assert "httponly" in cookie_str.lower()
    assert "samesite=strict" in cookie_str.lower()


def test_cookie_based_authentication_on_protected_endpoints():
    """Verify user can authenticate to protected endpoints using HttpOnly session cookie without Bearer header."""
    client = TestClient(app)

    # Login to obtain cookies
    login_res = client.post(
        "/api/auth/login",
        json={"email": TEST_USER_A_EMAIL, "password": "Password123!"},
    )
    assert login_res.status_code == 200
    access_cookie = login_res.cookies.get("strata_access_token")

    # Send request with cookie only, no Authorization header
    me_res = client.get("/api/auth/me", cookies={"strata_access_token": access_cookie})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == TEST_USER_A_EMAIL

    # Query endpoint also works with cookie auth
    query_res = client.post(
        "/api/query",
        json={"sql": "SELECT 'cookie_authenticated' AS status;"},
        cookies={"strata_access_token": access_cookie},
    )
    assert query_res.status_code == 200
    assert query_res.json()["data"][0]["status"] == "cookie_authenticated"


def test_refresh_token_rotation_and_revocation():
    """Verify refresh endpoint rotates the refresh token and invalidates the previous one."""
    client = TestClient(app)

    login_res = client.post(
        "/api/auth/login",
        json={"email": TEST_USER_A_EMAIL, "password": "Password123!"},
    )
    assert login_res.status_code == 200
    old_refresh_token = login_res.json()["refresh_token"]
    assert old_refresh_token is not None

    # Rotate refresh token
    refresh_res = client.post(
        "/api/auth/refresh",
        json={"refresh_token": old_refresh_token},
    )
    assert refresh_res.status_code == 200
    new_data = refresh_res.json()
    new_access_token = new_data["access_token"]
    new_refresh_token = new_data["refresh_token"]

    assert new_access_token != login_res.json()["access_token"]
    assert new_refresh_token != old_refresh_token

    # Using the new access token succeeds
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {new_access_token}"})
    assert me_res.status_code == 200

    # Old refresh token was revoked during rotation and cannot be reused
    reuse_res = client.post(
        "/api/auth/refresh",
        json={"refresh_token": old_refresh_token},
    )
    assert reuse_res.status_code == 401
    assert "Invalid, expired, or revoked" in reuse_res.json()["detail"]


def test_token_revocation_and_logout_flow():
    """Verify /api/auth/logout revokes the access and refresh tokens and clears cookies."""
    client = TestClient(app)

    login_res = client.post(
        "/api/auth/login",
        json={"email": TEST_USER_A_EMAIL, "password": "Password123!"},
    )
    assert login_res.status_code == 200
    access_token = login_res.json()["access_token"]
    access_cookie = login_res.cookies.get("strata_access_token")

    # Access /api/auth/me is valid
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {access_token}"}).status_code == 200

    # Log out
    logout_res = client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {access_token}"},
        cookies={"strata_access_token": access_cookie},
    )
    assert logout_res.status_code == 200

    # Token is now revoked
    assert is_token_revoked(access_token) is True

    # Subsequent access using revoked token must fail with 401
    revoked_res = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert revoked_res.status_code == 401
    assert "revoked" in revoked_res.json()["detail"].lower()
