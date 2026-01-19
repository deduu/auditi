"""Trace model for tracking individual turns/interactions."""
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Float, Integer, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class Trace(Base):
    """
    Represents a single turn/interaction within a conversation.
    Contains user input, assistant output, and evaluation results.
    """
    __tablename__ = "traces"
    
    id = Column(String, primary_key=True)
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=True)
    user_id = Column(String, nullable=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)
    user_input = Column(Text, nullable=True)
    assistant_output = Column(Text, nullable=True)
    latency = Column(Float, default=0)
    
    # Metric Fields
    name = Column(String, nullable=True)
    model_name = Column(String, nullable=True)
    total_tokens = Column(Integer, default=0)
    cost = Column(Float, default=0.0)
    tags = Column(JSON, nullable=True)
    
    # Evaluation fields
    status = Column(String, default="review")  # pass, fail, review
    score = Column(Float, nullable=True)
    failure_mode = Column(String, nullable=True)
    eval_reason = Column(Text, nullable=True)
    
    # Relationships
    conversation = relationship("Conversation", back_populates="traces")
    spans = relationship("Span", back_populates="trace", lazy="dynamic")
