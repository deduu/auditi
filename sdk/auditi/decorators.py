"""
Tracing decorators for instrumenting AI agents, tools, and LLM calls.
"""
import functools
import json
import os
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

# Debug flag - set via environment variable
DEBUG = os.getenv("AUDITI_DEBUG", "false").lower() in ("true", "1", "yes")


def _debug_log(message: str, data: Any = None) -> None:
    """Helper function to conditionally log debug information."""
    if True:
        print(f"[Auditi Debug] {message}")
        if data is not None:
            try:
                print(json.dumps(data, indent=2, default=str))
            except Exception as e:
                print(f"[Auditi Debug] Could not serialize data: {e}")
                print(f"Raw data: {data}")


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
    
    input_tokens = None
    output_tokens = None
    total_tokens = None

    if isinstance(usage, dict):
        # Try OpenAI-style keys first (more common)
        input_tokens = _coerce_int(usage.get("prompt_tokens")) or _coerce_int(usage.get("input_tokens"))
        output_tokens = _coerce_int(usage.get("completion_tokens")) or _coerce_int(usage.get("output_tokens"))
        total_tokens = _coerce_int(usage.get("total_tokens"))
    else:
        # For objects like OpenAI CompletionUsage, try OpenAI-style attributes first
        input_tokens = _coerce_int(getattr(usage, "prompt_tokens", None)) or _coerce_int(getattr(usage, "input_tokens", None))
        output_tokens = _coerce_int(getattr(usage, "completion_tokens", None)) or _coerce_int(getattr(usage, "output_tokens", None))
        total_tokens = _coerce_int(getattr(usage, "total_tokens", None))

    if total_tokens is None and (input_tokens is not None or output_tokens is not None):
        total_tokens = (input_tokens or 0) + (output_tokens or 0)

    return input_tokens, output_tokens, total_tokens
# Model pricing per 1M tokens (input_price, output_price) in USD
# Based on current API pricing from major providers
MODEL_PRICING = {
    # OpenAI GPT-4 family
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-2024-08-06": (2.50, 10.00),
    "gpt-4o-2024-05-13": (5.00, 15.00),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4o-mini-2024-07-18": (0.15, 0.60),
    "gpt-4-turbo": (10.00, 30.00),
    "gpt-4-turbo-preview": (10.00, 30.00),
    "gpt-4": (30.00, 60.00),
    "gpt-4-32k": (60.00, 120.00),
    "gpt-3.5-turbo": (0.50, 1.50),
    "gpt-3.5-turbo-0125": (0.50, 1.50),
    # Anthropic Claude family
    "claude-3-5-sonnet-20241022": (3.00, 15.00),
    "claude-3-5-sonnet-latest": (3.00, 15.00),
    "claude-3-opus-20240229": (15.00, 75.00),
    "claude-3-sonnet-20240229": (3.00, 15.00),
    "claude-3-haiku-20240307": (0.25, 1.25),
    # Google Gemini
    "gemini-1.5-pro": (1.25, 5.00),
    "gemini-1.5-flash": (0.075, 0.30),
    "gemini-2.0-flash": (0.10, 0.40),
}

# Default fallback pricing (conservative estimate)
DEFAULT_INPUT_PRICE = 5.00   # $5 per 1M input tokens
DEFAULT_OUTPUT_PRICE = 15.00  # $15 per 1M output tokens


def _calculate_cost(model: Optional[str], input_tokens: Optional[int], output_tokens: Optional[int]) -> float:
    """Calculate cost based on model-specific pricing."""
    if input_tokens is None and output_tokens is None:
        return 0.0
    
    input_tokens = input_tokens or 0
    output_tokens = output_tokens or 0
    
    # Look up pricing, fallback to default
    if model and model in MODEL_PRICING:
        input_price, output_price = MODEL_PRICING[model]
    else:
        input_price, output_price = DEFAULT_INPUT_PRICE, DEFAULT_OUTPUT_PRICE
    
    # Convert from price per 1M tokens to per token
    input_cost = (input_tokens / 1_000_000) * input_price
    output_cost = (output_tokens / 1_000_000) * output_price
    
    return input_cost + output_cost


def _apply_usage_to_span(span: SpanInput, usage: Any) -> None:
    input_tokens, output_tokens, total_tokens = _extract_usage_fields(usage)
    
    _debug_log(f"Applying usage to span '{span.name}':", {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
        "raw_usage": usage
    })
    
    if input_tokens is None and output_tokens is None and total_tokens is None:
        return

    if input_tokens is not None:
        span.input_tokens = input_tokens
    if output_tokens is not None:
        span.output_tokens = output_tokens
    if total_tokens is None:
        total_tokens = (input_tokens or 0) + (output_tokens or 0)
    span.tokens = total_tokens
    
    # Calculate cost based on model-specific pricing
    span.cost = _calculate_cost(span.model, input_tokens, output_tokens)


