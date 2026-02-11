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
Stream wrappers for transparent trace capture during LLM streaming responses.

When stream=True is passed to an LLM API call, the response is an iterator
that yields chunks instead of a complete response object. These wrappers
intercept the iteration to accumulate content, extract model/usage data,
and finalize the trace once the stream is fully consumed.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Optional

logger = logging.getLogger("auditi.streaming")


# ---------------------------------------------------------------------------
# Chunk data
# ---------------------------------------------------------------------------


@dataclass
class ChunkData:
    """Data extracted from a single stream chunk."""

    text: Optional[str] = None
    model: Optional[str] = None
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    total_tokens: Optional[int] = None


# ---------------------------------------------------------------------------
# Chunk processors (one per provider)
# ---------------------------------------------------------------------------


def _process_openai_chat_chunk(chunk: Any) -> ChunkData:
    """Process an OpenAI Chat Completions stream chunk."""
    data = ChunkData()

    if hasattr(chunk, "model") and chunk.model:
        data.model = str(chunk.model)

    if hasattr(chunk, "choices") and chunk.choices:
        try:
            delta = chunk.choices[0].delta
            if hasattr(delta, "content") and delta.content is not None:
                data.text = str(delta.content)
        except (IndexError, AttributeError):
            pass

    # Usage only appears in the final chunk when stream_options.include_usage=True
    if hasattr(chunk, "usage") and chunk.usage is not None:
        usage = chunk.usage
        data.input_tokens = _safe_int(getattr(usage, "prompt_tokens", None))
        data.output_tokens = _safe_int(getattr(usage, "completion_tokens", None))
        data.total_tokens = _safe_int(getattr(usage, "total_tokens", None))

    return data


def _process_openai_responses_chunk(chunk: Any) -> ChunkData:
    """Process an OpenAI Responses API stream event."""
    data = ChunkData()
    event_type = getattr(chunk, "type", None)

    if event_type == "response.output_text.delta":
        data.text = getattr(chunk, "delta", None)

    elif event_type == "response.completed":
        response = getattr(chunk, "response", None)
        if response:
            data.model = _str_or_none(getattr(response, "model", None))
            usage = getattr(response, "usage", None)
            if usage:
                data.input_tokens = _safe_int(getattr(usage, "input_tokens", None))
                data.output_tokens = _safe_int(getattr(usage, "output_tokens", None))
                data.total_tokens = _safe_int(getattr(usage, "total_tokens", None))

    return data


def _process_anthropic_chunk(chunk: Any) -> ChunkData:
    """Process an Anthropic MessageStream event."""
    data = ChunkData()
    event_type = getattr(chunk, "type", None)

    if event_type == "message_start":
        message = getattr(chunk, "message", None)
        if message:
            data.model = _str_or_none(getattr(message, "model", None))
            usage = getattr(message, "usage", None)
            if usage:
                data.input_tokens = _safe_int(getattr(usage, "input_tokens", None))

    elif event_type == "content_block_delta":
        delta = getattr(chunk, "delta", None)
        if delta:
            data.text = getattr(delta, "text", None)

    elif event_type == "message_delta":
        usage = getattr(chunk, "usage", None)
        if usage:
            data.output_tokens = _safe_int(getattr(usage, "output_tokens", None))

    return data


def _process_google_chunk(chunk: Any) -> ChunkData:
    """Process a Google Gemini stream chunk."""
    data = ChunkData()

    if hasattr(chunk, "text"):
        try:
            data.text = str(chunk.text)
        except Exception:
            pass
    elif hasattr(chunk, "candidates") and chunk.candidates:
        try:
            part = chunk.candidates[0].content.parts[0]
            data.text = str(part.text)
        except (IndexError, AttributeError):
            pass

    usage_meta = getattr(chunk, "usage_metadata", None)
    if usage_meta:
        data.input_tokens = _safe_int(getattr(usage_meta, "prompt_token_count", None))
        data.output_tokens = _safe_int(getattr(usage_meta, "candidates_token_count", None))
        data.total_tokens = _safe_int(getattr(usage_meta, "total_token_count", None))

    return data


