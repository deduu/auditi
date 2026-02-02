"""
Pydantic schemas package.

Re-export commonly used API schemas for convenient imports:
    from app.schemas import ConversationSummary, SpanDetail, ...
"""

# Base
from .base import APIModel

# Conversation schemas
from .conversation import (
    UserMessage,
    AssistantMessage,
    AssistantEvaluation,
    ConversationTurn,
    ConversationSummary,
    ConversationDetail,
)

# Span schemas
from .span import (
    SpanDetail,
    SpanEvaluation,
)

# Metrics
from .metrics import (
    MetricTrend,
    MetricDetail,
    MetricsResponse,
)

# Responses
from .responses import (
    FailureModeStat,
    ActionResponse,
    ModelStat,
)

# Trace ingestion
from .trace import (
    SpanIngest,
    EvaluationIngest,
    TraceIngest,
)

__all__ = [
    # Base
    "APIModel",
    # Conversation
    "UserMessage",
    "AssistantMessage",
    "AssistantEvaluation",
    "ConversationTurn",
    "ConversationSummary",
    "ConversationDetail",
    # Span
    "SpanDetail",
    "SpanEvaluation",
    # Metrics
    "MetricTrend",
    "MetricDetail",
    "MetricsResponse",
    # Responses
    "FailureModeStat",
    "ActionResponse",
    "ModelStat",
    # Trace ingest
    "SpanIngest",
    "EvaluationIngest",
    "TraceIngest",
]
