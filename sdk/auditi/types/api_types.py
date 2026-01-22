"""
Pydantic models for Auditi SDK API types.
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID


class SpanInput(BaseModel):
    """
    Represents an individual span (LLM call, tool call, etc.) within a trace.
    Supports hierarchical parent-child relationships for nested operations.
    """
    id: UUID
    trace_id: UUID
    parent_id: Optional[UUID] = None
    name: str
    span_type: str = Field(..., description="Type of span: 'llm', 'tool', 'agent', etc.")
    start_time: datetime
    end_time: Optional[datetime] = None
    inputs: Optional[Dict[str, Any]] = None
    outputs: Optional[str] = None
    status: str = "ok"  # ok, error
    error: Optional[str] = None
    model: Optional[str] = None
    input_tokens: Optional[int] = 0
    output_tokens: Optional[int] = 0
    tokens: Optional[int] = 0
    cost: Optional[float] = 0.0


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


class TraceInput(BaseModel):
    """
    Complete trace data for a single agent interaction.
    Contains user input, assistant output, spans, and evaluation results.
    """
    id: UUID
    user_id: Optional[str] = None
    conversation_id: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    user_input: str
    assistant_output: Optional[str] = None
    spans: List[SpanInput] = Field(default_factory=list)
    evaluation: Optional[EvaluationResult] = None
    error: Optional[str] = None
    # New Metric Fields
    name: Optional[str] = None
    model_name: Optional[str] = None
    total_tokens: Optional[int] = 0
    cost: Optional[float] = 0.0
    tags: Optional[List[str]] = Field(default_factory=list)


class TraceResponse(BaseModel):
    """
    Response from the Auditi API after ingesting a trace.
    """
    success: bool
    count: int