def _process_generic_chunk(chunk: Any) -> ChunkData:
    """Fallback processor for unrecognised stream types."""
    data = ChunkData()
    if isinstance(chunk, str):
        data.text = chunk
    elif hasattr(chunk, "text"):
        data.text = str(chunk.text)
    elif hasattr(chunk, "content"):
        data.text = str(chunk.content)
    return data


# ---------------------------------------------------------------------------
# Stream detection
# ---------------------------------------------------------------------------


def _detect_stream_type(result: Any, span_name: str = "") -> Optional[str]:
    """
    Classify a result as a known stream type, or return ``None``.

    Returns one of:
        "openai_chat", "openai_chat_async",
        "openai_responses", "openai_responses_async",
        "anthropic", "anthropic_async",
        "google", "google_async",
        "generic", "generic_async",
        None
    """
    if result is None or isinstance(result, (str, bytes, dict, list, int, float, bool)):
        return None

    type_name = type(result).__name__
    module_name = getattr(type(result), "__module__", "") or ""

    # --- OpenAI --------------------------------------------------------
    if "openai" in module_name.lower() or type_name in ("Stream", "AsyncStream"):
        try:
            from openai import AsyncStream as _OaiAsyncStream
            from openai import Stream as _OaiStream

            if isinstance(result, _OaiAsyncStream):
                if _is_responses_stream(span_name):
                    return "openai_responses_async"
                return "openai_chat_async"
            if isinstance(result, _OaiStream):
                if _is_responses_stream(span_name):
                    return "openai_responses"
                return "openai_chat"
        except ImportError:
            pass

        # Fallback: check by name when import fails
        if "Async" in type_name:
            if _is_responses_stream(span_name):
                return "openai_responses_async"
            return "openai_chat_async"
        if "Stream" in type_name:
            if _is_responses_stream(span_name):
                return "openai_responses"
            return "openai_chat"

    # --- Anthropic -----------------------------------------------------
    if "anthropic" in module_name.lower():
        if "async" in type_name.lower() or "Async" in type_name:
            return "anthropic_async"
        return "anthropic"

    # --- Google --------------------------------------------------------
    if "google" in module_name.lower():
        if hasattr(result, "__aiter__"):
            return "google_async"
        if hasattr(result, "__iter__"):
            return "google"

    return None


def _is_responses_stream(span_name: str) -> bool:
    """Distinguish OpenAI Responses API from Chat Completions by span name."""
    return "response" in span_name.lower() and "chat" not in span_name.lower()


# ---------------------------------------------------------------------------
# Sync stream wrapper
# ---------------------------------------------------------------------------


