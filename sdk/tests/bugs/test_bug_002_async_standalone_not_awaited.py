"""
Bug #2: Async standalone trace calls sync _execute_as_standalone_trace.

The original _execute_as_standalone_trace at line 233 does:
    result = func(*args, **kwargs)
...without await. For async functions, this produces a coroutine object.

Fix: Created _execute_as_standalone_trace_async that properly awaits.
The async_span_wrapper now calls the async version.
"""
import asyncio
from unittest.mock import MagicMock


def test_sync_call_on_async_produces_coroutine():
    """Demonstrates the root cause: calling async func without await gives a coroutine."""

    async def my_async_func():
        return "expected_result"

    result = my_async_func()  # No await!
    assert asyncio.iscoroutine(result), (
        "Calling async func without await should produce a coroutine"
    )
    result.close()


def test_async_standalone_trace_returns_correct_value():
    """After fix, _execute_as_standalone_trace_async properly awaits."""
    from auditi.decorators import _execute_as_standalone_trace_async
    import auditi.client as client_module
    from auditi.client import AuditiClient

    captured = []
    mock_transport = MagicMock()
    mock_transport.send_trace = lambda payload: captured.append(payload)
    mock_client = AuditiClient()
    mock_client.transport = mock_transport
    original = client_module._client_instance
    client_module._client_instance = mock_client

    try:
        async def my_async_tool(prompt: str) -> str:
            return f"response to: {prompt}"

        result = asyncio.get_event_loop().run_until_complete(
            _execute_as_standalone_trace_async(
                my_async_tool, ("hello",), {}, "llm", None, None
            )
        )

        # FIXED: result should be the actual string, not a coroutine
        assert result == "response to: hello", (
            f"Expected actual result, got {type(result)}: {result}"
        )
        assert len(captured) == 1, "Trace should have been sent"
    finally:
        client_module._client_instance = original


def test_original_sync_standalone_still_works():
    """Sync _execute_as_standalone_trace still works for sync functions."""
    from auditi.decorators import _execute_as_standalone_trace
    import auditi.client as client_module
    from auditi.client import AuditiClient

    captured = []
    mock_transport = MagicMock()
    mock_transport.send_trace = lambda payload: captured.append(payload)
    mock_client = AuditiClient()
    mock_client.transport = mock_transport
    original = client_module._client_instance
    client_module._client_instance = mock_client

    try:
        def my_sync_tool(prompt: str) -> str:
            return f"sync response to: {prompt}"

        result = _execute_as_standalone_trace(
            my_sync_tool, ("hello",), {}, "llm", None, None
        )

        assert result == "sync response to: hello"
        assert len(captured) == 1
    finally:
        client_module._client_instance = original
