"""
Tracing decorators for instrumenting AI agents, tools, and LLM calls.

This version uses the provider abstraction layer for robust multi-provider support.
"""

import functools
import json
import os
from datetime import datetime, timezone
from uuid import uuid4
import asyncio
import inspect
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
from .events import EventType, INTERNAL_EVENTS, CONTENT_EVENTS

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


def _ensure_str_input(value: Any) -> str:
    """
    Convert various input formats to a plain string for user_input.

    Handles:
      - str: returned as-is
      - list of message dicts (OpenAI/chat format): extracts last user message content
      - dict with 'content' or 'message' key: extracts the value
      - anything else: str() conversion
    """
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        # Try to extract the last user message from chat-format messages
        for msg in reversed(value):
            if isinstance(msg, dict) and msg.get("role") == "user":
                content = msg.get("content", "")
                return str(content) if not isinstance(content, str) else content
        # Fallback: stringify the list
        return str(value)
    if isinstance(value, dict):
        return value.get("content") or value.get("message") or str(value)
    if value is None:
        return ""
    return str(value)


def _execute_as_standalone_trace(
    func: Callable,
    args: tuple,
    kwargs: dict,
    span_type: str,
    name: Optional[str],
    model: Optional[str],
) -> Any:
    """
    Execute a function as a standalone trace (no parent trace required).

    This creates a simple trace with the function result as the only content.
    Used when @trace_llm or @trace_tool is called with standalone=True
    outside of a @trace_agent context.
    """
    client = get_client()
    trace_id = uuid4()
    span_id = uuid4()
    start_time = datetime.now(timezone.utc)
    func_name = name or func.__name__

    # Extract user input from args/kwargs
    # Priority: check kwargs FIRST (more reliable), then positional args
    user_input = ""

    # First, try common kwarg names for user input
    raw = (
        kwargs.get("messages")  # OpenAI chat
        or kwargs.get("prompt")  # Generic
        or kwargs.get("message")  # Anthropic
        or kwargs.get("contents")  # Google Gemini
        or kwargs.get("query")  # Search-like
        or kwargs.get("input")  # Embeddings
        or kwargs.get("user_input")  # Custom
        or ""
    )
    if raw:
        user_input = _ensure_str_input(raw)

    # Fallback to positional args if no kwarg found, but skip self/cls
    if not user_input and args:
        start_idx = 0
        first_arg = args[0]
        # Check if first arg is likely 'self' or 'cls' (not a basic type)
        if not isinstance(first_arg, (str, int, float, bool, list, dict, tuple, type(None))):
            start_idx = 1

        if len(args) > start_idx:
            user_input = _ensure_str_input(args[start_idx])

    # Create trace
    # Read user_id and session_id from global context
    ctx = get_context()

    trace = TraceInput(
        id=trace_id,
        start_time=start_time,
        user_input=user_input,
        name=func_name,
        user_id=ctx.get("user_id"),
        conversation_id=ctx.get("session_id"),
        tags=["standalone", span_type],
    )
    set_current_trace(trace)

    # Create span
    span = SpanInput(
        id=span_id,
        trace_id=trace_id,
        name=func_name,
        span_type=span_type,
        start_time=start_time,
        inputs={"prompt": user_input} if user_input else {},
        model=model,
    )
    push_span(span)

    result = None
    error_msg = None

    try:
        result = func(*args, **kwargs)
        print(f"[Auditi] Standalone {span_type} trace captured.")

        # Extract model from response if not set
        if not span.model:
            provider = detect_provider(response=result)
            extracted_model = provider.extract_model(result)
            if extracted_model:
                span.model = extracted_model

        # Extract output and usage based on response type

        # OpenAI Responses API (has output_text, no choices)
        if hasattr(result, "output_text") and not hasattr(result, "choices"):
            output = str(result.output_text) if result.output_text else ""
            if not output and hasattr(result, "output") and result.output:
                try:
                    for item in result.output:
                        if hasattr(item, "content"):
                            for content_block in item.content:
                                if hasattr(content_block, "text"):
                                    output = str(content_block.text)
                                    break
                            if output:
                                break
                except (AttributeError, TypeError, IndexError):
                    output = str(result)

            trace.assistant_output = output
            span.outputs = output

            if hasattr(result, "usage") and result.usage:
                _apply_usage_to_span(span, result.usage, response=result)

        elif hasattr(result, "choices") and result.choices:
            # OpenAI Chat Completions response
            try:
                choice = result.choices[0]
                if hasattr(choice, "message") and hasattr(choice.message, "content"):
                    output = str(choice.message.content)
                elif hasattr(choice, "text"):
                    output = str(choice.text)
                else:
                    output = str(result)
            except (IndexError, AttributeError):
                output = str(result)

            trace.assistant_output = output
            span.outputs = output

            if hasattr(result, "usage") and result.usage:
                _apply_usage_to_span(span, result.usage, response=result)

        elif hasattr(result, "data"):
            # Embedding response (OpenAI embeddings have .data)
            if hasattr(result, "usage"):
                _apply_usage_to_span(span, result.usage, response=result)
            span.outputs = f"Generated {len(result.data)} embeddings"
            trace.assistant_output = span.outputs

        elif isinstance(result, str):
            trace.assistant_output = result
            span.outputs = result

        elif isinstance(result, dict):
            content = (
                result.get("content") or result.get("text") or result.get("response") or str(result)
            )
            trace.assistant_output = str(content)
            span.outputs = str(content)
            if "usage" in result:
                _apply_usage_to_span(span, result["usage"], response=result)

        elif hasattr(result, "content"):
            trace.assistant_output = str(result.content)
            span.outputs = str(result.content)
            if hasattr(result, "usage"):
                _apply_usage_to_span(span, result.usage, response=result)

        else:
            trace.assistant_output = str(result) if result else ""
            span.outputs = str(result) if result else ""

        span.status = "ok"

    except Exception as e:
        error_msg = str(e)
        trace.assistant_output = f"Error: {e}"
        trace.error = error_msg
        span.error = error_msg
        span.status = "error"
        raise

    finally:
        end_time = datetime.now(timezone.utc)
        span.end_time = end_time
        span.processing_time = (end_time - start_time).total_seconds()
        trace.end_time = end_time

        pop_span()
        trace.spans.append(span)

        # Aggregate metrics from span to trace
        if span.tokens:
            trace.total_tokens = span.tokens
        if span.cost:
            trace.cost = span.cost

        # Send trace
        trace_payload = trace.model_dump(mode="json")
        _debug_log(f"Sending standalone trace payload for '{func_name}':", trace_payload)
        client.transport.send_trace(trace_payload)

        # Clear context
        from .context import clear_current_trace

        clear_current_trace()

    return result


