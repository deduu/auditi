"""Tests for stream detection edge cases and defensive fallback behavior.

These tests verify that:
1. Undetected streams fall back gracefully (not stringified to "<...Stream object at 0x...>")
2. Exceptions during stream detection are handled gracefully
3. _is_likely_stream correctly identifies stream-like objects
4. Warnings are logged when streams are detected in fallback paths
"""

import logging
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from auditi.decorators import _is_likely_stream, trace_llm, trace_agent
from auditi.client import init
from auditi.context import clear_current_trace
from auditi.stream_wrappers import _detect_stream_type, wrap_stream_if_needed


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def mock_client():
    clear_current_trace()
    transport = MagicMock()
    transport.send_trace.return_value = None
    client = init(api_key="test-key", transport=transport)
    return client


# ---------------------------------------------------------------------------
# Helpers - mock stream objects
# ---------------------------------------------------------------------------


class FakeAsyncStream:
    """Mimics an openai.AsyncStream without being importable from openai."""

    def __aiter__(self):
        return self

    async def __anext__(self):
        raise StopAsyncIteration


class FakeSyncStream:
    """Mimics an openai.Stream without being importable from openai."""

    def __iter__(self):
        return self

    def __next__(self):
        raise StopIteration


class OpenAILikeAsyncStream:
    """A stream object whose module name contains 'openai'."""

    def __aiter__(self):
        return self

    async def __anext__(self):
        raise StopAsyncIteration


class CustomIterator:
    """A custom iterator that is NOT a stream."""

    def __init__(self, items):
        self._items = iter(items)

    def __iter__(self):
        return self

    def __next__(self):
        return next(self._items)


# ===========================================================================
# _is_likely_stream tests
# ===========================================================================


class TestIsLikelyStream:
    def test_none_returns_false(self):
        assert _is_likely_stream(None) is False

    def test_string_returns_false(self):
        assert _is_likely_stream("hello") is False

    def test_bytes_returns_false(self):
        assert _is_likely_stream(b"bytes") is False

    def test_dict_returns_false(self):
        assert _is_likely_stream({"key": "val"}) is False

    def test_list_returns_false(self):
        assert _is_likely_stream([1, 2, 3]) is False

    def test_int_returns_false(self):
        assert _is_likely_stream(42) is False

    def test_float_returns_false(self):
        assert _is_likely_stream(3.14) is False

    def test_bool_returns_false(self):
        assert _is_likely_stream(True) is False

    def test_regular_object_returns_false(self):
        """A SimpleNamespace with no iteration protocol should return False."""
        obj = SimpleNamespace(content="hello", choices=[])
        assert _is_likely_stream(obj) is False

    def test_object_with_stream_in_type_name(self):
        """Any object with 'stream' in its type name should be detected."""
        obj = FakeSyncStream()
        # FakeSyncStream has 'Stream' in its name
        assert _is_likely_stream(obj) is True

    def test_object_with_iterator_in_type_name_not_detected(self):
        """Object with 'Iterator' in type name but not 'stream' should NOT be detected."""

        class AsyncIterator:
            pass

        assert _is_likely_stream(AsyncIterator()) is False

    def test_object_with_generator_in_type_name_not_detected(self):
        """Object with 'Generator' in type name but not 'stream' should NOT be detected."""

        class ResponseGenerator:
            pass

        assert _is_likely_stream(ResponseGenerator()) is False

    def test_openai_module_async_object(self):
        """Object from openai module with __aiter__ should be detected."""
        obj = OpenAILikeAsyncStream()
        obj.__class__ = type("SomeObj", (), {"__module__": "openai._streaming"})
        # Re-add the async iter methods since we replaced the class
        obj.__class__.__aiter__ = lambda self: self
        obj.__class__.__anext__ = lambda self: None
        assert _is_likely_stream(obj) is True

    def test_openai_module_sync_object_with_next(self):
        """Object from openai module with __next__ should be detected."""
        obj = FakeSyncStream()
        obj.__class__ = type(
            "SomeStream", (object,), {
                "__module__": "openai._streaming",
                "__iter__": lambda self: self,
                "__next__": lambda self: (_ for _ in ()).throw(StopIteration),
            }
        )
        assert _is_likely_stream(obj) is True

    def test_custom_iterator_not_from_provider(self):
        """A plain custom iterator NOT from a known provider should return False."""
        obj = CustomIterator([1, 2, 3])
        assert _is_likely_stream(obj) is False


# ===========================================================================
# _detect_stream_type edge case tests
# ===========================================================================


class TestDetectStreamTypeEdgeCases:
    def test_openai_import_error_falls_through_to_name_check(self):
        """If openai import fails, detection still works via type name."""
        obj = FakeSyncStream()
        obj.__class__ = type("Stream", (), {"__module__": "openai._streaming"})
        # Even if openai import fails, the fallback checks type_name
        result = _detect_stream_type(obj, span_name="chat")
        assert result == "openai_chat"

    def test_openai_async_import_error_falls_through(self):
        obj = FakeAsyncStream()
        obj.__class__ = type("AsyncStream", (), {"__module__": "openai._streaming"})
        result = _detect_stream_type(obj, span_name="chat")
        assert result == "openai_chat_async"

    def test_warns_on_unrecognized_iterator(self, caplog):
        """Objects with iteration protocol from unknown modules should trigger warning."""

        class UnknownStream:
            def __aiter__(self):
                return self

            async def __anext__(self):
                raise StopAsyncIteration

        obj = UnknownStream()
        # Module is __main__ or similar - not openai/anthropic/google
        with caplog.at_level(logging.WARNING, logger="auditi.streaming"):
            result = _detect_stream_type(obj)

        assert result is None
        assert any("not recognized as stream" in r.message for r in caplog.records)

    def test_warns_on_unrecognized_sync_iterator(self, caplog):
        """Sync iterator from unknown module should also warn."""

        class UnknownSyncStream:
            def __iter__(self):
                return self

            def __next__(self):
                raise StopIteration

        obj = UnknownSyncStream()
        with caplog.at_level(logging.WARNING, logger="auditi.streaming"):
            result = _detect_stream_type(obj)

        assert result is None
        assert any("not recognized as stream" in r.message for r in caplog.records)


