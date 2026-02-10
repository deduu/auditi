"""Tests for stream_wrappers module — streaming trace capture."""

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any, List, Optional
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from auditi.stream_wrappers import (
    AsyncStreamWrapper,
    ChunkData,
    SyncStreamWrapper,
    _detect_stream_type,
    _process_anthropic_chunk,
    _process_generic_chunk,
    _process_google_chunk,
    _process_openai_chat_chunk,
    _process_openai_responses_chunk,
    wrap_stream_if_needed,
)


# ---------------------------------------------------------------------------
# Helpers — mock objects that simulate LLM stream chunks
# ---------------------------------------------------------------------------


def _make_span(**overrides):
    """Create a minimal mock SpanInput."""
    span = SimpleNamespace(
        id=uuid4(),
        trace_id=uuid4(),
        name=overrides.get("name", "test-span"),
        span_type="llm",
        start_time=datetime.now(timezone.utc),
        end_time=None,
        processing_time=None,
        outputs=None,
        status=None,
        model=overrides.get("model", None),
        error=None,
        tokens=None,
        cost=None,
    )
    # model_dump for trace payload
    span.model_dump = MagicMock(return_value={"id": str(span.id)})
    return span


def _make_trace(**overrides):
    """Create a minimal mock TraceInput."""
    trace = SimpleNamespace(
        id=uuid4(),
        start_time=datetime.now(timezone.utc),
        end_time=None,
        assistant_output=None,
        total_tokens=None,
        cost=None,
        spans=[],
    )
    trace.model_dump = MagicMock(return_value={"id": str(trace.id)})
    return trace


def _make_client():
    """Create a mock AuditiClient with a mock transport."""
    client = SimpleNamespace()
    client.transport = SimpleNamespace()
    client.transport.send_trace = MagicMock()
    return client


# -- OpenAI Chat Completions mocks -----------------------------------------


def _chat_chunk(content=None, model="gpt-4o", usage=None):
    """Simulates a ChatCompletionChunk."""
    delta = SimpleNamespace(content=content, role=None, tool_calls=None)
    choice = SimpleNamespace(delta=delta, index=0, finish_reason=None)
    chunk = SimpleNamespace(
        choices=[choice],
        model=model,
        usage=usage,
    )
    return chunk


def _chat_usage(prompt=10, completion=20, total=30):
    return SimpleNamespace(
        prompt_tokens=prompt, completion_tokens=completion, total_tokens=total
    )


# -- OpenAI Responses API mocks --------------------------------------------


def _responses_text_delta(text):
    return SimpleNamespace(type="response.output_text.delta", delta=text)


def _responses_completed(model="gpt-4o", input_tokens=10, output_tokens=20):
    usage = SimpleNamespace(
        input_tokens=input_tokens, output_tokens=output_tokens, total_tokens=input_tokens + output_tokens
    )
    response = SimpleNamespace(model=model, usage=usage, output_text="full text")
    return SimpleNamespace(type="response.completed", response=response)


# -- Anthropic mocks -------------------------------------------------------


def _anthropic_message_start(model="claude-3-5-sonnet", input_tokens=15):
    usage = SimpleNamespace(input_tokens=input_tokens)
    message = SimpleNamespace(model=model, usage=usage)
    return SimpleNamespace(type="message_start", message=message)


def _anthropic_content_delta(text):
    delta = SimpleNamespace(text=text)
    return SimpleNamespace(type="content_block_delta", delta=delta)


def _anthropic_message_delta(output_tokens=25):
    usage = SimpleNamespace(output_tokens=output_tokens)
    return SimpleNamespace(type="message_delta", usage=usage)


# -- Google Gemini mocks ---------------------------------------------------


def _google_chunk(text, prompt_tokens=None, candidates_tokens=None):
    usage_meta = None
    if prompt_tokens is not None:
        usage_meta = SimpleNamespace(
            prompt_token_count=prompt_tokens,
            candidates_token_count=candidates_tokens,
            total_token_count=(prompt_tokens or 0) + (candidates_tokens or 0),
        )
    return SimpleNamespace(text=text, usage_metadata=usage_meta)


# -- Mock stream classes ---------------------------------------------------


class MockSyncStream:
    """A simple iterable that mimics an LLM stream."""

    def __init__(self, chunks):
        self._iter = iter(chunks)

    def __iter__(self):
        return self

    def __next__(self):
        return next(self._iter)


