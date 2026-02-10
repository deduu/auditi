"""User settings model for persisting user preferences."""

import uuid
from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey
from sqlalchemy.sql import func
from ..database import Base


class UserSettings(Base):
    """Per-user settings for notifications, security, and data preferences."""

    __tablename__ = "user_settings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(
        String(36), ForeignKey("users.id"), unique=True, nullable=False, index=True
    )

    # Notifications
    email_notifications = Column(Boolean, default=True)
    slack_integration = Column(Boolean, default=False)

    # Security
    two_factor_auth = Column(Boolean, default=False)
    audit_logging = Column(Boolean, default=True)

    # Data
    data_retention_days = Column(Integer, default=30)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
