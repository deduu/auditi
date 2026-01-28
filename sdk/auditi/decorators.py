"""
Tracing decorators for instrumenting AI agents, tools, and LLM calls.

This version uses the provider abstraction layer for robust multi-provider support.
"""

import functools
import json
import os
from datetime import datetime
from uuid import uuid4
from typing import Optional, Callable, Any

from .types import TraceInput, SpanInput
from .context import (
    get_current_trace,
    set_current_trace,
    get_current_span,
    push_span,
    pop_span,
    get_context,
)
from .client import get_client
from .evaluator import BaseEvaluator
from .providers import detect_provider

# Debug flag - set via environment variable
DEBUG = os.getenv("AUDITI_DEBUG", "false").lower() in ("true", "1", "yes")


def _debug_log(message: str, data: Any = None) -> None:
    """Helper function to conditionally log debug information."""
    if DEBUG:
        print(f"[Auditi Debug] {message}")
        if data is not None:
            try:
                print(json.dumps(data, indent=2, default=str))
            except Exception as e:
                print(f"[Auditi Debug] Could not serialize data: {e}")
                print(f"Raw data: {data}")


def _apply_usage_to_span(span: SpanInput, usage: Any, response: Any = None) -> None:
    """
    Apply usage metrics to a span using provider abstraction.

    Args:
        span: The span to update
        usage: Raw usage object/dict from API response
        response: Optional full response object for provider detection
    """
    # Detect provider
    provider = detect_provider(model=span.model, response=response)

    _debug_log(
        f"Detected provider '{provider.name}' for span '{span.name}'",
        {"model": span.model, "provider": provider.name},
    )

    # Extract usage using provider-specific logic
    input_tokens, output_tokens, total_tokens = provider.extract_usage(usage)

    _debug_log(
        f"Extracted usage for span '{span.name}':",
        {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "provider": provider.name,
        },
    )

    # Update span
    if input_tokens is not None:
        span.input_tokens = input_tokens
    if output_tokens is not None:
        span.output_tokens = output_tokens
    if total_tokens is not None:
        span.tokens = total_tokens

    # Calculate cost using provider-specific pricing
    span.cost = provider.calculate_cost(span.model, input_tokens, output_tokens)

    _debug_log(
        f"Calculated cost for span '{span.name}':",
        {"cost": span.cost, "model": span.model, "provider": provider.name},
    )


def _apply_usage_to_trace(trace: TraceInput, usage: Any, model: Optional[str] = None) -> None:
    """
    Apply usage metrics to a trace using provider abstraction.

    Args:
        trace: The trace to update
        usage: Raw usage object/dict from API response
        model: Optional model name for provider detection
    """
    # Detect provider
    provider = detect_provider(model=model)

    # Extract usage
    input_tokens, output_tokens, total_tokens = provider.extract_usage(usage)

    _debug_log(
        f"Applying usage to trace '{trace.name}':",
        {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "current_trace_tokens": trace.total_tokens,
            "provider": provider.name,
        },
    )

    if total_tokens is None:
        return

    # Accumulate tokens
    trace.total_tokens = (trace.total_tokens or 0) + total_tokens

    # Calculate incremental cost
    incremental_cost = provider.calculate_cost(model, input_tokens, output_tokens)
    trace.cost = (trace.cost or 0.0) + incremental_cost