class SyncStreamWrapper:
    """
    Wraps a synchronous stream to transparently capture content, model, and
    usage data, then finalize the trace after the stream is fully consumed.
    """

    def __init__(
        self,
        stream: Any,
        span: Any,
        trace: Any,
        client: Any,
        start_time: "datetime",
        chunk_processor: Callable[[Any], ChunkData],
        is_standalone: bool,
    ):
        self._stream = stream
        self._span = span
        self._trace = trace
        self._client = client
        self._start_time = start_time
        self._chunk_processor = chunk_processor
        self._is_standalone = is_standalone

        self._accumulated_text: list[str] = []
        self._model: Optional[str] = None
        self._input_tokens: Optional[int] = None
        self._output_tokens: Optional[int] = None
        self._total_tokens: Optional[int] = None
        self._finalized: bool = False
        self._error: Optional[str] = None

    # -- iterator protocol ------------------------------------------------

    def __iter__(self):
        return self

    def __next__(self):
        try:
            chunk = next(self._stream)
            self._process_chunk(chunk)
            return chunk
        except StopIteration:
            self._finalize("ok")
            raise
        except Exception as e:
            self._error = str(e)
            self._finalize("error")
            raise

    # -- context-manager protocol -----------------------------------------

    def __enter__(self):
        if hasattr(self._stream, "__enter__"):
            self._stream.__enter__()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if hasattr(self._stream, "__exit__"):
            self._stream.__exit__(exc_type, exc_val, exc_tb)
        if not self._finalized:
            if exc_type is not None:
                self._error = str(exc_val) if exc_val else str(exc_type)
                self._finalize("error")
            else:
                self._finalize("ok")
        return False

    # -- attribute forwarding ---------------------------------------------

    def __getattr__(self, name: str):
        return getattr(self._stream, name)

    # -- safety net -------------------------------------------------------

    def __del__(self):
        if not self._finalized:
            try:
                self._finalize("ok")
            except Exception:
                pass

    # -- internals --------------------------------------------------------

    def _process_chunk(self, chunk: Any) -> None:
        try:
            data = self._chunk_processor(chunk)
            if data.text:
                self._accumulated_text.append(data.text)
            if data.model:
                self._model = data.model
            if data.input_tokens is not None:
                self._input_tokens = data.input_tokens
            if data.output_tokens is not None:
                self._output_tokens = data.output_tokens
            if data.total_tokens is not None:
                self._total_tokens = data.total_tokens
        except Exception:
            pass  # never break streaming on processing errors

    def _finalize(self, status: str) -> None:
        if self._finalized:
            return
        self._finalized = True

        end_time = datetime.now(timezone.utc)
        output_text = "".join(self._accumulated_text)

        # Span
        self._span.end_time = end_time
        self._span.processing_time = (end_time - self._start_time).total_seconds()
        self._span.outputs = output_text
        self._span.status = status
        if self._model and not self._span.model:
            self._span.model = self._model
        if self._error:
            self._span.error = self._error

        _apply_usage(
            self._span,
            self._input_tokens,
            self._output_tokens,
            self._total_tokens,
        )

        # Trace (standalone only sends; nested just appends)
        if self._is_standalone:
            self._trace.end_time = end_time
            self._trace.assistant_output = output_text
            self._trace.spans.append(self._span)
            if self._span.tokens:
                self._trace.total_tokens = self._span.tokens
            if self._span.cost:
                self._trace.cost = self._span.cost

            try:
                trace_payload = self._trace.model_dump(mode="json")
                self._client.transport.send_trace(trace_payload)
            except Exception as exc:
                logger.debug("Failed to send streaming trace: %s", exc)
        else:
            self._trace.spans.append(self._span)


# ---------------------------------------------------------------------------
# Async stream wrapper
# ---------------------------------------------------------------------------


