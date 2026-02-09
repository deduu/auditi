"""Pydantic schemas for authentication."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# ---- User schemas ----

class UserCreate(BaseModel):
    email: str = Field(..., description="User email address")
    name: str = Field(..., description="Display name")
    password: str = Field(..., min_length=8, description="Password (min 8 chars)")


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    user: UserResponse
    message: str = "Login successful"


# ---- API Key schemas ----

class APIKeyCreate(BaseModel):
    name: str = Field(..., description="Label for this API key")


class APIKeyCreateResponse(BaseModel):
    """Returned only once at creation time. Contains the full key."""
    id: str
    name: str
    key: str
    key_prefix: str
    created_at: datetime


class APIKeyResponse(BaseModel):
    """Standard response — never includes full key."""
    id: str
    name: str
    key_prefix: str
    is_active: bool
    last_used_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---- Setup schemas ----

class SetupStatus(BaseModel):
    is_setup_complete: bool
    user_count: int


class SetupRequest(BaseModel):
    email: str
    name: str
    password: str = Field(..., min_length=8)