class MockAsyncStream:
    """A simple async iterable that mimics an async LLM stream."""

    def __init__(self, chunks):
        self._iter = iter(chunks)

    def __aiter__(self):
        return self

    async def __anext__(self):
        try:
            return next(self._iter)
        except StopIteration:
            raise StopAsyncIteration


# ===========================================================================
# Chunk processor tests
# ===========================================================================


class TestProcessOpenAIChatChunk:
    def test_extracts_content(self):
        chunk = _chat_chunk(content="Hello")
        data = _process_openai_chat_chunk(chunk)
        assert data.text == "Hello"

    def test_none_content_yields_no_text(self):
        chunk = _chat_chunk(content=None)
        data = _process_openai_chat_chunk(chunk)
        assert data.text is None

    def test_extracts_model(self):
        chunk = _chat_chunk(content="Hi", model="gpt-4o-mini")
        data = _process_openai_chat_chunk(chunk)
        assert data.model == "gpt-4o-mini"

    def test_extracts_usage_from_final_chunk(self):
        usage = _chat_usage(prompt=100, completion=50, total=150)
        chunk = _chat_chunk(content=None, usage=usage)
        data = _process_openai_chat_chunk(chunk)
        assert data.input_tokens == 100
        assert data.output_tokens == 50
        assert data.total_tokens == 150


class TestProcessOpenAIResponsesChunk:
    def test_text_delta(self):
        chunk = _responses_text_delta("Hello")
        data = _process_openai_responses_chunk(chunk)
        assert data.text == "Hello"

    def test_completed_event(self):
        chunk = _responses_completed(model="gpt-4o", input_tokens=50, output_tokens=100)
        data = _process_openai_responses_chunk(chunk)
        assert data.model == "gpt-4o"
        assert data.input_tokens == 50
        assert data.output_tokens == 100
        assert data.total_tokens == 150

    def test_unknown_event_type(self):
        chunk = SimpleNamespace(type="response.created")
        data = _process_openai_responses_chunk(chunk)
        assert data.text is None


class TestProcessAnthropicChunk:
    def test_message_start(self):
        chunk = _anthropic_message_start(model="claude-3-5-sonnet", input_tokens=15)
        data = _process_anthropic_chunk(chunk)
        assert data.model == "claude-3-5-sonnet"
        assert data.input_tokens == 15

    def test_content_block_delta(self):
        chunk = _anthropic_content_delta("world")
        data = _process_anthropic_chunk(chunk)
        assert data.text == "world"

    def test_message_delta(self):
        chunk = _anthropic_message_delta(output_tokens=25)
        data = _process_anthropic_chunk(chunk)
        assert data.output_tokens == 25


class TestProcessGoogleChunk:
    def test_extracts_text(self):
        chunk = _google_chunk("Hello from Gemini")
        data = _process_google_chunk(chunk)
        assert data.text == "Hello from Gemini"

    def test_extracts_usage(self):
        chunk = _google_chunk("Hi", prompt_tokens=10, candidates_tokens=20)
        data = _process_google_chunk(chunk)
        assert data.input_tokens == 10
        assert data.output_tokens == 20
        assert data.total_tokens == 30


class TestProcessGenericChunk:
    def test_string_chunk(self):
        data = _process_generic_chunk("plain text")
        assert data.text == "plain text"

    def test_object_with_text(self):
        data = _process_generic_chunk(SimpleNamespace(text="obj text"))
        assert data.text == "obj text"

    def test_object_with_content(self):
        data = _process_generic_chunk(SimpleNamespace(content="obj content"))
        assert data.text == "obj content"


# ===========================================================================
# Stream detection tests
# ===========================================================================