# ===========================================================================
# wrap_stream_if_needed error handling tests
# ===========================================================================


class TestWrapStreamIfNeededErrorHandling:
    def test_exception_in_detect_returns_false(self):
        """If _detect_stream_type raises, wrap_stream_if_needed should be safe."""
        span = SimpleNamespace(name="test")

        with patch(
            "auditi.stream_wrappers._detect_stream_type",
            side_effect=RuntimeError("detection failed"),
        ):
            # The function itself doesn't catch - the caller in decorators.py does
            # So we test that the exception propagates (to be caught by the try-except in decorators)
            with pytest.raises(RuntimeError, match="detection failed"):
                wrap_stream_if_needed(
                    result=FakeAsyncStream(),
                    span=span,
                    trace=SimpleNamespace(),
                    client=None,
                    start_time=datetime.now(timezone.utc),
                    is_standalone=False,
                )


# ===========================================================================
# Integration tests: stream objects in decorator fallback paths
# ===========================================================================


class TestStreamFallbackInDecorators:
    def test_standalone_sync_stream_fallback(self, mock_client, caplog):
        """A sync stream that escapes detection should produce a warning, not object repr."""

        class SneakyStream:
            """A stream whose type name doesn't contain 'stream'."""

            def __iter__(self):
                return self

            def __next__(self):
                raise StopIteration

        # Patch wrap_stream_if_needed at source to miss the stream
        with patch(
            "auditi.stream_wrappers.wrap_stream_if_needed",
            return_value=(SneakyStream(), False),
        ):

            @trace_llm(name="test_llm", standalone=True)
            def call_llm():
                stream = SneakyStream()
                # Give it a type name with 'stream' so _is_likely_stream catches it
                stream.__class__ = type("AsyncStream", (), {"__module__": "some.module"})
                return stream

            with caplog.at_level(logging.WARNING):
                result = call_llm()

        # The trace should NOT contain the raw object repr
        call_args = mock_client.transport.send_trace.call_args[0][0]
        assert "object at 0x" not in call_args.get("assistant_output", "")
        assert "[Stream object not consumed" in call_args.get("assistant_output", "")

    def test_standalone_async_stream_fallback(self, mock_client, caplog):
        """An async stream that escapes detection should produce a warning."""

        class SneakyAsyncStream:
            def __aiter__(self):
                return self

            async def __anext__(self):
                raise StopAsyncIteration

        with patch(
            "auditi.stream_wrappers.wrap_stream_if_needed",
            return_value=(SneakyAsyncStream(), False),
        ):

            @trace_llm(name="test_async_llm", standalone=True)
            async def call_llm_async():
                stream = SneakyAsyncStream()
                stream.__class__ = type("AsyncStream", (), {"__module__": "some.module"})
                return stream

            with caplog.at_level(logging.WARNING):
                import asyncio

                result = asyncio.get_event_loop().run_until_complete(call_llm_async())

        call_args = mock_client.transport.send_trace.call_args[0][0]
        assert "object at 0x" not in call_args.get("assistant_output", "")
        assert "[Stream object not consumed" in call_args.get("assistant_output", "")

    def test_wrap_exception_handled_gracefully(self, mock_client):
        """If wrap_stream_if_needed throws, the decorator should still work."""

        with patch(
            "auditi.stream_wrappers.wrap_stream_if_needed",
            side_effect=RuntimeError("wrap failed"),
        ):

            @trace_llm(name="test_error_handling", standalone=True)
            def call_llm():
                return "normal response"

            result = call_llm()

        # Function should still return normally
        assert result == "normal response"
        # Trace should still be sent
        mock_client.transport.send_trace.assert_called_once()
        call_args = mock_client.transport.send_trace.call_args[0][0]
        assert call_args["assistant_output"] == "normal response"

    def test_trace_agent_stream_fallback(self, mock_client, caplog):
        """trace_agent should also guard against stream objects in the else branch."""

        class AgentStreamResult:
            """Simulates a stream returned from an agent function."""

            pass

        # Give it a stream-like name
        AgentStreamResult.__name__ = "StreamResult"

        with caplog.at_level(logging.WARNING):

            @trace_agent(name="StreamAgent")
            def agent_func(query):
                return AgentStreamResult()

            result = agent_func("test query")

        call_args = mock_client.transport.send_trace.call_args[0][0]
        assert "object at 0x" not in call_args.get("assistant_output", "")
        assert "[Stream object not consumed" in call_args.get("assistant_output", "")

    def test_normal_result_not_affected(self, mock_client):
        """Normal (non-stream) results should pass through without change."""

        @trace_llm(name="normal_llm", standalone=True)
        def call_llm():
            return "Hello, world!"

        result = call_llm()
        assert result == "Hello, world!"

        call_args = mock_client.transport.send_trace.call_args[0][0]
        assert call_args["assistant_output"] == "Hello, world!"
