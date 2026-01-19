"""Trace-related Pydantic schemas for API ingestion."""
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID


class SpanIngest(BaseModel):
    """Schema for ingesting span data."""
    id: UUID
    parent_id: Optional[UUID] = None
    name: str
    span_type: str
    model: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    inputs: Optional[Dict[str, Any]] = None
    outputs: Optional[str] = None
    status: str = "ok"
    error: Optional[str] = None


class EvaluationIngest(BaseModel):
    """Schema for ingesting evaluation results."""
    status: str
    score: float
    reason: Optional[str] = None
    failure_mode: Optional[str] = None
    recommended_action: Optional[str] = None


class TraceIngest(BaseModel):
    """Schema for ingesting complete trace data including spans and evaluation."""
    id: UUID
    conversation_id: Optional[str] = None
    user_id: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    user_input: str
    assistant_output: Optional[str] = None
    spans: List[SpanIngest] = []
    evaluation: Optional[EvaluationIngest] = None
    # Metric Fields
    name: Optional[str] = None
    model_name: Optional[str] = None
    total_tokens: Optional[int] = 0
    cost: Optional[float] = 0.0
    tags: List[str] = []