class TestDetectStreamType:
    def test_none_returns_none(self):
        assert _detect_stream_type(None) is None

    def test_string_returns_none(self):
        assert _detect_stream_type("hello") is None

    def test_dict_returns_none(self):
        assert _detect_stream_type({"key": "value"}) is None

    def test_list_returns_none(self):
        assert _detect_stream_type([1, 2, 3]) is None

    def test_int_returns_none(self):
        assert _detect_stream_type(42) is None

    def test_regular_object_returns_none(self):
        assert _detect_stream_type(SimpleNamespace(choices=[])) is None

    def test_openai_stream_by_module_name(self):
        """Mock an object whose class module looks like openai."""
        stream = MockSyncStream([])
        stream.__class__ = type("Stream", (), {"__module__": "openai._streaming"})
        result = _detect_stream_type(stream, span_name="OpenAI Chat Completion")
        assert result == "openai_chat"

    def test_openai_responses_stream_by_span_name(self):
        stream = MockSyncStream([])
        stream.__class__ = type("Stream", (), {"__module__": "openai._streaming"})
        result = _detect_stream_type(stream, span_name="OpenAI Response")
        assert result == "openai_responses"

    def test_anthropic_stream_by_module(self):
        stream = MockSyncStream([])
        stream.__class__ = type("MessageStream", (), {"__module__": "anthropic._streaming"})
        result = _detect_stream_type(stream)
        assert result == "anthropic"

    def test_anthropic_async_stream(self):
        stream = MockAsyncStream([])
        stream.__class__ = type(
            "AsyncMessageStream", (), {"__module__": "anthropic._streaming"}
        )
        result = _detect_stream_type(stream)
        assert result == "anthropic_async"


# ===========================================================================
# SyncStreamWrapper tests
# ===========================================================================


