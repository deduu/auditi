"""
Tests for user_id and session_id context propagation.

Verifies that standalone traces and auto-instrumented calls
capture user_id/session_id from global context.

Run with: pytest tests/test_user_context.py -v
"""

import pytest
from unittest.mock import MagicMock

from auditi import init, set_context, get_context
from auditi.decorators import trace_llm, trace_tool
from auditi.context import clear_current_trace, _global_context


@pytest.fixture(autouse=True)
def reset_state():
    """Reset trace and global context between tests."""
    clear_current_trace()
    _global_context.set({})
    yield
    clear_current_trace()
    _global_context.set({})


@pytest.fixture
def mock_transport():
    transport = MagicMock()
    transport.send_trace.return_value = None
    return transport


class TestStandaloneTraceContext:
    """Test that standalone traces read user_id/session_id from context."""

    def test_standalone_trace_reads_user_id(self, mock_transport):
        init(api_key="test", transport=mock_transport)
        set_context(user_id="user123", session_id="sess456")

        @trace_llm(name="TestLLM", standalone=True)
        def llm_call(prompt):
            return "response"

        llm_call("hello")

        mock_transport.send_trace.assert_called_once()
        payload = mock_transport.send_trace.call_args[0][0]
        assert payload["user_id"] == "user123"
        assert payload["conversation_id"] == "sess456"

    def test_standalone_trace_no_context_gives_null(self, mock_transport):
        init(api_key="test", transport=mock_transport)

        @trace_llm(name="TestLLM", standalone=True)
        def llm_call(prompt):
            return "response"

        llm_call("hello")

        mock_transport.send_trace.assert_called_once()
        payload = mock_transport.send_trace.call_args[0][0]
        assert payload["user_id"] is None
        assert payload["conversation_id"] is None

    @pytest.mark.asyncio
    async def test_standalone_trace_reads_user_id_async(self, mock_transport):
        init(api_key="test", transport=mock_transport)
        set_context(user_id="async_user", session_id="async_sess")

        @trace_llm(name="TestLLM", standalone=True)
        async def llm_call(prompt):
            return "async response"

        await llm_call("hello")

        mock_transport.send_trace.assert_called_once()
        payload = mock_transport.send_trace.call_args[0][0]
        assert payload["user_id"] == "async_user"
        assert payload["conversation_id"] == "async_sess"

    def test_standalone_tool_reads_user_id(self, mock_transport):
        init(api_key="test", transport=mock_transport)
        set_context(user_id="tool_user")

        @trace_tool(name="TestTool", standalone=True)
        def my_tool(query):
            return "result"

        my_tool("search query")

        payload = mock_transport.send_trace.call_args[0][0]
        assert payload["user_id"] == "tool_user"


class TestInitSetsContext:
    """Test that init() can set user_id/session_id in context."""

    def test_init_sets_user_id(self, mock_transport):
        init(api_key="test", transport=mock_transport, user_id="init_user")

        ctx = get_context()
        assert ctx["user_id"] == "init_user"

    def test_init_sets_session_id(self, mock_transport):
        init(api_key="test", transport=mock_transport, session_id="init_sess")

        ctx = get_context()
        assert ctx["session_id"] == "init_sess"

    def test_init_sets_both(self, mock_transport):
        init(
            api_key="test",
            transport=mock_transport,
            user_id="u1",
            session_id="s1",
        )

        ctx = get_context()
        assert ctx["user_id"] == "u1"
        assert ctx["session_id"] == "s1"

    def test_init_without_context_leaves_empty(self, mock_transport):
        init(api_key="test", transport=mock_transport)

        ctx = get_context()
        assert "user_id" not in ctx
        assert "session_id" not in ctx

    def test_init_user_id_flows_to_standalone_trace(self, mock_transport):
        init(api_key="test", transport=mock_transport, user_id="flow_user")

        @trace_llm(name="TestLLM", standalone=True)
        def llm_call(prompt):
            return "response"

        llm_call("hello")

        payload = mock_transport.send_trace.call_args[0][0]
        assert payload["user_id"] == "flow_user"
