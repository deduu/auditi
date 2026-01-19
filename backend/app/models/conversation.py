"""Conversation model for tracking user conversations."""
from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Conversation(Base):
    """
    Represents a conversation session with a user.
    Contains multiple traces (turns) within the conversation.
    """
    __tablename__ = "conversations"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    traces = relationship("Trace", back_populates="conversation", lazy="dynamic")
