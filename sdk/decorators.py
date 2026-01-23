"""
Tracing decorators for instrumenting AI agents, tools, and LLM calls.

FIXED: 
- Proper token extraction and logging
- Processing time calculation for spans
- Enhanced debugging for token/cost tracking
"""
import functools
from datetime import datetime
from uuid import uuid4
from typing import Optional, Callable, Any

from .api_types import TraceInput, SpanInput
from .context import (
    get_current_trace, set_current_trace,
    get_current_span, push_span, pop_span,
    get_context
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
    """Extract token counts from usage object or dict."""
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
    """Apply usage data to span with detailed logging."""
    print(f"[DEBUG TOKENS] Attempting to extract tokens from usage: {type(usage)}")
    
    input_tokens, output_tokens, total_tokens = _extract_usage_fields(usage)
    
    print(f"[DEBUG TOKENS] Extracted: input={input_tokens}, output={output_tokens}, total={total_tokens}")
    
    if input_tokens is None and output_tokens is None and total_tokens is None:
        print(f"[DEBUG TOKENS] ⚠️ No token data extracted from usage")
        return

    if input_tokens is not None:
        span.input_tokens = input_tokens
        print(f"[DEBUG TOKENS] ✅ Set input_tokens: {input_tokens}")
    
    if output_tokens is not None:
        span.output_tokens = output_tokens
        print(f"[DEBUG TOKENS] ✅ Set output_tokens: {output_tokens}")
    
    if total_tokens is None:
        total_tokens = (input_tokens or 0) + (output_tokens or 0)
    
    span.tokens = total_tokens
    span.cost = total_tokens * 0.00003  # Example: $0.03 per 1K tokens
    
    print(f"[DEBUG TOKENS] ✅ Set total tokens: {total_tokens}, cost: ${span.cost:.6f}")


def _apply_usage_to_trace(trace: TraceInput, usage: Any) -> None:
    """Apply usage data to trace with detailed logging."""
    print(f"[DEBUG TOKENS] Applying usage to trace")
    
    _, _, total_tokens = _extract_usage_fields(usage)
    
    if total_tokens is None:
        print(f"[DEBUG TOKENS] ⚠️ No total tokens to apply to trace")
        return
    
    trace.total_tokens = (trace.total_tokens or 0) + total_tokens
    trace.cost = (trace.cost or 0.0) + (total_tokens * 0.00003)
    
    print(f"[DEBUG TOKENS] ✅ Trace totals: tokens={trace.total_tokens}, cost=${trace.cost:.6f}")


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
                first_arg = args[0]
                if isinstance(first_arg, str):
                    user_input = first_arg
                elif isinstance(first_arg, dict) and "message" in first_arg:
                    user_input = first_arg["message"]
                elif isinstance(first_arg, dict) and "content" in first_arg:
                    user_input = first_arg["content"]
                else:
                    user_input = str(first_arg)
            
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
                print(f"[Auditi] Trace {trace_id} captured.")
                
                # Smart extraction of assistant output
                if isinstance(result, str):
                    trace.assistant_output = result
                elif isinstance(result, dict):
                    trace.assistant_output = result.get("content") or result.get("message") or result.get("response") or str(result)
                    
                    # EXTRACT METRICS from result dict if available
                    if "usage" in result:
                        print(f"[DEBUG TOKENS] Found usage in result dict")
                        _apply_usage_to_trace(trace, result["usage"])

                elif hasattr(result, "content"):
                    trace.assistant_output = str(result.content)
                    
                    # Check for usage on object
                    if hasattr(result, "usage"):
                        print(f"[DEBUG TOKENS] Found usage attribute on result object")
                        try:
                            _apply_usage_to_trace(trace, result.usage)
                        except Exception as e:
                            print(f"[DEBUG TOKENS] ⚠️ Failed to extract usage from result: {e}")
                            
                else:
                    trace.assistant_output = str(result) if result else ""
                    if hasattr(result, "usage"):
                        print(f"[DEBUG TOKENS] Found usage attribute on result")
                        try:
                            _apply_usage_to_trace(trace, result.usage)
                        except Exception as e:
                            print(f"[DEBUG TOKENS] ⚠️ Failed to extract usage: {e}")
                            
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

                # Log summary
                print(f"[Auditi] Trace summary: {len(trace.spans)} spans, {trace.total_tokens or 0} tokens, ${trace.cost or 0:.6f}")

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

            print(f"\n[SPAN START] {span_type.upper()}: {span_name}")

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
                inputs.update({k: str(v)[:500] for k, v in kwargs.items()})

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
                
                # Calculate processing time
                span.end_time = datetime.utcnow()
                processing_time = (span.end_time - span.start_time).total_seconds()
                span.processing_time = processing_time
                
                print(f"[SPAN END] {span_type.upper()}: {span_name} (took {processing_time:.3f}s)")
                
                # Smart output capture
                if isinstance(result, str):
                    span.outputs = result[:2000]
                    print(f"[SPAN OUTPUT] String result: {len(result)} chars")
                    
                elif hasattr(result, "content"):
                    span.outputs = str(result.content)[:2000]
                    print(f"[SPAN OUTPUT] Object with content attribute")
                    
                    if not span.model and hasattr(result, "model"):
                        span.model = str(result.model)
                        print(f"[SPAN MODEL] Extracted model: {span.model}")
                    
                    # CRITICAL: Extract usage from LLM response
                    if hasattr(result, "usage"):
                        print(f"[SPAN USAGE] Found usage attribute on result")
                        print(f"[SPAN USAGE] Usage type: {type(result.usage)}")
                        print(f"[SPAN USAGE] Usage value: {result.usage}")
                        try:
                            _apply_usage_to_span(span, result.usage)
                            # Also apply to trace
                            _apply_usage_to_trace(trace, result.usage)
                        except Exception as e:
                            print(f"[SPAN USAGE] ⚠️ Failed to extract usage: {e}")
                            import traceback
                            traceback.print_exc()
                            
                elif isinstance(result, dict):
                    span.outputs = str(result)[:2000]
                    print(f"[SPAN OUTPUT] Dict result")
                    
                    if not span.model:
                        model_name = result.get("model") or result.get("model_name")
                        if model_name:
                            span.model = str(model_name)
                            print(f"[SPAN MODEL] Extracted model from dict: {span.model}")
                    
                    # CRITICAL: Extract usage from dict response
                    if "usage" in result:
                        print(f"[SPAN USAGE] Found 'usage' key in result dict")
                        print(f"[SPAN USAGE] Usage value: {result['usage']}")
                        try:
                            _apply_usage_to_span(span, result["usage"])
                            # Also apply to trace
                            _apply_usage_to_trace(trace, result["usage"])
                        except Exception as e:
                            print(f"[SPAN USAGE] ⚠️ Failed to extract usage from dict: {e}")
                            import traceback
                            traceback.print_exc()

                else:
                    span.outputs = str(result)[:2000]
                    print(f"[SPAN OUTPUT] Generic result: {type(result)}")
                    
                    if not span.model and hasattr(result, "model"):
                        span.model = str(result.model)
                    
                    if hasattr(result, "usage"):
                        print(f"[SPAN USAGE] Found usage on generic result")
                        try:
                            _apply_usage_to_span(span, result.usage)
                            _apply_usage_to_trace(trace, result.usage)
                        except Exception as e:
                            print(f"[SPAN USAGE] ⚠️ Failed: {e}")
                
                # Log final span stats
                print(f"[SPAN STATS] Tokens: {span.tokens or 0} (in:{span.input_tokens or 0}, out:{span.output_tokens or 0}), Cost: ${span.cost or 0:.6f}")
                
                span.status = "ok"
                return result
                
            except Exception as e:
                span.end_time = datetime.utcnow()
                processing_time = (span.end_time - span.start_time).total_seconds()
                span.processing_time = processing_time
                
                span.error = str(e)
                span.status = "error"
                print(f"[SPAN ERROR] {span_type.upper()}: {span_name} failed after {processing_time:.3f}s: {e}")
                raise
            finally:
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