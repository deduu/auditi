"""
Context management for trace and span tracking.

Uses Python's contextvars for thread-safe context propagation.
"""
from contextvars import ContextVar
from typing import Optional, List
from .types import TraceInput, SpanInput

# Context variables for thread-safe trace tracking
_current_trace: ContextVar[Optional[TraceInput]] = ContextVar("current_trace", default=None)
_span_stack: ContextVar[List[SpanInput]] = ContextVar("span_stack", default=[])
_global_context: ContextVar[dict] = ContextVar("global_context", default={})


def get_current_trace() -> Optional[TraceInput]:
    """Get the current active trace, if any."""
    return _current_trace.get()


def set_current_trace(trace: TraceInput) -> None:
    """Set the current active trace."""
    _current_trace.set(trace)


def clear_current_trace() -> None:
    """Clear the current trace context."""
    _current_trace.set(None)
    _span_stack.set([])


def get_current_span() -> Optional[SpanInput]:
    """Get the current (innermost) span, if any."""
    stack = _span_stack.get()
    if stack:
        return stack[-1]
    return None


def push_span(span: SpanInput) -> None:
    """Push a new span onto the stack."""
    stack = _span_stack.get()
    new_stack = stack.copy()
    new_stack.append(span)
    _span_stack.set(new_stack)


def pop_span() -> Optional[SpanInput]:
    """Pop the current span from the stack."""
    stack = _span_stack.get()
    if not stack:
        return None
    new_stack = stack.copy()
    span = new_stack.pop()
    _span_stack.set(new_stack)
    return span


def set_context(user_id: str = None, session_id: str = None) -> None:
    """Set global context for the current execution context."""
    ctx = _global_context.get().copy()
    if user_id:
        ctx["user_id"] = user_id
    if session_id:
        ctx["session_id"] = session_id
    _global_context.set(ctx)


def get_context() -> dict:
    """Get the current global context."""
    return _global_context.get()