def trace_agent(
    name: Optional[str] = None,
    user_id: Optional[str] = None,
    evaluator: Optional[BaseEvaluator] = None,
    capture_input: bool = True,
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
            session_id = (
                kwargs.get("session_id") or kwargs.get("conversation_id") or ctx.get("session_id")
            )
            resolved_user_id = kwargs.get("user_id") or user_id or ctx.get("user_id")

            _debug_log(
                f"Starting trace '{trace_name}':",
                {
                    "trace_id": str(trace_id),
                    "user_id": resolved_user_id,
                    "session_id": session_id,
                    "args": [str(arg)[:100] for arg in args],
                    "kwargs_keys": list(kwargs.keys()),
                },
            )

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
                    kwargs.get("user_input")
                    or kwargs.get("message")
                    or kwargs.get("query")
                    or kwargs.get("prompt")
                    or ""
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
                if DEBUG:
                    print(f"result: {result}")

                # Smart extraction of assistant output
                if isinstance(result, str):
                    trace.assistant_output = result
                elif isinstance(result, dict):
                    trace.assistant_output = (
                        result.get("content")
                        or result.get("message")
                        or result.get("response")
                        or str(result)
                    )

                    # Extract model for provider detection
                    model = result.get("model")

                    # EXTRACT METRICS from result dict if available
                    if "usage" in result:
                        _apply_usage_to_trace(trace, result["usage"], model=model)

                elif hasattr(result, "content"):
                    trace.assistant_output = str(result.content)

                    # Extract model from response
                    model = getattr(result, "model", None)
                    if model:
                        model = str(model)

                    # Check for usage on object
                    if hasattr(result, "usage"):
                        try:
                            _apply_usage_to_trace(trace, result.usage, model=model)
                        except Exception as e:
                            _debug_log(f"Failed to extract usage from result object: {e}")

                else:
                    trace.assistant_output = str(result) if result else ""

                    # Try to extract model and usage
                    model = getattr(result, "model", None)
                    if model:
                        model = str(model)

                    if hasattr(result, "usage"):
                        try:
                            _apply_usage_to_trace(trace, result.usage, model=model)
                        except Exception as e:
                            _debug_log(f"Failed to extract usage: {e}")

                _debug_log(
                    f"Captured assistant output:", {"output": str(trace.assistant_output)[:200]}
                )

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
                trace_payload = trace.model_dump(mode="json")
                _debug_log(f"Sending trace payload for '{trace_name}':", trace_payload)

                # Send Trace
                client.transport.send_trace(trace_payload)

            return result

        return wrapper

    return decorator


def _trace_span(
    span_type: str, name: Optional[str] = None, model: Optional[str] = None
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

            # Auto-detect model and capture inputs using signature binding if available
            effective_model = model
            inputs = {}

            try:
                import inspect

                sig = inspect.signature(func)
                bound = sig.bind(*args, **kwargs)
                bound.apply_defaults()

                # Capture all arguments as inputs
                for arg_name, value in bound.arguments.items():
                    # Skip 'self' or 'cls' typically found in methods
                    if arg_name in ("self", "cls"):
                        continue
                    # Flatten **kwargs if they exist and are a dict
                    param = sig.parameters.get(arg_name)
                    if (
                        param
                        and param.kind == inspect.Parameter.VAR_KEYWORD
                        and isinstance(value, dict)
                    ):
                        inputs.update({k: str(v)[:500] for k, v in value.items()})
                    else:
                        inputs[arg_name] = str(value)[:500]

                # Check for model in arguments
                if not effective_model:
                    if "model" in inputs:
                        effective_model = inputs["model"]
                    # Also check original bound args just in case normalization changed something
                    elif "model" in bound.arguments:
                        effective_model = str(bound.arguments["model"])

            except Exception:
                # If binding fails, valid case for built-ins or certain wrappers
                pass

            # Fallback model detection (if signature extraction failed or didn't find model)
            if not effective_model:
                if "model" in kwargs:
                    effective_model = str(kwargs["model"])
                elif args and hasattr(args[0], "model"):
                    effective_model = str(args[0].model)

            # Fallback input detection (if signature extraction failed or resulted in empty inputs)
            if not inputs:
                if args:
                    first_arg = args[0]
                    if isinstance(first_arg, str):
                        inputs["prompt"] = first_arg
                    elif isinstance(first_arg, (dict, list)):
                        inputs["data"] = first_arg
                    else:
                        inputs["input"] = str(first_arg)
                if kwargs:
                    inputs.update({k: str(v)[:500] for k, v in kwargs.items()})

            _debug_log(
                f"Starting span '{span_name}' (type: {span_type}):",
                {
                    "span_id": str(span_id),
                    "parent_id": str(parent.id) if parent else None,
                    "model": effective_model,
                    "trace_id": str(trace.id),
                    "inputs_keys": list(inputs.keys()),
                },
            )

            span = SpanInput(
                id=span_id,
                trace_id=trace.id,
                parent_id=parent.id if parent else None,
                name=span_name,
                span_type=span_type,
                start_time=start_time,
                inputs=inputs,
                model=effective_model,
            )

            push_span(span)

            try:
                result = func(*args, **kwargs)

                # Use provider abstraction to extract model if not set
                if not span.model:
                    provider = detect_provider(response=result)
                    extracted_model = provider.extract_model(result)
                    if extracted_model:
                        span.model = extracted_model

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

                    # Extract usage from response using provider abstraction
                    if hasattr(result, "usage") and result.usage:
                        _apply_usage_to_span(span, result.usage, response=result)

                # Simple string result
                elif isinstance(result, str):
                    span.outputs = result[:2000]

                # Object with .content attribute (e.g., Anthropic)
                elif hasattr(result, "content"):
                    span.outputs = str(result.content)[:2000]

                    # Extract usage
                    if hasattr(result, "usage"):
                        try:
                            _apply_usage_to_span(span, result.usage, response=result)
                        except Exception as e:
                            _debug_log(f"Failed to extract usage from content object: {e}")

                # Dict result (e.g., from custom LLM wrappers)
                elif isinstance(result, dict):
                    # Try to extract content from common keys
                    content = (
                        result.get("content")
                        or result.get("text")
                        or result.get("message")
                        or str(result)
                    )
                    span.outputs = str(content)[:2000]

                    # Extract usage
                    if "usage" in result:
                        _apply_usage_to_span(span, result["usage"], response=result)

                # Fallback for unknown types
                else:
                    span.outputs = str(result)[:2000]

                    # Try to extract usage
                    if hasattr(result, "usage"):
                        try:
                            _apply_usage_to_span(span, result.usage, response=result)
                        except Exception as e:
                            _debug_log(f"Failed to extract usage from unknown type: {e}")

                span.status = "ok"

                _debug_log(
                    f"Span '{span_name}' completed successfully:",
                    {
                        "output_length": len(str(span.outputs)) if span.outputs else 0,
                        "model": span.model,
                        "tokens": span.tokens if hasattr(span, "tokens") and span.tokens else None,
                        "cost": span.cost if hasattr(span, "cost") else None,
                    },
                )

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
                span_payload = span.model_dump(mode="json")
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
