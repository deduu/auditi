import pytest
from unittest.mock import MagicMock, patch
import asyncio
from auditi.decorators import trace_agent, trace_tool, trace_llm
from auditi.client import init
from auditi.context import clear_current_trace
from auditi.types import TraceInput


# Setup a mock client for all tests
@pytest.fixture(autouse=True)
def mock_client():
    # Clear any leftover context from prior tests
    clear_current_trace()

    transport = MagicMock()
    # Ensure send_trace returns None (as expected) or a value if needed
    transport.send_trace.return_value = None

    # Initialize global client with mock transport
    client = init(api_key="test-key", transport=transport)
    return client


def test_trace_agent_sync(mock_client):
    """Test tracing a synchronous agent function."""

    @trace_agent(name="TestAgent")
    def sync_agent(query):
        return f"Processed: {query}"

    result = sync_agent("hello")

    assert result == "Processed: hello"

    # Verify trace was sent
    mock_client.transport.send_trace.assert_called_once()

    # Inspect payload
    call_args = mock_client.transport.send_trace.call_args[0][0]
    assert call_args["name"] == "TestAgent"
    assert call_args["user_input"] == "hello"
    assert call_args["assistant_output"] == "Processed: hello"


def test_trace_tool_capture(mock_client):
    """Test tracing a tool call."""

    # We need a context for tool tracing to attach to a span usually,
    # but the current implementation might allow standalone or just
    # capturing execution if no parent span.
    # Let's test basic execution wrapper functionality.

    @trace_tool(name="search")
    def search_tool(query):
        return {"results": ["a", "b"]}

    # Run in a standalone context or mocked context if needed.
    # The decorator logic differentiates based on active context.
    # For this test, we verify it runs and returns.

    result = search_tool("audit")
    assert result == {"results": ["a", "b"]}


@pytest.mark.asyncio
async def test_trace_agent_async(mock_client):
    """Test tracing an asynchronous agent function."""

    @trace_agent(name="AsyncAgent")
    async def async_agent(message):
        return {"content": f"Async response to {message}", "usage": {"total_tokens": 10}}

    result = await async_agent("hi")

    assert result["content"] == "Async response to hi"

    # Verify trace was sent
    mock_client.transport.send_trace.assert_called_once()
    call_args = mock_client.transport.send_trace.call_args[0][0]

    assert call_args["name"] == "AsyncAgent"
    # Usage extraction logic might depend on providers,
    # but basic content extraction should work
    assert call_args["assistant_output"] == "Async response to hi"


def test_trace_llm_standalone(mock_client):
    """Test tracing an LLM call directly."""

    @trace_llm(name="GPT-4", model="gpt-4", standalone=True)
    def call_gpt(prompt):
        return "Generated text"

    result = call_gpt("make an image")

    assert result == "Generated text"

    # Should send a trace if standalone mode kicks in (which trace_llm triggers via _execute_as_standalone if no trace context)
    # Note: Logic in decorators.py checks for context.
    # If no context, trace_llm might act as standalone if designed so, or just pass through.
    # Based on my read, it calls _execute_as_standalone_trace if no current trace.

    assert mock_client.transport.send_trace.called
