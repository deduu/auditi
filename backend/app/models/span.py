"""Span model for tracking internal operations within a trace."""
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, JSON, Integer, Float, Boolean
from sqlalchemy.orm import relationship
from app.database import Base


class Span(Base):
    """
    Represents an internal operation span (LLM call, tool call, etc.) 
    within a trace. Supports hierarchical parent-child relationships.
    """
    __tablename__ = "spans"
    
    id = Column(String, primary_key=True)
    trace_id = Column(String, ForeignKey("traces.id"), nullable=False)
    parent_id = Column(String, nullable=True)  # For nested spans
    name = Column(String, nullable=False)
    span_type = Column(String, nullable=False)  # llm, tool, agent
    model = Column(String, nullable=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)
    processing_time = Column(Float, nullable=True)  # Duration in seconds
    inputs = Column(JSON, nullable=True)
    outputs = Column(Text, nullable=True)
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    tokens = Column(Integer, default=0)
    cost = Column(Float, default=0.0)
    status = Column(String, default="ok")
    error = Column(Text, nullable=True)
    
    # NEW: Span-level evaluation fields
    eval_relevant = Column(Boolean, nullable=True)  # Was this span relevant?
    eval_quality_score = Column(Float, nullable=True)  # 0.0 to 1.0
    eval_issues = Column(JSON, nullable=True)  # List of issues found
    eval_reasoning = Column(Text, nullable=True)  # Why this score?
    
    # Relationships
    trace = relationship("Trace", back_populates="spans")