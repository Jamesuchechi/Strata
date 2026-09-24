"""Authentication router for Strata API."""

from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from strata_api.config import settings
from strata_api.core.database import get_db
from strata_api.core.security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    generate_api_key,
    get_api_key_record,
    hash_password,
    is_token_revoked,
    list_api_keys_for_user,
    revoke_api_key,
    revoke_token,
    verify_api_key,
    verify_password,
)
from strata_api.core.rate_limiter import RateLimiter
from strata_api.models.user import UserModel
from strata_api.schemas.auth import (
    ForgotPasswordRequest,
    MagicLinkRequest,
    RefreshTokenRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)

auth_router = APIRouter(prefix="/auth", tags=["Authentication"])
security_bearer = HTTPBearer(auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: Optional[str] = None,
    access_expire_seconds: int = 3600,
    refresh_expire_seconds: int = 7 * 86400,
):
    """Set HttpOnly, SameSite=Strict cookies for web session security."""
    is_prod = getattr(settings, "ENVIRONMENT", "development").lower() in ("production", "prod")
    response.set_cookie(
        key="strata_access_token",
        value=access_token,
        max_age=access_expire_seconds,
        httponly=True,
        secure=is_prod,
        samesite="strict",
        path="/",
    )
    if refresh_token:
        response.set_cookie(
            key="strata_refresh_token",
            value=refresh_token,
            max_age=refresh_expire_seconds,
            httponly=True,
            secure=is_prod,
            samesite="strict",
            path="/",
        )


