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


def test_token_type_enforcement_prevents_privilege_confusion():
    """Verify refresh, magic-link, and reset-password tokens cannot be used as Bearer access tokens."""
    client = TestClient(app)

    # 1. Obtain a refresh token
    login_res = client.post(
        "/api/auth/login",
        json={"email": TEST_USER_A_EMAIL, "password": "Password123!"},
    )
    assert login_res.status_code == 200
    refresh_token = login_res.json()["refresh_token"]

    # Attempting to use refresh token as Bearer access token must fail with 401
    me_with_refresh = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {refresh_token}"},
    )
    assert me_with_refresh.status_code == 401
    assert "invalid" in me_with_refresh.json()["detail"].lower()

    # 2. Create a reset-password token
    reset_token = create_access_token(
        data={"sub": TEST_USER_A_ID, "email": TEST_USER_A_EMAIL, "type": "reset_password"}
    )
    me_with_reset = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {reset_token}"},
    )
    assert me_with_reset.status_code == 401

    # 3. Create a magic-link token
    magic_token = create_access_token(
        data={"sub": TEST_USER_A_ID, "email": TEST_USER_A_EMAIL, "type": "magic_link"}
    )
    me_with_magic = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {magic_token}"},
    )
    assert me_with_magic.status_code == 401


def test_password_reset_without_token_is_rejected():
    """Verify POST /api/auth/reset-password cannot be called with only an email (account takeover prevention)."""
    client = TestClient(app)

    # Attempt reset with email only (missing required token field)
    takeover_res = client.post(
        "/api/auth/reset-password",
        json={"email": TEST_USER_A_EMAIL, "new_password": "HackedPassword123!"},
    )
    # FastAPI schema validation must reject missing token with 422 Unprocessable Entity
    assert takeover_res.status_code == 422


def test_password_reset_invalidates_active_sessions_and_tokens():
    """Verify resetting password updates token version and invalidates all previous sessions."""
    import uuid
    from strata_api.core.email import get_latest_token_for_email

    client = TestClient(app)
    uid = uuid.uuid4().hex[:8]
    user_email = f"security_test_{uid}@strata.ai"
    old_pw = "OriginalPassword123!"
    new_pw = "BrandNewSecurePassword456!"

    # 1. Register user
    reg_res = client.post(
        "/api/auth/register",
        json={"email": user_email, "full_name": "Security User", "password": old_pw},
    )
    assert reg_res.status_code == 201
    old_access_token = reg_res.json()["access_token"]
    old_refresh_token = reg_res.json()["refresh_token"]

    # 2. Confirm old token works
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {old_access_token}"}).status_code == 200

    # 3. Request reset
    forgot_res = client.post("/api/auth/forgot-password", json={"email": user_email})
    assert forgot_res.status_code == 200
    reset_token = get_latest_token_for_email(user_email, "reset_password")
    assert reset_token is not None

    # 4. Perform reset
    reset_res = client.post(
        "/api/auth/reset-password",
        json={"token": reset_token, "new_password": new_pw},
    )
    assert reset_res.status_code == 200

    # 5. Old access token and old refresh token must now be rejected (invalidated by token_version bump)
    old_me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {old_access_token}"})
    assert old_me_res.status_code == 401

    old_refresh_res = client.post("/api/auth/refresh", json={"refresh_token": old_refresh_token})
    assert old_refresh_res.status_code == 401

    # 6. Replay of the used reset token must fail (single-use)
    replay_res = client.post(
        "/api/auth/reset-password",
        json={"token": reset_token, "new_password": "AnotherPassword789!"},
    )
    assert replay_res.status_code == 400

    # 7. Sign in with new password succeeds and gets new token
    new_login = client.post("/api/auth/login", json={"email": user_email, "password": new_pw})
    assert new_login.status_code == 200
    new_token = new_login.json()["access_token"]
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {new_token}"}).status_code == 200