async def _execute_as_standalone_trace_async(
    func: Callable,
    args: tuple,
    kwargs: dict,
    span_type: str,
    name: Optional[str],
    model: Optional[str],
) -> Any:
    """
    Async version of _execute_as_standalone_trace.

    Properly awaits async functions instead of returning unawaited coroutines.
    """
    client = get_client()
    trace_id = uuid4()
    span_id = uuid4()
    start_time = datetime.now(timezone.utc)
    func_name = name or func.__name__

    user_input = ""
    raw = (
        kwargs.get("messages")
        or kwargs.get("prompt")
        or kwargs.get("message")
        or kwargs.get("contents")
        or kwargs.get("query")
        or kwargs.get("input")
        or kwargs.get("user_input")
        or ""
    )
    if raw:
        user_input = _ensure_str_input(raw)

    if not user_input and args:
        start_idx = 0
        first_arg = args[0]
        if not isinstance(first_arg, (str, int, float, bool, list, dict, tuple, type(None))):
            start_idx = 1
        if len(args) > start_idx:
            user_input = _ensure_str_input(args[start_idx])

    # Read user_id and session_id from global context
    ctx = get_context()

    trace = TraceInput(
        id=trace_id,
        start_time=start_time,
        user_input=user_input,
        name=func_name,
        user_id=ctx.get("user_id"),
        conversation_id=ctx.get("session_id"),
        tags=["standalone", span_type],
    )
    set_current_trace(trace)

    span = SpanInput(
        id=span_id,
        trace_id=trace_id,
        name=func_name,
        span_type=span_type,
        start_time=start_time,
        inputs={"prompt": user_input} if user_input else {},
        model=model,
    )
    push_span(span)

    result = None
    error_msg = None

    try:
        result = await func(*args, **kwargs)
        print(f"[Auditi] Standalone {span_type} trace captured.")

        if not span.model:
            provider = detect_provider(response=result)
            extracted_model = provider.extract_model(result)
            if extracted_model:
                span.model = extracted_model

        # OpenAI Responses API (has output_text, no choices)
        if hasattr(result, "output_text") and not hasattr(result, "choices"):
            output = str(result.output_text) if result.output_text else ""
            if not output and hasattr(result, "output") and result.output:
                try:
                    for item in result.output:
                        if hasattr(item, "content"):
                            for content_block in item.content:
                                if hasattr(content_block, "text"):
                                    output = str(content_block.text)
                                    break
                            if output:
                                break
                except (AttributeError, TypeError, IndexError):
                    output = str(result)

            trace.assistant_output = output
            span.outputs = output

            if hasattr(result, "usage") and result.usage:
                _apply_usage_to_span(span, result.usage, response=result)

        elif hasattr(result, "choices") and result.choices:
            # OpenAI Chat Completions response
            try:
                choice = result.choices[0]
                if hasattr(choice, "message") and hasattr(choice.message, "content"):
                    output = str(choice.message.content)
                elif hasattr(choice, "text"):
                    output = str(choice.text)
                else:
                    output = str(result)
            except (IndexError, AttributeError):
                output = str(result)
            trace.assistant_output = output
            span.outputs = output
            if hasattr(result, "usage") and result.usage:
                _apply_usage_to_span(span, result.usage, response=result)
        elif hasattr(result, "data"):
            if hasattr(result, "usage"):
                _apply_usage_to_span(span, result.usage, response=result)
            span.outputs = f"Generated {len(result.data)} embeddings"
            trace.assistant_output = span.outputs
        elif isinstance(result, str):
            trace.assistant_output = result
            span.outputs = result
        elif isinstance(result, dict):
            content = (
                result.get("content") or result.get("text") or result.get("response") or str(result)
            )
            trace.assistant_output = str(content)
            span.outputs = str(content)
            if "usage" in result:
                _apply_usage_to_span(span, result["usage"], response=result)
        elif hasattr(result, "content"):
            trace.assistant_output = str(result.content)
            span.outputs = str(result.content)
            if hasattr(result, "usage"):
                _apply_usage_to_span(span, result.usage, response=result)
        else:
            trace.assistant_output = str(result) if result else ""
            span.outputs = str(result) if result else ""

        span.status = "ok"

    except Exception as e:
        error_msg = str(e)
        trace.assistant_output = f"Error: {e}"
        trace.error = error_msg
        span.error = error_msg
        span.status = "error"
        raise

    finally:
        end_time = datetime.now(timezone.utc)
        span.end_time = end_time
        span.processing_time = (end_time - start_time).total_seconds()
        trace.end_time = end_time

        pop_span()
        trace.spans.append(span)

        if span.tokens:
            trace.total_tokens = span.tokens
        if span.cost:
            trace.cost = span.cost

        trace_payload = trace.model_dump(mode="json")
        _debug_log(f"Sending standalone trace payload for '{func_name}':", trace_payload)
        client.transport.send_trace(trace_payload)

        from .context import clear_current_trace
        clear_current_trace()

    return result


