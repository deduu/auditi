from datetime import datetime
from typing import List, Optional
from pydantic import Field
from .base import APIModel
from .span import SpanDetail


# ============================================================================
# CONVERSATION TURN SCHEMAS
# ============================================================================

class UserMessage(APIModel):
    """User's input message."""
    content: str


class AssistantEvaluation(APIModel):
    """Evaluation results for assistant's response."""
    status: str  # "pass", "fail", "review", "pending"
    score: Optional[float] = None
    failure_mode: Optional[str] = Field(None, alias="failureMode")
    reason: Optional[str] = None
    recommended_action: Optional[str] = Field(None, alias="recommendedAction")  # null or string, never "None"


class AssistantMessage(APIModel):
    """Assistant's response message with evaluation."""
    content: str
    model: str
    latency_ms: float = Field(..., alias="latencyMs")  # Changed to milliseconds
    evaluation: AssistantEvaluation


class ConversationTurn(APIModel):
    """A single turn in a conversation (user input + assistant response)."""
    id: str
    user: UserMessage
    assistant: AssistantMessage
    spans: List[SpanDetail] = Field(default_factory=list)


# ============================================================================
# CONVERSATION SUMMARY & DETAIL SCHEMAS
# ============================================================================

class ConversationSummary(APIModel):
    """Summary view of a conversation for list display."""
    id: str
    user_id: Optional[str] = Field(None, alias="userId")
    start_time: datetime = Field(..., alias="startTime")

    total_turns: int = Field(..., alias="totalTurns")
    pass_count: int = Field(..., alias="passCount")
    fail_count: int = Field(..., alias="failCount")

    overall_status: str = Field(..., alias="overallStatus")  # "pass", "fail", "review"
    models: List[str] = Field(default_factory=list)

    avg_score: float = Field(..., alias="avgScore")
    avg_latency_ms: float = Field(..., alias="avgLatencyMs")  # In milliseconds
    objective: Optional[str] = None


class ConversationDetail(APIModel):
    """Detailed view of a conversation with all turns and spans."""
    id: str
    user_id: Optional[str] = Field(None, alias="userId")
    start_time: datetime = Field(..., alias="startTime")
    updated_at: datetime = Field(..., alias="updatedAt")

    objective: Optional[str] = None
    turns: List[ConversationTurn] = Field(default_factory=list)

    models: List[str] = Field(default_factory=list)
    avg_score: float = Field(0.0, alias="avgScore")