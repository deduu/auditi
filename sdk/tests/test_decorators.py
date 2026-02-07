import pytest
from unittest.mock import MagicMock, patch
import asyncio
from auditi.decorators import trace_agent, trace_tool, trace_llm, _ensure_str_input
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


# --- Tests for _ensure_str_input and message-list handling ---


def test_ensure_str_input_with_string():
    assert _ensure_str_input("hello") == "hello"


def test_ensure_str_input_with_none():
    assert _ensure_str_input(None) == ""


def test_ensure_str_input_with_message_list():
    messages = [
        {"role": "user", "content": "What is AI?"},
        {"role": "assistant", "content": "AI is..."},
        {"role": "user", "content": "Tell me more"},
    ]
    assert _ensure_str_input(messages) == "Tell me more"


def test_ensure_str_input_with_single_user_message():
    messages = [{"role": "user", "content": "Hello world"}]
    assert _ensure_str_input(messages) == "Hello world"


def test_ensure_str_input_with_dict():
    assert _ensure_str_input({"content": "test"}) == "test"
    assert _ensure_str_input({"message": "test2"}) == "test2"


def test_trace_agent_with_messages_list(mock_client):
    """Test that trace_agent handles OpenAI-format message lists without crashing."""

    @trace_agent(name="ChatAgent")
    def chat_agent(messages):
        return f"Response to: {messages[-1]['content']}"

    messages = [{"role": "user", "content": "Jelaskan WAP"}]
    result = chat_agent(messages)

    assert result == "Response to: Jelaskan WAP"
    mock_client.transport.send_trace.assert_called_once()

    call_args = mock_client.transport.send_trace.call_args[0][0]
    assert call_args["user_input"] == "Jelaskan WAP"


def test_trace_input_validator_with_list():
    """Test that TraceInput.normalize_user_input handles list input."""
    from uuid import uuid4
    from datetime import datetime, timezone

    trace = TraceInput(
        id=uuid4(),
        start_time=datetime.now(timezone.utc),
        name="test",
        user_input=[{"role": "user", "content": "Hello from list"}],
    )
    assert trace.user_input == "Hello from list"
