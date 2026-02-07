from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import Field
from .base import APIModel, UTCDatetime


class SpanEvaluation(APIModel):
    """Evaluation details for a single span."""
    eval_relevant: Optional[bool] = Field(None, alias="evalRelevant")
    eval_quality_score: Optional[float] = Field(None, alias="evalQualityScore")
    eval_issues: Optional[List[str]] = Field(default_factory=list, alias="evalIssues")
    eval_reasoning: Optional[str] = Field(None, alias="evalReasoning")


class SpanDetail(APIModel):
    """Detailed information about a single span (tool/LLM call)."""
    id: str
    name: str
    span_type: str = Field(..., alias="spanType")
    model: Optional[str] = None

    start_time: UTCDatetime = Field(..., alias="startTime")
    end_time: Optional[UTCDatetime] = Field(None, alias="endTime")

    duration_ms: float = Field(..., alias="durationMs")  # Changed from duration to durationMs

    inputs: Optional[Dict[str, Any]] = None
    outputs: Optional[str] = None

    input_tokens: int = Field(0, alias="inputTokens")
    output_tokens: int = Field(0, alias="outputTokens")
    tokens: int = 0
    cost: float = 0.0

    status: str = "ok"
    error: Optional[str] = None

    evaluation: Optional[SpanEvaluation] = None