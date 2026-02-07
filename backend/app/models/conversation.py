"""Conversation model for tracking user conversations."""
from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text
from app.database import Base



class Conversation(Base):
    """
    Represents a conversation session with a user.
    Contains multiple traces (turns) within the conversation.
    """
    __tablename__ = "conversations"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    objective = Column(Text, nullable=True)
    # Relationships
    traces = relationship("Trace", back_populates="conversation", lazy="dynamic")