def clear_auth_cookies(response: Response):
    """Clear session and refresh cookies upon logout."""
    response.delete_cookie(key="strata_access_token", path="/")
    response.delete_cookie(key="strata_refresh_token", path="/")


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    api_key: Optional[str] = Depends(api_key_header),
    db: AsyncSession = Depends(get_db),
) -> UserModel:
    """Dependency to retrieve currently authenticated user from Bearer JWT, Cookie, or API Key."""
    # 1. Check API Key via X-API-Key header
    if api_key:
        if not verify_api_key(api_key):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid, expired, or revoked API key",
                headers={"WWW-Authenticate": "ApiKey"},
            )
        rec = get_api_key_record(api_key)
        user_id = rec["user_id"] if rec else None
        result = await db.execute(select(UserModel).where(UserModel.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account associated with this API key was not found",
                headers={"WWW-Authenticate": "ApiKey"},
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is deactivated",
            )
        return user

    # 2. Extract token from Authorization header or HttpOnly session cookie
    token = None
    if credentials and credentials.credentials:
        token = credentials.credentials
    elif "strata_access_token" in request.cookies:
        token = request.cookies.get("strata_access_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Support passing API key in Authorization: Bearer strata_live_...
    if token.startswith("strata_live_"):
        if not verify_api_key(token):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid, expired, or revoked API key",
                headers={"WWW-Authenticate": "Bearer"},
            )
        rec = get_api_key_record(token)
        user_id = rec["user_id"] if rec else None
        result = await db.execute(select(UserModel).where(UserModel.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account associated with this API key was not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is deactivated",
            )
        return user

    # Reject revoked tokens
    if is_token_revoked(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Decode standard JWT access token
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, expired, or corrupted authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload["sub"]
    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account associated with this token was not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    return user


async def get_optional_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    api_key: Optional[str] = Depends(api_key_header),
    db: AsyncSession = Depends(get_db),
) -> Optional[UserModel]:
    """Dependency to retrieve user if valid Bearer JWT, Cookie, or API key is provided, returning None otherwise."""
    if api_key and verify_api_key(api_key):
        rec = get_api_key_record(api_key)
        if rec:
            res = await db.execute(select(UserModel).where(UserModel.id == rec["user_id"]))
            u = res.scalar_one_or_none()
            if u and u.is_active:
                return u

    token = None
    if credentials and credentials.credentials:
        token = credentials.credentials
    elif "strata_access_token" in request.cookies:
        token = request.cookies.get("strata_access_token")

    if not token or is_token_revoked(token):
        return None

    if token.startswith("strata_live_") and verify_api_key(token):
        rec = get_api_key_record(token)
        if rec:
            res = await db.execute(select(UserModel).where(UserModel.id == rec["user_id"]))
            u = res.scalar_one_or_none()
            if u and u.is_active:
                return u

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None

    user_id = payload["sub"]
    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        return None
    return user


@auth_router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new Strata account",
    dependencies=[Depends(RateLimiter(max_requests=3, window_seconds=60, scope="auth:register"))],
)
async def register(
    payload: UserRegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Create a new user workspace, hash password, and issue JWT tokens with HttpOnly cookies."""
    clean_email = payload.email.strip().lower()

    # Check for existing email
    result = await db.execute(select(UserModel).where(UserModel.email == clean_email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists. Please sign in instead.",
        )

    # Create new user
    user = UserModel(
        email=clean_email,
        full_name=payload.full_name.strip(),
        hashed_password=hash_password(payload.password),
        role=payload.role or "data_scientist",
        is_active=True,
        is_verified=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Issue JWT access + rotating refresh tokens
    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token = create_access_token(
        data={"sub": user.id, "email": user.email, "role": user.role},
        expires_delta=expires_delta,
    )
    refresh_token = create_refresh_token(
        data={"sub": user.id, "email": user.email},
        expires_delta=timedelta(days=7),
    )

    set_auth_cookies(
        response=response,
        access_token=token,
        refresh_token=refresh_token,
        access_expire_seconds=int(expires_delta.total_seconds()),
        refresh_expire_seconds=7 * 86400,
    )

    return TokenResponse(
        access_token=token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=int(expires_delta.total_seconds()),
        user=UserResponse.model_validate(user),
    )


@auth_router.post(
    "/login",
    response_model=TokenResponse,
    summary="Sign in with email and password",
    dependencies=[Depends(RateLimiter(max_requests=5, window_seconds=60, scope="auth:login"))],
)
async def login(
    payload: UserLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Authenticate user credentials, issue access + refresh tokens, and set secure cookies."""
    clean_email = payload.email.strip().lower()

    result = await db.execute(select(UserModel).where(UserModel.email == clean_email))
    user = result.scalar_one_or_none()

    if not user or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please verify your credentials and try again.",
        )

    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please verify your credentials and try again.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact support.",
        )

    # Adjust expiry based on remember_me
    expire_minutes = (
        settings.ACCESS_TOKEN_EXPIRE_MINUTES * 4 if payload.remember_me else settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    expires_delta = timedelta(minutes=expire_minutes)
    refresh_days = 30 if payload.remember_me else 7
    refresh_delta = timedelta(days=refresh_days)

    token = create_access_token(
        data={"sub": user.id, "email": user.email, "role": user.role},
        expires_delta=expires_delta,
    )
    refresh_token = create_refresh_token(
        data={"sub": user.id, "email": user.email},
        expires_delta=refresh_delta,
    )

    set_auth_cookies(
        response=response,
        access_token=token,
        refresh_token=refresh_token,
        access_expire_seconds=int(expires_delta.total_seconds()),
        refresh_expire_seconds=int(refresh_delta.total_seconds()),
    )

    return TokenResponse(
        access_token=token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=int(expires_delta.total_seconds()),
        user=UserResponse.model_validate(user),
    )


@auth_router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Rotate refresh token and issue new access token",
)
async def refresh_session(
    request: Request,
    response: Response,
    payload: Optional[RefreshTokenRequest] = None,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Validate refresh token, rotate it, and issue a fresh access token."""
    raw_token = None
    if payload and payload.refresh_token:
        raw_token = payload.refresh_token
    elif "strata_refresh_token" in request.cookies:
        raw_token = request.cookies.get("strata_refresh_token")

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token was not provided",
        )

    claims = decode_refresh_token(raw_token)
    if not claims or "sub" not in claims:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, expired, or revoked refresh token",
        )

    user_id = claims["sub"]
    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or deactivated",
        )

    # Token Rotation: Revoke the old refresh token
    revoke_token(raw_token)

    # Issue new token pair
    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    new_access_token = create_access_token(
        data={"sub": user.id, "email": user.email, "role": user.role},
        expires_delta=expires_delta,
    )
    new_refresh_token = create_refresh_token(
        data={"sub": user.id, "email": user.email},
        expires_delta=timedelta(days=7),
    )

    set_auth_cookies(
        response=response,
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        access_expire_seconds=int(expires_delta.total_seconds()),
        refresh_expire_seconds=7 * 86400,
    )

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        expires_in=int(expires_delta.total_seconds()),
        user=UserResponse.model_validate(user),
    )


@auth_router.post(
    "/logout",
    summary="Log out and revoke active tokens and session cookies",
)
async def logout(
    request: Request,
    response: Response,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
):
    """Revoke session tokens and delete authentication cookies."""
    if credentials and credentials.credentials:
        revoke_token(credentials.credentials)
    if "strata_access_token" in request.cookies:
        revoke_token(request.cookies.get("strata_access_token"))
    if "strata_refresh_token" in request.cookies:
        revoke_token(request.cookies.get("strata_refresh_token"))

    clear_auth_cookies(response)
    return {"status": "success", "message": "Successfully logged out and session revoked"}


@auth_router.post(
    "/magic-link",
    summary="Request a passwordless magic login link",
    dependencies=[Depends(RateLimiter(max_requests=3, window_seconds=60, scope="auth:magic-link"))],
)
async def request_magic_link(
    payload: MagicLinkRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate and dispatch a temporary magic login link."""
    clean_email = payload.email.strip().lower()

    # Look up or auto-provision account if needed
    result = await db.execute(select(UserModel).where(UserModel.email == clean_email))
    user = result.scalar_one_or_none()

    if not user:
        user = UserModel(
            email=clean_email,
            full_name=clean_email.split("@")[0].capitalize(),
            hashed_password=None,
            role="data_scientist",
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    # 15-minute magic token
    token = create_access_token(
        data={"sub": user.id, "email": user.email, "type": "magic_link"},
        expires_delta=timedelta(minutes=15),
    )

    # Dispatch email (or log to server console in dev)
    from strata_api.core.email import EmailService

    EmailService.send_magic_link(clean_email, token)

    return {
        "status": "success",
        "message": f"If an account exists, a magic sign-in link has been dispatched to {clean_email}.",
    }


@auth_router.post(
    "/forgot-password",
    summary="Request a password reset link",
    dependencies=[Depends(RateLimiter(max_requests=3, window_seconds=60, scope="auth:forgot-password"))],
)
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate a password recovery token for an existing user."""
    clean_email = payload.email.strip().lower()

    result = await db.execute(select(UserModel).where(UserModel.email == clean_email))
    user = result.scalar_one_or_none()

    # Generate token and dispatch email if user exists
    reset_token = None
    if user:
        reset_token = create_access_token(
            data={"sub": user.id, "email": user.email, "type": "reset_password"},
            expires_delta=timedelta(minutes=30),
        )
        from strata_api.core.email import EmailService

        EmailService.send_password_reset(clean_email, reset_token)

    # Always return generic success response to prevent email enumeration attacks
    return {
        "status": "success",
        "message": f"If an account exists for {clean_email}, a password reset link has been dispatched.",
    }


@auth_router.post(
    "/reset-password",
    summary="Set a new password using a reset token",
)
async def reset_password(
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Verify reset token and update account password."""
    user = None

    if payload.token:
        decoded = decode_access_token(payload.token)
        if not decoded or decoded.get("type") != "reset_password":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The password reset link is invalid or has expired.",
            )
        user_id = decoded.get("sub")
        result = await db.execute(select(UserModel).where(UserModel.id == user_id))
        user = result.scalar_one_or_none()

    elif payload.email:
        clean_email = payload.email.strip().lower()
        result = await db.execute(select(UserModel).where(UserModel.email == clean_email))
        user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )

    user.hashed_password = hash_password(payload.new_password)
    await db.commit()

    return {
        "status": "success",
        "message": "Your password has been successfully updated.",
    }


