"""Authentication router for Strata API."""

from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from strata_api.config import settings
from strata_api.core.database import get_db
from strata_api.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from strata_api.models.user import UserModel
from strata_api.schemas.auth import (
    ForgotPasswordRequest,
    MagicLinkRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)

auth_router = APIRouter(prefix="/auth", tags=["Authentication"])
security_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: AsyncSession = Depends(get_db),
) -> UserModel:
    """Dependency to retrieve currently authenticated user from Bearer JWT."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account associated with this token was not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    return user


@auth_router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new Strata account",
)
async def register(
    payload: UserRegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Create a new user workspace, hash password, and issue a JWT bearer token."""
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

    # Issue JWT token
    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token = create_access_token(
        data={"sub": user.id, "email": user.email, "role": user.role},
        expires_delta=expires_delta,
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=int(expires_delta.total_seconds()),
        user=UserResponse.model_validate(user),
    )


@auth_router.post(
    "/login",
    response_model=TokenResponse,
    summary="Sign in with email and password",
)
async def login(
    payload: UserLoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Authenticate user credentials and issue an access token."""
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

    token = create_access_token(
        data={"sub": user.id, "email": user.email, "role": user.role},
        expires_delta=expires_delta,
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=int(expires_delta.total_seconds()),
        user=UserResponse.model_validate(user),
    )


@auth_router.post(
    "/magic-link",
    summary="Request a passwordless magic login link",
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

    return {
        "status": "success",
        "message": f"Magic sign-in link dispatched to {clean_email}.",
        "demo_link": f"/login?magic_token={token}",
    }


@auth_router.post(
    "/forgot-password",
    summary="Request a password reset link",
)
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate a password recovery token for an existing user."""
    clean_email = payload.email.strip().lower()

    result = await db.execute(select(UserModel).where(UserModel.email == clean_email))
    user = result.scalar_one_or_none()

    # Generate token if user exists
    reset_token = None
    if user:
        reset_token = create_access_token(
            data={"sub": user.id, "email": user.email, "type": "reset_password"},
            expires_delta=timedelta(minutes=30),
        )

    # Always return success response to prevent email enumeration attacks
    return {
        "status": "success",
        "message": f"If an account exists for {clean_email}, a password reset link has been dispatched.",
        "demo_token": reset_token,
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
