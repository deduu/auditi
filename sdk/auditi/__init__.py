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
Auditi - AI/LLM Evaluation and Monitoring SDK

This package provides decorators and utilities for tracing AI agent
interactions and sending them to the Auditi platform for evaluation.
"""

from .client import AuditiClient, get_client, init
from .context import get_context, get_current_trace, set_context, set_current_trace
from .decorators import trace_agent, trace_embedding, trace_llm, trace_retrieval, trace_tool
from .evaluator import BaseEvaluator
from .events import EventType, StreamEvent
from .instrumentation import instrument
from .middleware import AuditiMiddleware
from .pricing import configure_pricing
from .transport import BaseTransport, DebugTransport, SyncHttpTransport
from .types import EvaluationResult, SpanInput, TraceInput

__version__ = "0.1.0"

__all__ = [
    # Client
    "init",
    "get_client",
    "AuditiClient",
    # Instrumentation
    "instrument",
    # Middleware
    "AuditiMiddleware",
    # Pricing
    "configure_pricing",
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
    # Events
    "EventType",
    "StreamEvent",
]
