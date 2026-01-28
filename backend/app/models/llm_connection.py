"""
LLM Connection model for storing API connections.
"""

from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from ..database import Base


class LLMConnection(Base):
    """Model for storing LLM API connections."""

    __tablename__ = "llm_connections"

    id = Column(String(36), primary_key=True)
    provider = Column(
        String(50), nullable=False
    )  # openai, anthropic, google, azure, custom
    name = Column(String(100), nullable=False)  # User-defined connection name
    api_key_encrypted = Column(Text, nullable=True)  # Encrypted API key
    base_url = Column(String(500), nullable=True)  # Custom base URL
    custom_model_name = Column(String(100), nullable=True)  # For open source models
    is_default = Column(
        Boolean, default=False
    )  # Whether this is the default connection
    default_model = Column(
        String(100), nullable=True
    )  # Default model for this connection

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self):
        return (
            f"<LLMConnection(id={self.id}, provider={self.provider}, name={self.name})>"
        )
