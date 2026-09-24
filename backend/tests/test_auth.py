import uuid
import pytest
from fastapi.testclient import TestClient
from strata_api.main import app


@pytest.fixture(scope="module")
def client():
    """Create test client with lifespan context."""
    with TestClient(app) as c:
        yield c


def test_auth_registration_and_login_flow(client: TestClient):
    """Test full cycle: register -> login -> get me -> verify tokens."""
    uid = uuid.uuid4().hex[:8]
    test_email = f"ada.{uid}@strata.ai"
    test_password = "StrataSecurePassword123!"

    # 1. Register new user
    register_payload = {
        "email": test_email,
        "full_name": "Ada Lovelace",
        "password": test_password,
        "role": "data_scientist",
    }
    reg_res = client.post("/api/auth/register", json=register_payload)
    assert reg_res.status_code == 201, reg_res.text
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    assert reg_data["user"]["email"] == test_email
    assert reg_data["user"]["role"] == "data_scientist"
    assert reg_data["user"]["full_name"] == "Ada Lovelace"

    token = reg_data["access_token"]

    # 2. Duplicate registration fails
    dup_res = client.post("/api/auth/register", json=register_payload)
    assert dup_res.status_code == 400
    assert "already exists" in dup_res.json()["detail"]

    # 3. Successful login
    login_res = client.post(
        "/api/auth/login",
        json={"email": test_email, "password": test_password, "remember_me": True},
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "access_token" in login_data
    assert login_data["user"]["email"] == test_email

    # 4. Failed login with invalid password
    bad_login_res = client.post(
        "/api/auth/login",
        json={"email": test_email, "password": "WrongPassword999!"},
    )
    assert bad_login_res.status_code == 401

    # 5. Access /me with valid Bearer token
    me_res = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["email"] == test_email
    assert me_data["full_name"] == "Ada Lovelace"

    # 6. Access /me with missing or malformed token
    client.cookies.clear()
    unauth_res = client.get("/api/auth/me")
    assert unauth_res.status_code == 401

    bad_token_res = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalid.fake.token"},
    )
    assert bad_token_res.status_code == 401


def test_magic_link_flow(client: TestClient):
    """Test requesting a passwordless magic login link without leaking token."""
    from strata_api.core.email import get_latest_token_for_email

    uid = uuid.uuid4().hex[:8]
    email = f"alan.{uid}@strata.ai"
    magic_res = client.post(
        "/api/auth/magic-link",
        json={"email": email},
    )
    assert magic_res.status_code == 200
    data = magic_res.json()
    assert data["status"] == "success"
    # Credentials / tokens must never appear in unauthenticated response
    assert "demo_link" not in data
    assert "token" not in data
    # Token was dispatched via email service on the server side
    server_token = get_latest_token_for_email(email, "magic_link")
    assert server_token is not None


def test_forgot_and_reset_password_flow(client: TestClient):
    """Test requesting a password reset and updating password without leaking credentials."""
    from strata_api.core.email import get_latest_token_for_email

    uid = uuid.uuid4().hex[:8]
    user_email = f"katherine.{uid}@strata.ai"
    initial_pw = "InitialSecret123!"
    new_pw = "NewSuperSecret456!"

    # Register user first
    reg = client.post(
        "/api/auth/register",
        json={
            "email": user_email,
            "full_name": "Katherine Johnson",
            "password": initial_pw,
        },
    )
    assert reg.status_code == 201

    # Request reset link
    forgot_res = client.post(
        "/api/auth/forgot-password",
        json={"email": user_email},
    )
    assert forgot_res.status_code == 200
    body = forgot_res.json()
    # Ensure credential token is NEVER returned in client response
    assert "demo_token" not in body
    assert "token" not in body

    # Retrieve dispatched token from server-side email service
    reset_token = get_latest_token_for_email(user_email, "reset_password")
    assert reset_token is not None

    # Perform reset with token
    reset_res = client.post(
        "/api/auth/reset-password",
        json={"token": reset_token, "new_password": new_pw},
    )
    assert reset_res.status_code == 200

    # Old password no longer works
    fail_login = client.post(
        "/api/auth/login",
        json={"email": user_email, "password": initial_pw},
    )
    assert fail_login.status_code == 401

    # New password succeeds
    success_login = client.post(
        "/api/auth/login",
        json={"email": user_email, "password": new_pw},
    )
    assert success_login.status_code == 200