class TestSyncStreamWrapper:
    def test_yields_all_chunks_transparently(self):
        chunks = [_chat_chunk("Hello"), _chat_chunk(" world")]
        stream = MockSyncStream(chunks)
        span = _make_span()
        trace = _make_trace()
        client = _make_client()

        wrapper = SyncStreamWrapper(
            stream=stream,
            span=span,
            trace=trace,
            client=client,
            start_time=datetime.now(timezone.utc),
            chunk_processor=_process_openai_chat_chunk,
            is_standalone=True,
        )

        collected = list(wrapper)
        assert len(collected) == 2
        assert collected[0] is chunks[0]
        assert collected[1] is chunks[1]

    def test_accumulates_text_content(self):
        chunks = [_chat_chunk("Hello"), _chat_chunk(" world"), _chat_chunk("!")]
        stream = MockSyncStream(chunks)
        span = _make_span()
        trace = _make_trace()
        client = _make_client()

        wrapper = SyncStreamWrapper(
            stream=stream,
            span=span,
            trace=trace,
            client=client,
            start_time=datetime.now(timezone.utc),
            chunk_processor=_process_openai_chat_chunk,
            is_standalone=True,
        )
        list(wrapper)  # consume

        assert span.outputs == "Hello world!"

    def test_extracts_model(self):
        chunks = [_chat_chunk("Hi", model="gpt-4o-mini")]
        stream = MockSyncStream(chunks)
        span = _make_span()
        trace = _make_trace()
        client = _make_client()

        wrapper = SyncStreamWrapper(
            stream=stream,
            span=span,
            trace=trace,
            client=client,
            start_time=datetime.now(timezone.utc),
            chunk_processor=_process_openai_chat_chunk,
            is_standalone=True,
        )
        list(wrapper)

        assert span.model == "gpt-4o-mini"

    def test_extracts_usage_from_final_chunk(self):
        usage = _chat_usage(prompt=100, completion=50, total=150)
        chunks = [_chat_chunk("Hi"), _chat_chunk(None, usage=usage)]
        stream = MockSyncStream(chunks)
        span = _make_span()
        trace = _make_trace()
        client = _make_client()

        wrapper = SyncStreamWrapper(
            stream=stream,
            span=span,
            trace=trace,
            client=client,
            start_time=datetime.now(timezone.utc),
            chunk_processor=_process_openai_chat_chunk,
            is_standalone=True,
        )
        list(wrapper)

        # Usage should have been applied via _apply_usage
        # (the exact field depends on _apply_usage_to_span, but at minimum the wrapper
        #  captured the tokens)
        assert wrapper._input_tokens == 100
        assert wrapper._output_tokens == 50

    def test_finalizes_span_on_exhaustion(self):
        chunks = [_chat_chunk("done")]
        stream = MockSyncStream(chunks)
        span = _make_span()
        trace = _make_trace()
        client = _make_client()

        wrapper = SyncStreamWrapper(
            stream=stream,
            span=span,
            trace=trace,
            client=client,
            start_time=datetime.now(timezone.utc),
            chunk_processor=_process_openai_chat_chunk,
            is_standalone=True,
        )
        list(wrapper)

        assert span.status == "ok"
        assert span.end_time is not None
        assert span.processing_time is not None
        assert span.outputs == "done"

    def test_sends_trace_for_standalone(self):
        chunks = [_chat_chunk("ok")]
        stream = MockSyncStream(chunks)
        span = _make_span()
        trace = _make_trace()
        client = _make_client()

        wrapper = SyncStreamWrapper(
            stream=stream,
            span=span,
            trace=trace,
            client=client,
            start_time=datetime.now(timezone.utc),
            chunk_processor=_process_openai_chat_chunk,
            is_standalone=True,
        )
        list(wrapper)

        client.transport.send_trace.assert_called_once()
        assert trace.assistant_output == "ok"
        assert span in trace.spans

    def test_does_not_send_trace_for_nested(self):
        chunks = [_chat_chunk("nested")]
        stream = MockSyncStream(chunks)
        span = _make_span()
        trace = _make_trace()
        client = _make_client()

        wrapper = SyncStreamWrapper(
            stream=stream,
            span=span,
            trace=trace,
            client=client,
            start_time=datetime.now(timezone.utc),
            chunk_processor=_process_openai_chat_chunk,
            is_standalone=False,
        )
        list(wrapper)

        client.transport.send_trace.assert_not_called()
        assert span in trace.spans

    def test_handles_error_during_iteration(self):
        class ErrorStream:
            def __init__(self):
                self._count = 0

            def __iter__(self):
                return self

            def __next__(self):
                if self._count == 0:
                    self._count += 1
                    return _chat_chunk("partial")
                raise RuntimeError("stream broke")

        span = _make_span()
        trace = _make_trace()
        client = _make_client()

        wrapper = SyncStreamWrapper(
            stream=ErrorStream(),
            span=span,
            trace=trace,
            client=client,
            start_time=datetime.now(timezone.utc),
            chunk_processor=_process_openai_chat_chunk,
            is_standalone=True,
        )

        collected = []
        with pytest.raises(RuntimeError, match="stream broke"):
            for chunk in wrapper:
                collected.append(chunk)

        assert len(collected) == 1  # got partial chunk
        assert span.status == "error"
        assert span.error == "stream broke"
        assert span.outputs == "partial"

    def test_context_manager_pattern(self):
        chunks = [_chat_chunk("ctx")]
        inner_stream = MockSyncStream(chunks)
        # Add context manager support
        inner_stream.__enter__ = MagicMock(return_value=inner_stream)
        inner_stream.__exit__ = MagicMock(return_value=False)

        span = _make_span()
        trace = _make_trace()
        client = _make_client()

        wrapper = SyncStreamWrapper(
            stream=inner_stream,
            span=span,
            trace=trace,
            client=client,
            start_time=datetime.now(timezone.utc),
            chunk_processor=_process_openai_chat_chunk,
            is_standalone=True,
        )

        with wrapper as w:
            result = list(w)

        assert result[0] is chunks[0]
        assert span.status == "ok"
        inner_stream.__enter__.assert_called_once()
        inner_stream.__exit__.assert_called_once()

    def test_forwards_attribute_access(self):
        stream = MockSyncStream([])
        stream.response = SimpleNamespace(status=200)

        wrapper = SyncStreamWrapper(
            stream=stream,
            span=_make_span(),
            trace=_make_trace(),
            client=_make_client(),
            start_time=datetime.now(timezone.utc),
            chunk_processor=_process_openai_chat_chunk,
            is_standalone=True,
        )

        assert wrapper.response.status == 200

    def test_openai_responses_api_stream(self):
        """End-to-end test for OpenAI Responses API streaming."""
        chunks = [
            SimpleNamespace(type="response.created"),
            _responses_text_delta("Hello"),
            _responses_text_delta(" world"),
            _responses_completed(model="gpt-4o", input_tokens=10, output_tokens=20),
        ]
        stream = MockSyncStream(chunks)
        span = _make_span(name="OpenAI Response")
        trace = _make_trace()
        client = _make_client()

        wrapper = SyncStreamWrapper(
            stream=stream,
            span=span,
            trace=trace,
            client=client,
            start_time=datetime.now(timezone.utc),
            chunk_processor=_process_openai_responses_chunk,
            is_standalone=True,
        )
        collected = list(wrapper)

        assert len(collected) == 4
        assert span.outputs == "Hello world"
        assert span.model == "gpt-4o"
        assert span.status == "ok"


# ===========================================================================
# AsyncStreamWrapper tests
# ===========================================================================


