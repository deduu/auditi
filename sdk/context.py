from contextvars import ContextVar
from typing import Optional, List
from .api_types import TraceInput, SpanInput

_current_trace: ContextVar[Optional[TraceInput]] = ContextVar("current_trace", default=None)
_span_stack: ContextVar[List[SpanInput]] = ContextVar("span_stack", default=[])
_global_context: ContextVar[dict] = ContextVar("global_context", default={})

def get_current_trace() -> Optional[TraceInput]:
    return _current_trace.get()

def set_current_trace(trace: TraceInput):
    _current_trace.set(trace)

def get_current_span() -> Optional[SpanInput]:
    stack = _span_stack.get()
    if stack:
        return stack[-1]
    return None

def push_span(span: SpanInput):
    stack = _span_stack.get()
    new_stack = stack.copy()
    new_stack.append(span)
    _span_stack.set(new_stack)

def pop_span() -> Optional[SpanInput]:
    stack = _span_stack.get()
    if not stack:
        return None
    new_stack = stack.copy()
    span = new_stack.pop()
    _span_stack.set(new_stack)
    return span

def set_context(user_id: str = None, session_id: str = None):
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