class AsyncStreamWrapper:
    """
    Wraps an asynchronous stream to transparently capture content, model, and
    usage data, then finalize the trace after the stream is fully consumed.
    """

    def __init__(
        self,
        stream: Any,
        span: Any,
        trace: Any,
        client: Any,
        start_time: "datetime",
        chunk_processor: Callable[[Any], ChunkData],
        is_standalone: bool,
    ):
        self._stream = stream
        self._span = span
        self._trace = trace
        self._client = client
        self._start_time = start_time
        self._chunk_processor = chunk_processor
        self._is_standalone = is_standalone

        self._accumulated_text: list[str] = []
        self._model: Optional[str] = None
        self._input_tokens: Optional[int] = None
        self._output_tokens: Optional[int] = None
        self._total_tokens: Optional[int] = None
        self._finalized: bool = False
        self._error: Optional[str] = None

    # -- async iterator protocol ------------------------------------------

    def __aiter__(self):
        return self

    async def __anext__(self):
        try:
            chunk = await self._stream.__anext__()
            self._process_chunk(chunk)
            return chunk
        except StopAsyncIteration:
            self._finalize("ok")
            raise
        except Exception as e:
            self._error = str(e)
            self._finalize("error")
            raise

    # -- async context-manager protocol -----------------------------------

    async def __aenter__(self):
        if hasattr(self._stream, "__aenter__"):
            await self._stream.__aenter__()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if hasattr(self._stream, "__aexit__"):
            await self._stream.__aexit__(exc_type, exc_val, exc_tb)
        if not self._finalized:
            if exc_type is not None:
                self._error = str(exc_val) if exc_val else str(exc_type)
                self._finalize("error")
            else:
                self._finalize("ok")
        return False

    # -- attribute forwarding ---------------------------------------------

    def __getattr__(self, name: str):
        return getattr(self._stream, name)

    # -- safety net -------------------------------------------------------

    def __del__(self):
        if not self._finalized:
            try:
                self._finalize("ok")
            except Exception:
                pass

    # -- internals (shared with SyncStreamWrapper) ------------------------

    def _process_chunk(self, chunk: Any) -> None:
        try:
            data = self._chunk_processor(chunk)
            if data.text:
                self._accumulated_text.append(data.text)
            if data.model:
                self._model = data.model
            if data.input_tokens is not None:
                self._input_tokens = data.input_tokens
            if data.output_tokens is not None:
                self._output_tokens = data.output_tokens
            if data.total_tokens is not None:
                self._total_tokens = data.total_tokens
        except Exception:
            pass

    def _finalize(self, status: str) -> None:
        if self._finalized:
            return
        self._finalized = True

        end_time = datetime.now(timezone.utc)
        output_text = "".join(self._accumulated_text)

        self._span.end_time = end_time
        self._span.processing_time = (end_time - self._start_time).total_seconds()
        self._span.outputs = output_text
        self._span.status = status
        if self._model and not self._span.model:
            self._span.model = self._model
        if self._error:
            self._span.error = self._error

        _apply_usage(
            self._span,
            self._input_tokens,
            self._output_tokens,
            self._total_tokens,
        )

        if self._is_standalone:
            self._trace.end_time = end_time
            self._trace.assistant_output = output_text
            self._trace.spans.append(self._span)
            if self._span.tokens:
                self._trace.total_tokens = self._span.tokens
            if self._span.cost:
                self._trace.cost = self._span.cost

            try:
                trace_payload = self._trace.model_dump(mode="json")
                self._client.transport.send_trace(trace_payload)
            except Exception as exc:
                logger.debug("Failed to send streaming trace: %s", exc)
        else:
            self._trace.spans.append(self._span)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def wrap_stream_if_needed(
    result: Any,
    span: Any,
    trace: Any,
    client: Any,
    start_time: "datetime",
    is_standalone: bool,
) -> tuple[Any, bool]:
    """
    If *result* is a recognised LLM stream, wrap it and return
    ``(wrapped_stream, True)``.  Otherwise return ``(result, False)``.
    """
    span_name = getattr(span, "name", "") or ""
    stream_type = _detect_stream_type(result, span_name)
    if stream_type is None:
        return result, False

    processor_map = {
        "openai_chat": _process_openai_chat_chunk,
        "openai_chat_async": _process_openai_chat_chunk,
        "openai_responses": _process_openai_responses_chunk,
        "openai_responses_async": _process_openai_responses_chunk,
        "anthropic": _process_anthropic_chunk,
        "anthropic_async": _process_anthropic_chunk,
        "google": _process_google_chunk,
        "google_async": _process_google_chunk,
        "generic": _process_generic_chunk,
        "generic_async": _process_generic_chunk,
    }
    processor = processor_map.get(stream_type, _process_generic_chunk)

    is_async = stream_type.endswith("_async")
    wrapper_cls = AsyncStreamWrapper if is_async else SyncStreamWrapper

    wrapped = wrapper_cls(
        stream=result,
        span=span,
        trace=trace,
        client=client,
        start_time=start_time,
        chunk_processor=processor,
        is_standalone=is_standalone,
    )

    logger.info("Wrapped %s stream for trace capture", stream_type)
    return wrapped, True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _safe_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _str_or_none(value: Any) -> Optional[str]:
    return str(value) if value is not None else None


def _apply_usage(
    span: Any,
    input_tokens: Optional[int],
    output_tokens: Optional[int],
    total_tokens: Optional[int],
) -> None:
    """Apply accumulated token usage to a span, using the provider abstraction."""
    if input_tokens is None and output_tokens is None and total_tokens is None:
        return

    try:
        from .decorators import _apply_usage_to_span

        usage_dict: dict[str, Any] = {}
        if input_tokens is not None:
            usage_dict["prompt_tokens"] = input_tokens
            usage_dict["input_tokens"] = input_tokens
        if output_tokens is not None:
            usage_dict["completion_tokens"] = output_tokens
            usage_dict["output_tokens"] = output_tokens
        if total_tokens is not None:
            usage_dict["total_tokens"] = total_tokens
        elif input_tokens is not None or output_tokens is not None:
            usage_dict["total_tokens"] = (input_tokens or 0) + (output_tokens or 0)

        _apply_usage_to_span(span, usage_dict)
    except Exception as exc:
        logger.debug("Failed to apply streaming usage to span: %s", exc)
