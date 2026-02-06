"""
Bug #3: trace_agent sync wrapper never clears trace context after sending.

In decorators.py, the trace_agent sync wrapper and async wrapper both call
client.transport.send_trace() but never call clear_current_trace().
This was fixed by adding clear_current_trace() in the finally block.

This test verifies the fix is in place.
"""
from unittest.mock import MagicMock
from auditi.context import get_current_trace, clear_current_trace
import auditi.client as client_module
from auditi.client import AuditiClient
from auditi.decorators import trace_agent


def _setup_mock_client():
    """Set up a mock client so traces don't require a real backend."""
    captured = []
    mock_transport = MagicMock()
    mock_transport.send_trace = lambda payload: captured.append(payload)
    mock_client = AuditiClient()
    mock_client.transport = mock_transport
    original = client_module._client_instance
    client_module._client_instance = mock_client
    return original, captured


def _restore_client(original):
    client_module._client_instance = original
    clear_current_trace()


def test_trace_agent_sync_clears_context():
    """After fix, sync trace_agent properly clears context."""
    original, captured = _setup_mock_client()
    try:
        @trace_agent(name="test_sync_agent")
        def my_agent(query: str) -> str:
            return f"answer to {query}"

        clear_current_trace()
        assert get_current_trace() is None

        my_agent("test question")

        # FIXED: trace context should be cleared after the wrapper completes
        assert get_current_trace() is None, (
            "trace_agent sync wrapper should clear context after send_trace"
        )
    finally:
        _restore_client(original)


def test_trace_sent_and_context_cleared():
    """Verify trace IS sent AND context is properly cleared."""
    original, captured = _setup_mock_client()
    try:
        @trace_agent(name="test_send_agent")
        def my_agent(query: str) -> str:
            return f"answer to {query}"

        clear_current_trace()
        my_agent("test")

        assert len(captured) == 1, "Trace should have been sent"
        assert captured[0]["name"] == "test_send_agent"
        assert get_current_trace() is None, "Context should be cleared after send"
    finally:
        _restore_client(original)


def test_consecutive_traces_no_stale_context():
    """Multiple trace calls should not see stale context from previous calls."""
    original, captured = _setup_mock_client()
    try:
        @trace_agent(name="agent_1")
        def agent_1(query: str) -> str:
            return "response 1"

        @trace_agent(name="agent_2")
        def agent_2(query: str) -> str:
            current = get_current_trace()
            # Inside agent_2, there should be a fresh trace, not stale from agent_1
            assert current is not None, "Should have fresh trace context inside agent"
            assert current.name == "agent_2"
            return "response 2"

        clear_current_trace()
        agent_1("first call")
        assert get_current_trace() is None, "Context should be clean between calls"

        agent_2("second call")
        assert get_current_trace() is None, "Context should be clean after second call"

        assert len(captured) == 2
    finally:
        _restore_client(original)