def trace_agent(
    name: Optional[str] = None,
    user_id: Optional[str] = None,
    evaluator: Optional[BaseEvaluator] = None,
    capture_input: bool = True,
) -> Callable:
    """
    Decorator to trace an entire agent interaction.
    Supports both sync and async functions, and handles instance methods.
    """

    def decorator(func: Callable) -> Callable:
        # Check if the function is async
        is_async = asyncio.iscoroutinefunction(func)

        if is_async:

            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs) -> Any:
                client = get_client()
                trace_id = uuid4()
                start_time = datetime.now(timezone.utc)

                trace_name = name or func.__name__

                # Smart extraction of context from kwargs or global context
                ctx = get_context()
                session_id = (
                    kwargs.get("session_id")
                    or kwargs.get("conversation_id")
                    or ctx.get("session_id")
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

                # Smart extraction of user input - SKIP SELF/CLS
                user_input = ""
                if capture_input and args:
                    # Determine starting index (skip 'self' or 'cls')
                    start_idx = 0
                    if args:
                        first_arg = args[0]
                        # Check if first arg is likely 'self' or 'cls'
                        # It's self/cls if it's an object that's not a basic type
                        if not isinstance(
                            first_arg, (str, int, float, bool, list, dict, tuple, type(None))
                        ):
                            start_idx = 1
                            _debug_log(
                                f"Skipping first argument (detected as self/cls): {type(first_arg)}"
                            )

                    # Get the actual user input from the correct position
                    if len(args) > start_idx:
                        user_input = _ensure_str_input(args[start_idx])

                # Also check for user_input/message/query in kwargs
                if not user_input:
                    raw = (
                        kwargs.get("user_input")
                        or kwargs.get("message")
                        or kwargs.get("messages")
                        or kwargs.get("query")
                        or kwargs.get("prompt")
                        or ""
                    )
                    user_input = _ensure_str_input(raw)

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
                    result = await func(*args, **kwargs)
                    print("[Auditi] Trace captured.")
                    if DEBUG:
                        print(f"result type: {type(result)}")
                        print(f"result: {str(result)[:200]}")

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
                    trace.end_time = datetime.now(timezone.utc)

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
                            # FIX: Map evaluation result to TraceInput fields
                            trace.status = eval_result.status
                            trace.score = eval_result.score
                            if eval_result.reason:
                                trace.eval_reason = eval_result.reason
                            if eval_result.failure_mode:
                                trace.failure_mode = eval_result.failure_mode

                            _debug_log("Evaluation result:", eval_result)
                        except Exception as e:
                            print(f"[Auditi] Evaluator failed: {e}")

                    # Prepare and log payload
                    trace_payload = trace.model_dump(mode="json")
                    _debug_log(f"Sending trace payload for '{trace_name}':", trace_payload)

                    # Send Trace
                    client.transport.send_trace(trace_payload)

                    # Clear context to prevent leaking into subsequent calls
                    from .context import clear_current_trace
                    clear_current_trace()

                return result

            return async_wrapper

        elif inspect.isasyncgenfunction(func):

            @functools.wraps(func)
            async def async_gen_wrapper(*args, **kwargs) -> Any:
                client = get_client()
                trace_id = uuid4()
                start_time = datetime.now(timezone.utc)

                trace_name = name or func.__name__

                # Smart extraction of context from kwargs or global context
                ctx = get_context()
                session_id = (
                    kwargs.get("session_id")
                    or kwargs.get("conversation_id")
                    or ctx.get("session_id")
                )
                resolved_user_id = kwargs.get("user_id") or user_id or ctx.get("user_id")

                _debug_log(
                    f"Starting async generator trace '{trace_name}':",
                    {
                        "trace_id": str(trace_id),
                        "user_id": resolved_user_id,
                        "session_id": session_id,
                        "args": [str(arg)[:100] for arg in args],
                        "kwargs_keys": list(kwargs.keys()),
                    },
                )

                # Smart extraction of user input - SKIP SELF/CLS
                user_input = ""
                if capture_input and args:
                    # Determine starting index (skip 'self' or 'cls')
                    start_idx = 0
                    if args:
                        first_arg = args[0]
                        # Check if first arg is likely 'self' or 'cls'
                        # It's self/cls if it's an object that's not a basic type
                        if not isinstance(
                            first_arg, (str, int, float, bool, list, dict, tuple, type(None))
                        ):
                            start_idx = 1

                    # Get the actual user input from the correct position
                    if len(args) > start_idx:
                        user_input = _ensure_str_input(args[start_idx])

                # Also check for user_input/message/query in kwargs
                if not user_input:
                    raw = (
                        kwargs.get("user_input")
                        or kwargs.get("message")
                        or kwargs.get("messages")
                        or kwargs.get("query")
                        or kwargs.get("prompt")
                        or ""
                    )
                    user_input = _ensure_str_input(raw)

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

                error_msg = None

                # Accumulators for streaming response
                accumulated_content = []
                final_content = None
                accumulated_model = None
                accumulated_usage = None

                try:
                    # Call the function to get the generator
                    gen = func(*args, **kwargs)

                    # Iterate through generator
                    async for item in gen:
                        yield item

                        # Process item for trace
                        if isinstance(item, str):
                            accumulated_content.append(item)
                        elif isinstance(item, dict):
                            # Handle different event types
                            evt_type = item.get("type")

                            # Token event
                            if evt_type == "token" and "content" in item:
                                accumulated_content.append(str(item["content"]))

                            # Complete event (often holds final answer/usage)
                            elif evt_type == "complete":
                                if "content" in item:
                                    final_content = str(item["content"])
                                if "usage" in item:
                                    accumulated_usage = item["usage"]
                                if "model" in item:
                                    accumulated_model = item["model"]

                            # Other events with content (fallback)
                            elif "content" in item:
                                # Start of new phase or just info, maybe not content to accumulate?
                                # Generative agents often send content chunks in 'content' field
                                if evt_type not in (
                                    "tool_exec_start",
                                    "tool_exec_end",
                                    "phase_start",
                                    "phase_end",
                                ):
                                    if isinstance(item["content"], str):
                                        # Be careful not to double count if 'token' events are used
                                        pass

                        elif hasattr(item, "content"):
                            accumulated_content.append(str(item.content))

                    # Determine final output and usage
                    if final_content is not None:
                        trace.assistant_output = final_content
                    else:
                        trace.assistant_output = "".join(accumulated_content)

                    # Apply usage if found
                    if accumulated_usage:
                        try:
                            _apply_usage_to_trace(trace, accumulated_usage, model=accumulated_model)
                        except Exception:
                            pass

                    print("[Auditi] Async generator trace captured.")
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
                    trace.end_time = datetime.now(timezone.utc)

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
                            # FIX: Map evaluation result to TraceInput fields
                            trace.status = eval_result.status
                            trace.score = eval_result.score
                            if eval_result.reason:
                                trace.eval_reason = eval_result.reason
                            if eval_result.failure_mode:
                                trace.failure_mode = eval_result.failure_mode

                            _debug_log("Evaluation result:", eval_result)
                        except Exception as e:
                            print(f"[Auditi] Evaluator failed: {e}")

                    # Prepare and log payload
                    trace_payload = trace.model_dump(mode="json")
                    _debug_log(f"Sending trace payload for '{trace_name}':", trace_payload)

                    # Send Trace
                    client.transport.send_trace(trace_payload)

            return async_gen_wrapper

        else:
            # Original sync wrapper (adapted with new improvements)
            @functools.wraps(func)
            def wrapper(*args, **kwargs) -> Any:
                client = get_client()
                trace_id = uuid4()
                start_time = datetime.now(timezone.utc)

                trace_name = name or func.__name__

                # Smart extraction of context from kwargs or global context
                ctx = get_context()
                session_id = (
                    kwargs.get("session_id")
                    or kwargs.get("conversation_id")
                    or ctx.get("session_id")
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

                # Smart extraction of user input - SKIP SELF/CLS
                user_input = ""
                if capture_input and args:
                    # Determine starting index (skip 'self' or 'cls')
                    start_idx = 0
                    if args:
                        first_arg = args[0]
                        # Check if first arg is likely 'self' or 'cls'
                        # It's self/cls if it's an object that's not a basic type
                        if not isinstance(
                            first_arg, (str, int, float, bool, list, dict, tuple, type(None))
                        ):
                            start_idx = 1
                            _debug_log(
                                f"Skipping first argument (detected as self/cls): {type(first_arg)}"
                            )

                    # Get the actual user input from the correct position
                    if len(args) > start_idx:
                        user_input = _ensure_str_input(args[start_idx])

                # Also check for user_input/message/query in kwargs
                if not user_input:
                    raw = (
                        kwargs.get("user_input")
                        or kwargs.get("message")
                        or kwargs.get("messages")
                        or kwargs.get("query")
                        or kwargs.get("prompt")
                        or ""
                    )
                    user_input = _ensure_str_input(raw)

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
                    trace.end_time = datetime.now(timezone.utc)

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
                            # FIX: Map evaluation result to TraceInput fields
                            trace.status = eval_result.status
                            trace.score = eval_result.score
                            if eval_result.reason:
                                trace.eval_reason = eval_result.reason
                            if eval_result.failure_mode:
                                trace.failure_mode = eval_result.failure_mode

                            _debug_log("Evaluation result:", eval_result)
                        except Exception as e:
                            print(f"[Auditi] Evaluator failed: {e}")

                    # Prepare and log payload
                    trace_payload = trace.model_dump(mode="json")
                    _debug_log(f"Sending trace payload for '{trace_name}':", trace_payload)

                    # Send Trace
                    client.transport.send_trace(trace_payload)

                    # Clear context to prevent leaking into subsequent calls
                    from .context import clear_current_trace
                    clear_current_trace()

                return result

            return wrapper

    return decorator


def _capture_inputs(func, args, kwargs, model_hint=None):
    """
    Helper to capture and normalize inputs from function arguments.
    Handles 'self' skipping, kwarg flattening, and fallback str conversion.
    """
    inputs = {}
    effective_model = model_hint

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
            if param and param.kind == inspect.Parameter.VAR_KEYWORD and isinstance(value, dict):
                inputs.update({k: str(v) for k, v in value.items()})
            else:
                inputs[arg_name] = str(value)

        # Check for model in arguments
        if not effective_model:
            if "model" in inputs:
                effective_model = inputs["model"]
            elif "model_id" in inputs:  # ADD THIS
                effective_model = inputs["model_id"]
            # Also check original bound args just in case normalization changed something
            elif "model" in bound.arguments:
                effective_model = str(bound.arguments["model"])
            elif "model_id" in bound.arguments:  # ADD THIS
                effective_model = str(bound.arguments["model_id"])

    except Exception:
        # Binding failed, ignore
        pass

    # Fallback model detection
    if not effective_model:
        if "model" in kwargs:
            effective_model = str(kwargs["model"])
        elif "model_id" in kwargs:  # ADD THIS
            effective_model = str(kwargs["model_id"])
        elif args and hasattr(args[0], "model"):
            effective_model = str(args[0].model)
        elif args and hasattr(args[0], "model_id"):  # ADD THIS
            effective_model = str(args[0].model_id)

    # Fallback input detection
    if not inputs:
        if args:
            first_arg = args[0]
            # Skip likely self/cls in fallback mode too (basic heuristic check)
            start_idx = 0
            if not isinstance(first_arg, (str, int, float, bool, list, dict, type(None))):
                start_idx = 1

            if len(args) > start_idx:
                val = args[start_idx]
                if isinstance(val, str):
                    inputs["prompt"] = val
                elif isinstance(val, (dict, list)):
                    inputs["data"] = val
                else:
                    inputs["input"] = str(val)

        if kwargs:
            inputs.update({k: str(v) for k, v in kwargs.items()})

    return inputs, effective_model


def _trace_span(
    span_type: str,
    name: Optional[str] = None,
    model: Optional[str] = None,
    standalone: bool = False,
) -> Callable:
    """
    Internal helper to create span tracing decorators.

    Args:
        span_type: Type of span ("llm", "tool", "embedding", etc.)
        name: Optional custom name for the span
        model: Optional model name
        standalone: If True, creates a standalone trace when no parent trace exists
    """

    def decorator(func: Callable) -> Callable:
        # Check for async generator first
        if inspect.isasyncgenfunction(func):

            @functools.wraps(func)
            async def async_gen_span_wrapper(*args, **kwargs) -> Any:
                trace = get_current_trace()
                if not trace:
                    if standalone:
                        # Create a standalone trace for this call
                        # Note: Simple detection for standalone async gen not fully implemented in _execute_as_standalone_trace yet
                        # For now, falling back to treating it as regular func (may need enhancement)
                        async for item in func(*args, **kwargs):
                            yield item
                    else:
                        async for item in func(*args, **kwargs):
                            yield item
                    return

                parent = get_current_span()
                span_id = uuid4()
                start_time = datetime.now(timezone.utc)
                span_name = name or func.__name__

                # Use robust input capture
                inputs, effective_model = _capture_inputs(func, args, kwargs, model)

                _debug_log(
                    f"Starting async generator span '{span_name}' (type: {span_type}):",
                    {
                        "span_id": str(span_id),
                        "parent_id": str(parent.id) if parent else None,
                        "model": effective_model,
                        "trace_id": str(trace.id),
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

                accumulated_outputs = []

                try:
                    # Execute async generator
                    gen = func(*args, **kwargs)

                    async for item in gen:
                        yield item
                        # Only accumulate relevant content
                        if isinstance(item, str):
                            accumulated_outputs.append(item)
                        elif isinstance(item, dict):
                            evt_type = item.get("type")

                            # Filter out internal events using standardized set
                            if evt_type in {e.value for e in INTERNAL_EVENTS}:
                                # Handle turn_metadata to extract usage before skipping
                                if evt_type == EventType.TURN_METADATA.value:
                                    if "usage" in item and item["usage"]:
                                        _apply_usage_to_span(span, item["usage"])
                                continue

                            # Accumulate content from content events
                            if evt_type == EventType.TOKEN.value and "content" in item:
                                accumulated_outputs.append(str(item["content"]))
                            elif evt_type == EventType.COMPLETE.value and "content" in item:
                                pass  # Complete event content handled elsewhere
                            elif "content" in item:
                                accumulated_outputs.append(str(item["content"]))

                        elif hasattr(item, "content"):
                            accumulated_outputs.append(str(item.content))
                        else:
                            accumulated_outputs.append(str(item))

                    # If usage was not found in stream but captured via other means (e.g. side channel), we rely on it being yields.

                    span.outputs = "".join(accumulated_outputs)
                    span.status = "ok"

                except Exception as e:
                    span.error = str(e)
                    span.status = "error"
                    _debug_log(f"Span '{span_name}' failed:", {"error": str(e)})
                    # Don't raise here if we are yielding? Actually we should raise to propagate error
                    raise
                finally:
                    span.end_time = datetime.now(timezone.utc)
                    span.processing_time = (span.end_time - span.start_time).total_seconds()
                    pop_span()

                    span_payload = span.model_dump(mode="json")
                    _debug_log(f"Adding span '{span_name}' to trace:", span_payload)
                    trace.spans.append(span)

            return async_gen_span_wrapper

        # Check for regular async function
        elif asyncio.iscoroutinefunction(func):

            @functools.wraps(func)
            async def async_span_wrapper(*args, **kwargs) -> Any:
                trace = get_current_trace()
                if not trace:
                    if standalone:
                        # Standalone async trace — use async version to properly await
                        return await _execute_as_standalone_trace_async(
                            func, args, kwargs, span_type, name, model
                        )
                    else:
                        return await func(*args, **kwargs)

                parent = get_current_span()
                span_id = uuid4()
                start_time = datetime.now(timezone.utc)
                span_name = name or func.__name__

                # Use robust input capture
                inputs, effective_model = _capture_inputs(func, args, kwargs, model)

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
                    result = await func(*args, **kwargs)

                    # Capture output
                    if isinstance(result, str):
                        span.outputs = result
                    elif hasattr(result, "content"):
                        span.outputs = str(result.content)
                    else:
                        span.outputs = str(result)

                    span.status = "ok"
                    return result

                except Exception as e:
                    span.error = str(e)
                    span.status = "error"
                    raise
                finally:
                    span.end_time = datetime.now(timezone.utc)
                    span.processing_time = (span.end_time - span.start_time).total_seconds()
                    pop_span()

                    span_payload = span.model_dump(mode="json")
                    _debug_log(f"Adding span '{span_name}' to trace:", span_payload)
                    trace.spans.append(span)

            return async_span_wrapper

        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            trace = get_current_trace()
            if not trace:
                if standalone:
                    # Create a standalone trace for this call
                    return _execute_as_standalone_trace(func, args, kwargs, span_type, name, model)
                else:
                    # Original behavior: just run the function normally
                    return func(*args, **kwargs)

            parent = get_current_span()
            span_id = uuid4()
            start_time = datetime.now(timezone.utc)
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
                        inputs.update({k: str(v) for k, v in value.items()})
                    else:
                        inputs[arg_name] = str(value)

                # Check for model in arguments
                if not effective_model:
                    if "model" in kwargs:
                        effective_model = str(kwargs["model"])
                    elif "model_id" in kwargs:  # ADD THIS
                        effective_model = str(kwargs["model_id"])
                    elif args and hasattr(args[0], "model"):
                        effective_model = str(args[0].model)
                    elif args and hasattr(args[0], "model_id"):  # ADD THIS
                        effective_model = str(args[0].model_id)

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
                    inputs.update({k: str(v) for k, v in kwargs.items()})

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

                # OpenAI Responses API (has output_text, no choices)
                if hasattr(result, "output_text") and not hasattr(result, "choices"):
                    span.outputs = str(result.output_text) if result.output_text else str(result)
                    if hasattr(result, "usage") and result.usage:
                        _apply_usage_to_span(span, result.usage, response=result)

                # OpenAI ChatCompletion object (has choices array)
                elif hasattr(result, "choices") and result.choices:
                    try:
                        choice = result.choices[0]
                        if hasattr(choice, "message") and hasattr(choice.message, "content"):
                            span.outputs = str(choice.message.content)
                        elif hasattr(choice, "text"):  # Legacy completions API
                            span.outputs = str(choice.text)
                    except (IndexError, AttributeError):
                        span.outputs = str(result)

                    # Extract usage from response using provider abstraction
                    if hasattr(result, "usage") and result.usage:
                        _apply_usage_to_span(span, result.usage, response=result)

                # Simple string result
                elif isinstance(result, str):
                    span.outputs = result

                # Object with .content attribute (e.g., Anthropic)
                elif hasattr(result, "content"):
                    span.outputs = str(result.content)

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
                    span.outputs = str(content)

                    # Extract usage
                    if "usage" in result:
                        _apply_usage_to_span(span, result["usage"], response=result)

                # Fallback for unknown types
                else:
                    span.outputs = str(result)

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
                span.end_time = datetime.now(timezone.utc)
                span.processing_time = (span.end_time - span.start_time).total_seconds()
                pop_span()

                # Log span payload before adding to trace
                span_payload = span.model_dump(mode="json")
                _debug_log(f"Adding span '{span_name}' to trace:", span_payload)

                trace.spans.append(span)

        return wrapper

    return decorator


def trace_tool(name: Optional[str] = None, standalone: bool = False) -> Callable:
    """
    Decorator to trace a tool/function call within an agent.

    Args:
        name: Optional custom name for the tool span
        standalone: If True, creates its own trace when not inside @trace_agent

    Example:
        >>> @trace_tool("database_search")
        ... def search_db(query: str) -> list:
        ...     return db.search(query)

        >>> # Standalone tool call (creates its own trace)
        >>> @trace_tool(standalone=True)
        ... def standalone_tool(data: str) -> str:
        ...     return process(data)
    """
    return _trace_span("tool", name, standalone=standalone)


def trace_llm(
    name: Optional[str] = None, model: Optional[str] = None, standalone: bool = False
) -> Callable:
    """
    Decorator to trace an LLM call within an agent.

    Args:
        name: Optional custom name for the LLM span
        model: Optional model name (auto-detected from response if not provided)
        standalone: If True, creates its own trace when not inside @trace_agent

    Example:
        >>> @trace_llm("generate_response", model="gpt-4")
        ... def call_gpt(prompt: str) -> str:
        ...     return openai.chat(prompt)

        >>> # Standalone LLM call (creates its own trace)
        >>> @trace_llm(standalone=True)
        ... def simple_chat(prompt: str) -> str:
        ...     return openai.chat(prompt)
    """
    return _trace_span("llm", name, model, standalone=standalone)


def trace_embedding(name: Optional[str] = None, model: Optional[str] = None) -> Callable:
    """
    Decorator to trace an embedding call. Always creates a standalone trace
    when not inside @trace_agent (embeddings are typically standalone operations).

    Args:
        name: Optional custom name for the embedding span
        model: Optional model name (auto-detected from response if not provided)

    Example:
        >>> @trace_embedding()
        ... def embed_text(text: str) -> list:
        ...     return openai.embeddings.create(input=text, model="text-embedding-3-small")
    """
    return _trace_span("embedding", name, model, standalone=True)


def trace_retrieval(name: Optional[str] = None) -> Callable:
    """
    Decorator to trace a retrieval/search operation (e.g., vector DB search).
    Always creates a standalone trace when not inside @trace_agent.

    Args:
        name: Optional custom name for the retrieval span

    Example:
        >>> @trace_retrieval("vector_search")
        ... def search_docs(query: str) -> list:
        ...     return vector_db.similarity_search(query)
    """
    return _trace_span("retrieval", name, standalone=True)
