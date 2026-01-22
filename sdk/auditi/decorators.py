"""
Tracing decorators for instrumenting AI agents, tools, and LLM calls.
"""
import functools
from datetime import datetime
from uuid import uuid4
from typing import Optional, Callable, Any
from contextlib import contextmanager

from .types import TraceInput, SpanInput
from .context import (
    get_current_trace, set_current_trace,
    get_current_span, push_span, pop_span,
    get_context, clear_current_trace
)
from .client import get_client
from .evaluator import BaseEvaluator


def _coerce_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _extract_usage_fields(usage: Any) -> tuple[Optional[int], Optional[int], Optional[int]]:
    if usage is None:
        return None, None, None

    if isinstance(usage, dict):
        if "input_tokens" in usage or "output_tokens" in usage or "total_tokens" in usage:
            input_tokens = _coerce_int(usage.get("input_tokens"))
            output_tokens = _coerce_int(usage.get("output_tokens"))
            total_tokens = _coerce_int(usage.get("total_tokens"))
        else:
            input_tokens = _coerce_int(usage.get("prompt_tokens"))
            output_tokens = _coerce_int(usage.get("completion_tokens"))
            total_tokens = _coerce_int(usage.get("total_tokens"))
    else:
        if hasattr(usage, "input_tokens") or hasattr(usage, "output_tokens") or hasattr(usage, "total_tokens"):
            input_tokens = _coerce_int(getattr(usage, "input_tokens", None))
            output_tokens = _coerce_int(getattr(usage, "output_tokens", None))
            total_tokens = _coerce_int(getattr(usage, "total_tokens", None))
        else:
            input_tokens = _coerce_int(getattr(usage, "prompt_tokens", None))
            output_tokens = _coerce_int(getattr(usage, "completion_tokens", None))
            total_tokens = _coerce_int(getattr(usage, "total_tokens", None))

    if total_tokens is None and (input_tokens is not None or output_tokens is not None):
        total_tokens = (input_tokens or 0) + (output_tokens or 0)

    return input_tokens, output_tokens, total_tokens


def _apply_usage_to_span(span: SpanInput, usage: Any) -> None:
    input_tokens, output_tokens, total_tokens = _extract_usage_fields(usage)
    if input_tokens is None and output_tokens is None and total_tokens is None:
        return

    if input_tokens is not None:
        span.input_tokens = input_tokens
    if output_tokens is not None:
        span.output_tokens = output_tokens
    if total_tokens is None:
        total_tokens = (input_tokens or 0) + (output_tokens or 0)
    span.tokens = total_tokens
    span.cost = total_tokens * 0.00003


def _apply_usage_to_trace(trace: TraceInput, usage: Any) -> None:
    _, _, total_tokens = _extract_usage_fields(usage)
    if total_tokens is None:
        return
    trace.total_tokens = (trace.total_tokens or 0) + total_tokens
    trace.cost = (trace.cost or 0.0) + (total_tokens * 0.00003)


@contextmanager
def trace_session(
    name: Optional[str] = None,
    user_id: Optional[str] = None,
    conversation_id: Optional[str] = None,
    user_input: str = "",
    tags: Optional[list[str]] = None,
) -> TraceInput:
    """
    Context manager for manual trace scoping when a decorator is not viable.
    """
    client = get_client()
    trace_id = uuid4()
    start_time = datetime.utcnow()

    trace = TraceInput(
        id=trace_id,
        user_id=user_id,
        conversation_id=conversation_id,
        start_time=start_time,
        user_input=user_input,
        name=name,
        tags=tags or [],
    )
    set_current_trace(trace)

    try:
        yield trace
    except Exception as e:
        trace.error = str(e)
        raise
    finally:
        trace.end_time = datetime.utcnow()
        client.transport.send_trace(trace.model_dump(mode="json"))
        clear_current_trace()


