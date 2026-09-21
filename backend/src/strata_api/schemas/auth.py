"""Pydantic schemas for authentication and user accounts."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class UserRegisterRequest(BaseModel):
    """Payload for registering a new user."""
    email: str = Field(..., description="User work email address")
    full_name: str = Field(..., min_length=2, max_length=255, description="Full name of user")
    password: str = Field(..., min_length=8, description="Plain text password, minimum 8 characters")
    role: Optional[str] = Field("data_scientist", description="Role: data_scientist, data_analyst, researcher, business")


class UserLoginRequest(BaseModel):
    """Payload for credentials-based login."""
    email: str = Field(..., description="User registered email")
    password: str = Field(..., description="User password")
    remember_me: Optional[bool] = Field(False, description="Extend session duration")


class MagicLinkRequest(BaseModel):
    """Payload for requesting a passwordless magic login link."""
    email: str = Field(..., description="User registered email")


class ForgotPasswordRequest(BaseModel):
    """Payload for requesting a password reset link."""
    email: str = Field(..., description="User registered email")


class ResetPasswordRequest(BaseModel):
    """Payload for setting a new password using a reset token."""
    email: Optional[str] = Field(None, description="Account email")
    token: Optional[str] = Field(None, description="One-time password reset token")
    new_password: str = Field(..., min_length=8, description="New password, minimum 8 characters")


class UserResponse(BaseModel):
    """Public user profile."""
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    is_verified: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    """Authentication token response with embedded user profile."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