class TestAsyncStreamWrapper:
    @pytest.mark.asyncio
    async def test_yields_all_chunks(self):
        chunks = [_chat_chunk("Hello"), _chat_chunk(" async")]
        stream = MockAsyncStream(chunks)
        span = _make_span()
        trace = _make_trace()
        client = _make_client()

        wrapper = AsyncStreamWrapper(
            stream=stream,
            span=span,
            trace=trace,
            client=client,
            start_time=datetime.now(timezone.utc),
            chunk_processor=_process_openai_chat_chunk,
            is_standalone=True,
        )

        collected = []
        async for chunk in wrapper:
            collected.append(chunk)

        assert len(collected) == 2

    @pytest.mark.asyncio
    async def test_accumulates_content(self):
        chunks = [_chat_chunk("Hello"), _chat_chunk(" async"), _chat_chunk("!")]
        stream = MockAsyncStream(chunks)
        span = _make_span()
        trace = _make_trace()
        client = _make_client()

        wrapper = AsyncStreamWrapper(
            stream=stream,
            span=span,
            trace=trace,
            client=client,
            start_time=datetime.now(timezone.utc),
            chunk_processor=_process_openai_chat_chunk,
            is_standalone=True,
        )
        async for _ in wrapper:
            pass

        assert span.outputs == "Hello async!"
        assert span.status == "ok"

    @pytest.mark.asyncio
    async def test_handles_error(self):
        class ErrorAsyncStream:
            def __init__(self):
                self._count = 0

            def __aiter__(self):
                return self

            async def __anext__(self):
                if self._count == 0:
                    self._count += 1
                    return _chat_chunk("partial")
                raise RuntimeError("async broke")

        span = _make_span()
        trace = _make_trace()
        client = _make_client()

        wrapper = AsyncStreamWrapper(
            stream=ErrorAsyncStream(),
            span=span,
            trace=trace,
            client=client,
            start_time=datetime.now(timezone.utc),
            chunk_processor=_process_openai_chat_chunk,
            is_standalone=True,
        )

        with pytest.raises(RuntimeError, match="async broke"):
            async for _ in wrapper:
                pass

        assert span.status == "error"
        assert span.outputs == "partial"

    @pytest.mark.asyncio
    async def test_sends_trace_standalone(self):
        chunks = [_chat_chunk("ok")]
        stream = MockAsyncStream(chunks)
        span = _make_span()
        trace = _make_trace()
        client = _make_client()

        wrapper = AsyncStreamWrapper(
            stream=stream,
            span=span,
            trace=trace,
            client=client,
            start_time=datetime.now(timezone.utc),
            chunk_processor=_process_openai_chat_chunk,
            is_standalone=True,
        )
        async for _ in wrapper:
            pass

        client.transport.send_trace.assert_called_once()


# ===========================================================================
# wrap_stream_if_needed tests
# ===========================================================================


class TestWrapStreamIfNeeded:
    def test_returns_unchanged_for_non_stream(self):
        """Non-stream objects should pass through unchanged."""
        response = SimpleNamespace(choices=[SimpleNamespace()], usage=None)
        span = _make_span()
        trace = _make_trace()
        client = _make_client()

        result, is_stream = wrap_stream_if_needed(
            result=response,
            span=span,
            trace=trace,
            client=client,
            start_time=datetime.now(timezone.utc),
            is_standalone=True,
        )

        assert result is response
        assert is_stream is False

    def test_returns_unchanged_for_string(self):
        result, is_stream = wrap_stream_if_needed(
            result="hello",
            span=_make_span(),
            trace=_make_trace(),
            client=_make_client(),
            start_time=datetime.now(timezone.utc),
            is_standalone=True,
        )
        assert result == "hello"
        assert is_stream is False

    def test_returns_unchanged_for_dict(self):
        result, is_stream = wrap_stream_if_needed(
            result={"content": "text"},
            span=_make_span(),
            trace=_make_trace(),
            client=_make_client(),
            start_time=datetime.now(timezone.utc),
            is_standalone=True,
        )
        assert is_stream is False

    def test_wraps_openai_like_stream(self):
        """An object with openai Stream-like class should be wrapped."""
        stream = MockSyncStream([_chat_chunk("test")])
        stream.__class__ = type("Stream", (), {"__module__": "openai._streaming"})

        span = _make_span(name="OpenAI Chat Completion")
        result, is_stream = wrap_stream_if_needed(
            result=stream,
            span=span,
            trace=_make_trace(),
            client=_make_client(),
            start_time=datetime.now(timezone.utc),
            is_standalone=True,
        )

        assert is_stream is True
        assert isinstance(result, SyncStreamWrapper)
