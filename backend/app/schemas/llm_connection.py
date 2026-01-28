"""
Pydantic schemas for LLM Connection API.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class LLMConnectionBase(BaseModel):
    """Base schema for LLM connection."""

    provider: str = Field(
        ..., description="LLM provider: openai, anthropic, google, azure, custom"
    )
    name: str = Field(..., description="User-defined connection name")
    api_key: Optional[str] = Field(None, description="API key (will be encrypted)")
    base_url: Optional[str] = Field(None, description="Custom base URL")
    custom_model_name: Optional[str] = Field(
        None, description="Custom model name for open source"
    )


class LLMConnectionCreate(LLMConnectionBase):
    """Schema for creating a new LLM connection."""

    pass


class LLMConnectionUpdate(BaseModel):
    """Schema for updating an LLM connection."""

    provider: Optional[str] = None
    name: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    custom_model_name: Optional[str] = None
    is_default: Optional[bool] = None
    default_model: Optional[str] = None


class LLMConnectionResponse(BaseModel):
    """Schema for LLM connection response."""

    id: str
    provider: str
    name: str
    base_url: Optional[str] = None
    custom_model_name: Optional[str] = None
    is_default: bool = False
    default_model: Optional[str] = None
    has_api_key: bool = False  # Don't expose actual key, just whether it's set
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DefaultModelConfig(BaseModel):
    """Schema for default model configuration."""

    connection_id: str
    model_name: str


class DefaultModelResponse(BaseModel):
    """Response for default model."""

    connection_id: Optional[str] = None
    provider: Optional[str] = None
    model_name: Optional[str] = None
    is_configured: bool = False
