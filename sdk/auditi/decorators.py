"""
Tracing decorators for instrumenting AI agents, tools, and LLM calls.
"""
import functools
from datetime import datetime
from uuid import uuid4
from typing import Optional, Callable, Any

from .types import TraceInput, SpanInput
from .context import (
    get_current_trace, set_current_trace,
    get_current_span, push_span, pop_span,
    get_context
)
from .client import get_client
from .evaluator import BaseEvaluator


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
                # Smart extraction of assistant output
                if isinstance(result, str):
                    trace.assistant_output = result
                elif isinstance(result, dict):
                    trace.assistant_output = result.get("content") or result.get("message") or result.get("response") or str(result)
                    
                    # EXTRACT METRICS from result dict if available
                    if "usage" in result:
                        usage = result["usage"]
                        # Handle OpenAI format
                        if isinstance(usage, dict):
                            total_tokens = usage.get("total_tokens", 0)
                            trace.total_tokens = (trace.total_tokens or 0) + total_tokens
                            # Simple cost estimation (mock logic for now - could be smarter)
                            trace.cost = (trace.cost or 0.0) + (total_tokens * 0.00003) 

                elif hasattr(result, "content"):
                    trace.assistant_output = str(result.content)
                    
                    # Check for usage on object
                    if hasattr(result, "usage"):
                        # Attempt to parse usage object
                        try:
                            usage = result.usage
                            if hasattr(usage, "total_tokens"):
                                total = usage.total_tokens
                                trace.total_tokens = (trace.total_tokens or 0) + total
                                trace.cost = (trace.cost or 0.0) + (total * 0.00003)
                        except:
                            pass
                            
                else:
                    trace.assistant_output = str(result) if result else ""
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
                    # Try to get usage from object
                    if hasattr(result, "usage"):
                         try:
                            usage = result.usage
                            if hasattr(usage, "total_tokens"):
                                span.tokens = usage.total_tokens
                                span.cost = span.tokens * 0.00003
                         except:
                            pass
                elif isinstance(result, dict):
                     span.outputs = str(result)[:2000]
                     if "usage" in result:
                        usage = result["usage"]
                        if isinstance(usage, dict):
                            span.tokens = usage.get("total_tokens", 0)
                            span.cost = span.tokens * 0.00003

                else:
                    span.outputs = str(result)[:2000]
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
