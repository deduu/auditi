"""
Pydantic models for Auditi SDK API types.
"""

from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID


class SpanInput(BaseModel):
    """
    Represents a single operation (tool call, LLM call) within a trace.

    UPDATED: Added processing_time field for performance tracking.
    """

    id: UUID
    trace_id: UUID
    parent_id: Optional[UUID] = None
    name: str
    span_type: str  # "tool", "llm", "retrieval", etc.
    start_time: datetime
    end_time: Optional[datetime] = None
    processing_time: Optional[float] = None  # NEW: Duration in seconds

    # Input/Output
    inputs: Optional[Dict[str, Any]] = None
    outputs: Optional[str] = None

    # LLM specific
    model: Optional[str] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    tokens: Optional[int] = None
    cost: Optional[float] = None

    # Status
    status: Optional[str] = None  # "ok", "error"
    error: Optional[str] = None

    # Metadata
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class TraceInput(BaseModel):
    """
    Represents a complete agent interaction with user.
    """

    id: UUID
    user_id: Optional[str] = None
    conversation_id: Optional[str] = None

    # Timing
    start_time: datetime
    end_time: Optional[datetime] = None

    # Content
    # Content
    name: str
    user_input: str = ""
    assistant_output: Optional[str] = None

    # Metrics
    total_tokens: Optional[int] = None
    cost: Optional[float] = None

    # Evaluation
    status: Optional[str] = None  # "pass", "fail", "review", "pending"
    score: Optional[float] = None
    failure_mode: Optional[str] = None
    eval_reason: Optional[str] = None

    # Relations
    spans: List[SpanInput] = Field(default_factory=list)

    # Metadata
    tags: List[str] = Field(default_factory=list)
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    error: Optional[str] = None

    @field_validator("user_input", mode="before")
    def normalize_user_input(cls, v):
        return v or ""


class EvaluationResult(BaseModel):
    """
    Result of evaluating a trace.
    Contains pass/fail status, score, and optional failure information.
    """

    status: str  # pass, fail
    score: float
    reason: Optional[str] = None
    failure_mode: Optional[str] = None
    recommended_action: Optional[str] = None


class TraceResponse(BaseModel):
    """
    Response from the Auditi API after ingesting a trace.
    """

    success: bool
    count: int
