"""
Model pricing storage for LLM provider cost calculation.
"""

from sqlalchemy import Column, String, Float, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from ..database import Base


class ModelPricing(Base):
    """Stores per-model pricing for LLM providers."""

    __tablename__ = "model_pricing"

    id = Column(String(36), primary_key=True)
    provider = Column(String(50), nullable=False, index=True)  # openai, anthropic, google
    model = Column(String(100), nullable=False, index=True)
    input_price = Column(Float, nullable=False)   # USD per 1M input tokens
    output_price = Column(Float, nullable=False)  # USD per 1M output tokens

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("provider", "model", name="uq_provider_model"),
    )

    def __repr__(self):
        return f"<ModelPricing(provider={self.provider}, model={self.model}, input={self.input_price}, output={self.output_price})>"