def _apply_usage_to_trace(trace: TraceInput, usage: Any) -> None:
    _, _, total_tokens = _extract_usage_fields(usage)
    
    _debug_log(f"Applying usage to trace '{trace.name}':", {
        "total_tokens": total_tokens,
        "current_trace_tokens": trace.total_tokens,
        "raw_usage": usage
    })
    
    if total_tokens is None:
        return
    trace.total_tokens = (trace.total_tokens or 0) + total_tokens
    trace.cost = (trace.cost or 0.0) + (total_tokens * 0.00003)


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
            
            _debug_log(f"Starting trace '{trace_name}':", {
                "trace_id": str(trace_id),
                "user_id": resolved_user_id,
                "session_id": session_id,
                "args": [str(arg)[:100] for arg in args],
                "kwargs_keys": list(kwargs.keys())
            })
            
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

            _debug_log(f"Captured user input:", {"user_input": user_input[:200]})

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
                
                _debug_log(f"Captured assistant output:", {"output": str(trace.assistant_output)[:200]})
                
            except Exception as e:
                error_msg = str(e)
                trace.assistant_output = f"Error: {e}"
                trace.error = error_msg
                _debug_log(f"Error in trace '{trace_name}':", {"error": error_msg})
                raise
            finally:
                trace.end_time = datetime.utcnow()
                
                # Aggregate metrics from spans if not set on trace
                if (trace.total_tokens is None or trace.total_tokens == 0) and trace.spans:
                    calculated_tokens = 0
                    calculated_cost = 0.0
                    for s in trace.spans:
                        if s.tokens:
                            calculated_tokens += s.tokens
                        if s.cost:
                            calculated_cost += s.cost
                    
                    if calculated_tokens > 0:
                        trace.total_tokens = calculated_tokens
                        if trace.cost is None or trace.cost == 0.0:
                            trace.cost = calculated_cost
                
                # Run Evaluator if provided and no error
                if evaluator and not error_msg:
                    try:
                        eval_result = evaluator.evaluate(trace)
                        trace.evaluation = eval_result
                        _debug_log("Evaluation result:", eval_result)
                    except Exception as e:
                        print(f"[Auditi] Evaluator failed: {e}")

                # Prepare and log payload
                trace_payload = trace.model_dump(mode='json')
                _debug_log(f"Sending trace payload for '{trace_name}':", trace_payload)
                
                # Send Trace
                client.transport.send_trace(trace_payload)
                
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
                # Try to get from bound arguments (handles defaults)
                try:
                    import inspect
                    sig = inspect.signature(func)
                    bound = sig.bind(*args, **kwargs)
                    bound.apply_defaults()
                    if "model" in bound.arguments:
                        effective_model = str(bound.arguments["model"])
                except Exception:
                    pass

            # Fallback to checking args/kwargs directly if bind fails
            if not effective_model:
                if "model" in kwargs:
                    effective_model = str(kwargs["model"])
                elif args and hasattr(args[0], "model"):
                    effective_model = str(args[0].model)

            _debug_log(f"Starting span '{span_name}' (type: {span_type}):", {
                "span_id": str(span_id),
                "parent_id": str(parent.id) if parent else None,
                "model": effective_model,
                "trace_id": str(trace.id)
            })

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
                # Smart output capture for various LLM response types
                
                # OpenAI ChatCompletion object (has choices array)
                if hasattr(result, "choices") and result.choices:
                    try:
                        choice = result.choices[0]
                        if hasattr(choice, "message") and hasattr(choice.message, "content"):
                            span.outputs = str(choice.message.content)[:2000]
                        elif hasattr(choice, "text"):  # Legacy completions API
                            span.outputs = str(choice.text)[:2000]
                    except (IndexError, AttributeError):
                        span.outputs = str(result)[:2000]
                    
                    # Extract model from response
                    if not span.model and hasattr(result, "model"):
                        span.model = str(result.model)
                    
                    # Extract usage from OpenAI response
                    if hasattr(result, "usage") and result.usage:
                        _apply_usage_to_span(span, result.usage)
                
                # Simple string result
                elif isinstance(result, str):
                    span.outputs = result[:2000]
                
                # Object with .content attribute (e.g., Anthropic)
                elif hasattr(result, "content"):
                    span.outputs = str(result.content)[:2000]
                    if not span.model and hasattr(result, "model"):
                        span.model = str(result.model)
                    if hasattr(result, "usage"):
                        try:
                            _apply_usage_to_span(span, result.usage)
                        except:
                            pass
                
                # Dict result (e.g., from custom LLM wrappers)
                elif isinstance(result, dict):
                    # Try to extract content from common keys
                    content = result.get("content") or result.get("text") or result.get("message") or str(result)
                    span.outputs = str(content)[:2000]
                    if not span.model:
                        model_name = result.get("model") or result.get("model_name")
                        if model_name:
                            span.model = str(model_name)
                    if "usage" in result:
                        _apply_usage_to_span(span, result["usage"])
                
                # Fallback for unknown types
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
                
                _debug_log(f"Span '{span_name}' completed successfully:", {
                    "output_length": len(str(span.outputs)),
                    "model": span.model,
                    "tokens": span.tokens if hasattr(span, 'tokens') else None
                })
                
                return result
            except Exception as e:
                span.error = str(e)
                span.status = "error"
                _debug_log(f"Span '{span_name}' failed:", {"error": str(e)})
                raise
            finally:
                span.end_time = datetime.utcnow()
                pop_span()
                
                # Log span payload before adding to trace
                span_payload = span.model_dump(mode='json')
                _debug_log(f"Adding span '{span_name}' to trace:", span_payload)
                
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