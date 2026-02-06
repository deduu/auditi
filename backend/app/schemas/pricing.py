"""
Pydantic schemas for model pricing endpoints.
"""

from typing import Optional
from pydantic import Field
from .base import APIModel


class ModelPricingItem(APIModel):
    """Single model pricing entry."""
    provider: str = Field(..., description="Provider name (openai, anthropic, google)")
    model: str = Field(..., description="Model name (e.g. gpt-4o, claude-3-5-sonnet-20241022)")
    input_price: float = Field(..., description="Price per 1M input tokens in USD")
    output_price: float = Field(..., description="Price per 1M output tokens in USD")


class ModelPricingResponse(ModelPricingItem):
    """Pricing entry with metadata."""
    id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ModelPricingCreate(APIModel):
    """Create/update a pricing entry."""
    provider: str
    model: str
    input_price: float = Field(..., gt=0)
    output_price: float = Field(..., gt=0)


class ModelPricingBulkCreate(APIModel):
    """Bulk create/update pricing entries."""
    items: list[ModelPricingCreate]
