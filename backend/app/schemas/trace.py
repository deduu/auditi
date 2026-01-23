from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import Field, model_validator
from .base import APIModel

# ============================================================================
# INGEST SCHEMAS (for receiving data from SDK)
# ============================================================================

class EvaluationIngest(APIModel):
    """Evaluation data from SDK."""
    status: str
    score: Optional[float] = None
    failure_mode: Optional[str] = None
    reason: Optional[str] = None
    recommended_action: Optional[str] = None


class SpanIngest(APIModel):
    """Span data from SDK."""
    id: UUID
    parent_id: Optional[str] = None
    
    span_type: str
    name: str
    model: Optional[str] = None
    
    start_time: datetime
    end_time: Optional[datetime] = None
    processing_time: Optional[float] = None
    
    inputs: Optional[Dict[str, Any]] = None
    outputs: Optional[str] = None
    
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    tokens: Optional[int] = None
    cost: Optional[float] = None
    
    status: Optional[str] = None
    error: Optional[str] = None
    
    # Evaluation fields
    eval_relevant: Optional[bool] = None
    eval_quality_score: Optional[float] = None
    eval_issues: Optional[List[str]] = None
    eval_reasoning: Optional[str] = None


class TraceIngest(APIModel):
    """Trace data from SDK."""
    id: UUID
    conversation_id: Optional[str] = None
    user_id: Optional[str] = None

    start_time: datetime
    end_time: Optional[datetime] = None

    user_input: str
    assistant_output: Optional[str] = None

    spans: List[SpanIngest] = Field(default_factory=list)
    evaluation: Optional[EvaluationIngest] = None

    name: Optional[str] = None
    model_name: Optional[str] = None

    tags: List[str] = Field(default_factory=list)

    total_tokens: Optional[int] = 0
    cost: Optional[float] = 0.0

    @model_validator(mode="before")
    @classmethod
    def normalize_nulls(cls, data):
        if isinstance(data, dict):
            if data.get("total_tokens") is None:
                data["total_tokens"] = 0
            if data.get("cost") is None:
                data["cost"] = 0.0
        return data