# Copyright (c) 2026 Auditi Contributors
#
# MIT License
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

"""
Pydantic models for Auditi SDK API types.
"""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


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
    inputs: Optional[dict[str, Any]] = None
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
    metadata: Optional[dict[str, Any]] = Field(default_factory=dict)


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
    spans: list[SpanInput] = Field(default_factory=list)

    # Metadata
    tags: list[str] = Field(default_factory=list)
    metadata: Optional[dict[str, Any]] = Field(default_factory=dict)
    error: Optional[str] = None

    @field_validator("user_input", mode="before")
    @classmethod
    def normalize_user_input(cls, v: Any) -> Optional[str]:
        if isinstance(v, str):
            return v
        if isinstance(v, list):
            # Extract last user message from chat-format messages
            for msg in reversed(v):
                if isinstance(msg, dict) and msg.get("role") == "user":
                    content = msg.get("content", "")
                    return str(content) if not isinstance(content, str) else content
            return str(v)
        if v is None:
            return ""
        return str(v)


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