def trace_agent(
    name: Optional[str] = None, 
    user_id: Optional[str] = None, 
    evaluator: Optional[BaseEvaluator] = None,
    capture_input: bool = True
) -> Callable:
    """
    Decorator to trace an entire agent interaction.
    
    The decorator intelligently captures user input:
    - First positional string argument is treated as user_input
    - session_id/conversation_id from kwargs for conversation tracking
    - user_id from kwargs or decorator parameter
    
    Args:
        name: Optional name for the trace (defaults to function name)
        user_id: Default user ID (can be overridden by kwargs)
        evaluator: Optional evaluator to run after completion
        capture_input: Whether to capture the first arg as user_input (default: True)
        
    Example:
        >>> @trace_agent(name="Customer Support Bot")
        ... def my_agent(user_message: str, user_id: str = None, session_id: str = None):
        ...     return process_message(user_message)
        ...
        >>> # Call with explicit context
        >>> my_agent("Hello!", user_id="user_123", session_id="conv_456")
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            client = get_client()
            trace_id = uuid4()
            start_time = datetime.utcnow()
            
            trace_name = name or func.__name__
            
            # Smart extraction of context from kwargs or global context
            ctx = get_context()
            session_id = kwargs.get("session_id") or kwargs.get("conversation_id") or ctx.get("session_id")
            resolved_user_id = kwargs.get("user_id") or user_id or ctx.get("user_id")
            
            # Smart extraction of user input
            user_input = ""
            if capture_input and args:
                # First positional argument is typically the user message
                first_arg = args[0]
                if isinstance(first_arg, str):
                    user_input = first_arg
                elif isinstance(first_arg, dict) and "message" in first_arg:
                    user_input = first_arg["message"]
                elif isinstance(first_arg, dict) and "content" in first_arg:
                    user_input = first_arg["content"]
                else:
                    user_input = str(first_arg)
            
            # Also check for user_input/message/query in kwargs
            if not user_input:
                user_input = (
                    kwargs.get("user_input") or 
                    kwargs.get("message") or 
                    kwargs.get("query") or 
                    kwargs.get("prompt") or
                    ""
                )

            # Create Trace
            trace = TraceInput(
                id=trace_id,
                user_id=resolved_user_id,
                conversation_id=session_id,
                start_time=start_time,
                user_input=user_input,
                name=trace_name,
                tags=kwargs.get("tags", []),
            )
            set_current_trace(trace)
            
            result = None
            error_msg = None
            
            try:
                result = func(*args, **kwargs)
                print("[Auditi] Trace captured.")
                print(f"result: {result}")
                # Smart extraction of assistant output
                if isinstance(result, str):
                    trace.assistant_output = result
                elif isinstance(result, dict):
                    trace.assistant_output = result.get("content") or result.get("message") or result.get("response") or str(result)
                    
                    # EXTRACT METRICS from result dict if available
                    if "usage" in result:
                        _apply_usage_to_trace(trace, result["usage"])

                elif hasattr(result, "content"):
                    trace.assistant_output = str(result.content)
                    
                    # Check for usage on object
                    if hasattr(result, "usage"):
                        try:
                            _apply_usage_to_trace(trace, result.usage)
                        except:
                            pass
                            
                else:
                    trace.assistant_output = str(result) if result else ""
                    if hasattr(result, "usage"):
                        try:
                            _apply_usage_to_trace(trace, result.usage)
                        except:
                            pass
            except Exception as e:
                error_msg = str(e)
                trace.assistant_output = f"Error: {e}"
                trace.error = error_msg
                raise
            finally:
                trace.end_time = datetime.utcnow()
                
                # Run Evaluator if provided and no error
                if evaluator and not error_msg:
                    try:
                        eval_result = evaluator.evaluate(trace)
                        trace.evaluation = eval_result
                    except Exception as e:
                        print(f"[Auditi] Evaluator failed: {e}")

                # Send Trace
                client.transport.send_trace(trace.model_dump(mode='json'))
                clear_current_trace()
                
            return result
        return wrapper
    return decorator


def _trace_span(
    span_type: str, 
    name: Optional[str] = None, 
    model: Optional[str] = None
) -> Callable:
    """
    Internal helper to create span tracing decorators.
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            trace = get_current_trace()
            if not trace:
                # If no active trace, just run the function normally
                return func(*args, **kwargs)
            
            parent = get_current_span()
            span_id = uuid4()
            start_time = datetime.utcnow()
            span_name = name or func.__name__

            # Auto-detect model if not provided
            effective_model = model
            if not effective_model:
                if "model" in kwargs:
                    effective_model = str(kwargs["model"])
                elif args and hasattr(args[0], "model"):
                    effective_model = str(args[0].model)

            # Smart input capture for spans
            inputs = {}
            if args:
                first_arg = args[0]
                if isinstance(first_arg, str):
                    inputs["prompt"] = first_arg
                elif isinstance(first_arg, (dict, list)):
                    inputs["data"] = first_arg
                else:
                    inputs["input"] = str(first_arg)
            if kwargs:
                inputs.update({k: str(v)[:500] for k, v in kwargs.items()})  # Truncate long values

            span = SpanInput(
                id=span_id,
                trace_id=trace.id,
                parent_id=parent.id if parent else None,
                name=span_name,
                span_type=span_type,
                start_time=start_time,
                inputs=inputs,
                model=effective_model
            )
            
            push_span(span)
            
            try:
                result = func(*args, **kwargs)
                # Smart output capture
                if isinstance(result, str):
                    span.outputs = result[:2000]  # Truncate long outputs
                elif hasattr(result, "content"):
                    span.outputs = str(result.content)[:2000]
                    if not span.model and hasattr(result, "model"):
                        span.model = str(result.model)
                    # Try to get usage from object
                    if hasattr(result, "usage"):
                        try:
                            _apply_usage_to_span(span, result.usage)
                        except:
                            pass
                elif isinstance(result, dict):
                    span.outputs = str(result)[:2000]
                    if not span.model:
                        model_name = result.get("model") or result.get("model_name")
                        if model_name:
                            span.model = str(model_name)
                    if "usage" in result:
                        _apply_usage_to_span(span, result["usage"])

                else:
                    span.outputs = str(result)[:2000]
                    if not span.model and hasattr(result, "model"):
                        span.model = str(result.model)
                    if hasattr(result, "usage"):
                        try:
                            _apply_usage_to_span(span, result.usage)
                        except:
                            pass
                span.status = "ok"
                return result
            except Exception as e:
                span.error = str(e)
                span.status = "error"
                raise
            finally:
                span.end_time = datetime.utcnow()
                pop_span()
                trace.spans.append(span)
        return wrapper
    return decorator


def trace_tool(name: Optional[str] = None) -> Callable:
    """
    Decorator to trace a tool/function call within an agent.
    
    Example:
        >>> @trace_tool("database_search")
        ... def search_db(query: str) -> list:
        ...     return db.search(query)
    """
    return _trace_span("tool", name)


def trace_llm(name: Optional[str] = None, model: Optional[str] = None) -> Callable:
    """
    Decorator to trace an LLM call within an agent.
    
    Example:
        >>> @trace_llm("generate_response", model="gpt-4")
        ... def call_gpt(prompt: str) -> str:
        ...     return openai.chat(prompt)
    """
    return _trace_span("llm", name, model)