@auth_router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user profile",
)
async def get_me(
    current_user: UserModel = Depends(get_current_user),
) -> UserResponse:
    """Return profile data for the authenticated session."""
    return UserResponse.model_validate(current_user)


from pydantic import BaseModel


class ApiKeyCreateRequest(BaseModel):
    name: Optional[str] = "Default API Key"
    workspace_id: Optional[str] = None
    expires_in_days: Optional[int] = 30


@auth_router.post("/api-keys", summary="Generate a new API key")
async def create_api_key_endpoint(
    payload: ApiKeyCreateRequest,
    current_user: UserModel = Depends(get_current_user),
):
    """Generate a new scoped API key for SDK/CLI automation."""
    raw_key, record = generate_api_key(
        user_id=current_user.id,
        workspace_id=payload.workspace_id,
        name=payload.name or "Default API Key",
        expires_in_days=payload.expires_in_days,
    )
    return {
        "status": "success",
        "raw_key": raw_key,
        "key": {
            "id": record["id"],
            "name": record["name"],
            "key_prefix": record["key_prefix"],
            "workspace_id": record["workspace_id"],
            "is_revoked": record["is_revoked"],
            "created_at": record["created_at"].isoformat(),
            "expires_at": record["expires_at"].isoformat() if record.get("expires_at") else None,
        },
    }


@auth_router.get("/api-keys", summary="List all API keys for current user")
async def list_api_keys_endpoint(
    current_user: UserModel = Depends(get_current_user),
):
    """List non-secret API key records for current user."""
    return {"api_keys": list_api_keys_for_user(current_user.id)}


@auth_router.delete("/api-keys/{key_id}", summary="Revoke an API key")
async def revoke_api_key_endpoint(
    key_id: str,
    current_user: UserModel = Depends(get_current_user),
):
    """Revoke an active API key."""
    user_keys = list_api_keys_for_user(current_user.id)
    if not any(k["id"] == key_id for k in user_keys):
        raise HTTPException(status_code=404, detail="API key not found")
    revoke_api_key(key_id)
    return {"status": "success", "message": f"API key {key_id} has been revoked."}
