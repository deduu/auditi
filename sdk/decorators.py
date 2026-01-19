import functools
import inspect
import time
from datetime import datetime
from uuid import uuid4
from typing import Optional, Type, Any, Callable
from .api_types import TraceInput, SpanInput
from .context import (
    get_current_trace, set_current_trace,
    get_current_span, push_span, pop_span,
    get_context
)
from .client import get_client
from .evaluator import BaseEvaluator

def extract_input(args, kwargs) -> str:
    """Helper to extract the main user input from arguments."""
    # Try common keyword arguments
    for key in ["query", "input", "question", "prompt", "text"]:
        if key in kwargs:
            return str(kwargs[key])
    
    # Try first positional argument if it looks like input
    if args:
        first_arg = args[0]
        if isinstance(first_arg, (str, dict)):
            return str(first_arg)
            
    # Fallback to string representation of all args
    return str(args) + str(kwargs)

def detect_model(args, kwargs) -> Optional[str]:
    """Helper to detect model name from arguments or self."""
    # 1. Check kwargs
    if "model" in kwargs:
        return str(kwargs["model"])
        
    # 2. Check first arg (likely 'self' for methods)
    if args:
        obj = args[0]
        if hasattr(obj, "model"):
            return str(obj.model)
            
    return None

def trace_agent(name: Optional[str] = None, user_id: str = None, evaluator: BaseEvaluator = None):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            client = get_client()
            trace_id = uuid4()
            start_time = datetime.utcnow()
            
            trace_name = name or func.__name__
            
            # Get Context (Global or Local Override)
            ctx = get_context()
            effective_user_id = user_id or ctx.get("user_id")
            # Extract session_id if present in kwargs (convention) or context
            effective_session_id = kwargs.get("session_id") or ctx.get("session_id")

            # Create Trace
            trace = TraceInput(
                id=trace_id,
                user_id=effective_user_id,
                conversation_id=effective_session_id,
                start_time=start_time,
                user_input=extract_input(args, kwargs), 
            )
            set_current_trace(trace)
            
            result = None
            error_msg = None
            
            try:
                result = func(*args, **kwargs)
                trace.assistant_output = str(result)
            except Exception as e:
                error_msg = str(e)
                trace.assistant_output = f"Error: {e}"
                # Re-raise after capturing
                raise e
            finally:
                trace.end_time = datetime.utcnow()
                
                # Run Evaluator if provided and no error
                if evaluator and not error_msg:
                    try:
                        eval_result = evaluator.evaluate(trace)
                        trace.evaluation = eval_result
                    except Exception as e:
                        print(f"Evaluator failed: {e}")

                # Send Trace
                client.transport.send_trace(trace.model_dump(mode='json'))
                
            return result
        return wrapper
    return decorator

def _trace_span(span_type: str, name: str = None, model: str = None):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            trace = get_current_trace()
            if not trace:
                # If no active trace (called outside agent), just run normally
                return func(*args, **kwargs)
            
            parent = get_current_span()
            span_id = uuid4()
            start_time = datetime.utcnow()
            span_name = name or func.__name__
            
            # Auto-detect model if not provided
            effective_model = model or detect_model(args, kwargs)

            span = SpanInput(
                id=span_id,
                trace_id=trace.id,
                parent_id=parent.id if parent else None,
                name=span_name,
                span_type=span_type,
                start_time=start_time,
                inputs={"args": [str(a) for a in args], "kwargs": {k: str(v) for k,v in kwargs.items()}},
                model=effective_model
            )
            
            push_span(span)
            
            try:
                result = func(*args, **kwargs)
                span.outputs = str(result)
                span.status = "ok"
                return result
            except Exception as e:
                span.error = str(e)
                span.status = "error"
                raise e
            finally:
                span.end_time = datetime.utcnow()
                pop_span()
                trace.spans.append(span)
        return wrapper
    return decorator

def trace_tool(name: Optional[str] = None):
    return _trace_span("tool", name)

def trace_llm(name: Optional[str] = None, model: str = None):
    return _trace_span("llm", name, model)
