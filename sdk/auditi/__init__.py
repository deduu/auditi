"""
Auditi - AI/LLM Evaluation and Monitoring SDK

This package provides decorators and utilities for tracing AI agent
interactions and sending them to the Auditi platform for evaluation.
"""

from .client import init, get_client, AuditiClient
from .decorators import trace_agent, trace_tool, trace_llm, trace_embedding, trace_retrieval
from .evaluator import BaseEvaluator
from .context import get_current_trace, set_current_trace, set_context, get_context
from .client import get_client
from .evaluator import BaseEvaluator
from .transport import BaseTransport, SyncHttpTransport, DebugTransport
from .types import TraceInput, SpanInput, EvaluationResult

__version__ = "0.1.0"

__all__ = [
    # Client
    "init",
    "get_client",
    "AuditiClient",
    # Context
    "set_context",
    "get_context",
    # Decorators
    "trace_agent",
    "trace_tool",
    "trace_llm",
    "trace_embedding",
    "trace_retrieval",
    # Evaluator
    "BaseEvaluator",
    # Transport
    "BaseTransport",
    "SyncHttpTransport",
    "DebugTransport",
    # Types
    "TraceInput",
    "SpanInput",
    "EvaluationResult",
]
