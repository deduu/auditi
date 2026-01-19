from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from uuid import UUID

class SpanInput(BaseModel):
    id: UUID
    trace_id: UUID
    parent_id: Optional[UUID] = None
    name: str
    span_type: str = Field(..., description="llm, tool, etc")
    start_time: datetime
    end_time: Optional[datetime] = None
    inputs: Optional[Dict[str, Any]] = None
    outputs: Optional[str] = None
    status: str = "ok" # ok, error
    error: Optional[str] = None
    model: Optional[str] = None

class EvaluationResult(BaseModel):
    status: str # pass, fail
    score: float
    reason: Optional[str] = None
    failure_mode: Optional[str] = None
    recommended_action: Optional[str] = None

class TraceInput(BaseModel):
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

class TraceResponse(BaseModel):
    success: bool
    count: int
