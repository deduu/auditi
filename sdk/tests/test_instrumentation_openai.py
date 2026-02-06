"""
Tests for OpenAI instrumentation in the Auditi SDK.

These tests verify that:
1. Instrumentation patches OpenAI methods correctly
2. Traces are captured when OpenAI calls are made
3. Usage metrics (tokens, cost) are extracted properly
"""

import pytest
from unittest.mock import patch, MagicMock
import auditi
from auditi.transport import DebugTransport


class TestOpenAIInstrumentation:
    """Test that OpenAI instrumentation works correctly."""

    def setup_method(self):
        """Reset state before each test."""
        # Reset the global client instance
        import auditi.client as client_module
        client_module._client_instance = None

        # Reset OpenAI patching flag if it exists
        try:
            from openai.resources.chat.completions import Completions
            if hasattr(Completions.create, "_is_auditi_patched"):
                # Store original to restore later if needed
                pass
        except (ImportError, AttributeError):
            pass

    def test_instrumentation_initialization(self):
        """Test that auditi initializes without errors."""
        # Use DebugTransport to avoid real HTTP calls
        client = auditi.init(api_key="test-api-key", transport=DebugTransport())
        assert client is not None
        assert isinstance(client.transport, DebugTransport)

    def test_instrument_patches_openai(self):
        """Test that instrument() patches OpenAI's Completions.create method."""
        # Initialize auditi
        auditi.init(api_key="test-api-key", transport=DebugTransport())

        # Call instrument
        auditi.instrument(openai=True, anthropic=False, google=False)

        # Check that OpenAI was patched
        try:
            from openai.resources.chat.completions import Completions
            assert hasattr(Completions.create, "_is_auditi_patched")
            assert Completions.create._is_auditi_patched is True
        except ImportError:
            pytest.skip("OpenAI library not installed")

    def test_double_instrumentation_prevented(self):
        """Test that calling instrument() twice doesn't double-patch."""
        auditi.init(api_key="test-api-key", transport=DebugTransport())

        # Instrument twice
        auditi.instrument(openai=True, anthropic=False, google=False)
        auditi.instrument(openai=True, anthropic=False, google=False)

        # Should only be patched once (no error, flag still set)
        try:
            from openai.resources.chat.completions import Completions
            assert Completions.create._is_auditi_patched is True
        except ImportError:
            pytest.skip("OpenAI library not installed")


class TestTraceCapture:
    """Test that traces are properly captured and sent."""

    def setup_method(self):
        """Reset state before each test."""
        import auditi.client as client_module
        client_module._client_instance = None

    def test_trace_contains_expected_fields(self):
        """Test that captured traces have the expected structure."""
        sent_traces = []

        class MockTransport(DebugTransport):
            def send_trace(self, trace_data):
                sent_traces.append(trace_data)

        auditi.init(api_key="test-api-key", transport=MockTransport())

        # Use the trace_llm decorator directly for easier testing
        @auditi.trace_llm(name="test-llm-call", standalone=True)
        def mock_llm_call(messages):
            # Return a mock response matching OpenAI structure
            mock_msg = MagicMock()
            mock_msg.content = "Test response"

            mock_choice = MagicMock()
            mock_choice.message = mock_msg

            mock_usage = MagicMock()
            mock_usage.prompt_tokens = 5
            mock_usage.completion_tokens = 10
            mock_usage.total_tokens = 15

            mock_resp = MagicMock()
            mock_resp.choices = [mock_choice]
            mock_resp.usage = mock_usage
            mock_resp.model = "gpt-4o"

            return mock_resp

        # Call the decorated function
        result = mock_llm_call([{"role": "user", "content": "Hello"}])

        # Verify trace was sent
        assert len(sent_traces) == 1

        trace = sent_traces[0]
        assert "id" in trace
        assert "name" in trace
        assert trace["name"] == "test-llm-call"
        assert "spans" in trace
        assert len(trace["spans"]) == 1

    def test_trace_captures_user_input(self):
        """Test that user input is captured in the trace."""
        sent_traces = []

        class MockTransport(DebugTransport):
            def send_trace(self, trace_data):
                sent_traces.append(trace_data)

        auditi.init(api_key="test-api-key", transport=MockTransport())

        @auditi.trace_llm(standalone=True)
        def llm_call(messages):
            return "Response text"

        llm_call([{"role": "user", "content": "What is 2+2?"}])

        assert len(sent_traces) == 1
        trace = sent_traces[0]

        # User input should be extracted from messages
        assert "user_input" in trace
        assert "2+2" in trace["user_input"]

    def test_trace_captures_assistant_output(self):
        """Test that assistant output is captured in the trace."""
        sent_traces = []

        class MockTransport(DebugTransport):
            def send_trace(self, trace_data):
                sent_traces.append(trace_data)

        auditi.init(api_key="test-api-key", transport=MockTransport())

        @auditi.trace_llm(standalone=True)
        def llm_call(prompt):
            # Simulate OpenAI response structure
            mock_msg = MagicMock()
            mock_msg.content = "The answer is 4"

            mock_choice = MagicMock()
            mock_choice.message = mock_msg

            mock_resp = MagicMock()
            mock_resp.choices = [mock_choice]
            mock_resp.usage = None
            mock_resp.model = "gpt-4o"

            return mock_resp

        llm_call("What is 2+2?")

        assert len(sent_traces) == 1
        trace = sent_traces[0]

        assert "assistant_output" in trace
        assert "4" in trace["assistant_output"]

    def test_trace_captures_usage_metrics(self):
        """Test that token usage and cost are captured."""
        sent_traces = []

        class MockTransport(DebugTransport):
            def send_trace(self, trace_data):
                sent_traces.append(trace_data)

        auditi.init(api_key="test-api-key", transport=MockTransport())

        @auditi.trace_llm(standalone=True)
        def llm_call(prompt):
            mock_msg = MagicMock()
            mock_msg.content = "Response"

            mock_choice = MagicMock()
            mock_choice.message = mock_msg

            mock_usage = MagicMock()
            mock_usage.prompt_tokens = 100
            mock_usage.completion_tokens = 50
            mock_usage.total_tokens = 150

            mock_resp = MagicMock()
            mock_resp.choices = [mock_choice]
            mock_resp.usage = mock_usage
            mock_resp.model = "gpt-4o"

            return mock_resp

        llm_call("Test prompt")

        assert len(sent_traces) == 1
        trace = sent_traces[0]

        # Check that tokens were captured
        assert trace.get("total_tokens") == 150 or (
            trace.get("spans") and trace["spans"][0].get("tokens") == 150
        )


class TestInstrumentationEdgeCases:
    """Test edge cases and error handling."""

    def setup_method(self):
        import auditi.client as client_module
        client_module._client_instance = None

    def test_instrument_without_init(self):
        """Test that instrument() works even without explicit init (uses defaults)."""
        # Should not raise - creates a default client
        try:
            auditi.instrument(openai=False, anthropic=False, google=False)
        except Exception as e:
            pytest.fail(f"Instrumentation without init raised: {e}")

    def test_selective_instrumentation(self):
        """Test that only specified providers are instrumented."""
        auditi.init(api_key="test-api-key", transport=DebugTransport())

        # Only instrument OpenAI, not others
        auditi.instrument(openai=True, anthropic=False, google=False)

        # Verify OpenAI is patched
        try:
            from openai.resources.chat.completions import Completions
            assert hasattr(Completions.create, "_is_auditi_patched")
        except ImportError:
            pass  # OK if OpenAI not installed

        # Verify Anthropic is NOT patched (if installed)
        try:
            from anthropic.resources.messages import Messages
            assert not getattr(Messages.create, "_is_auditi_patched", False)
        except ImportError:
            pass  # OK if Anthropic not installed

    def test_error_handling_in_traced_function(self):
        """Test that errors in traced functions are properly captured."""
        sent_traces = []

        class MockTransport(DebugTransport):
            def send_trace(self, trace_data):
                sent_traces.append(trace_data)

        auditi.init(api_key="test-api-key", transport=MockTransport())

        @auditi.trace_llm(standalone=True)
        def failing_llm_call(prompt):
            raise ValueError("API Error: Rate limited")

        with pytest.raises(ValueError, match="Rate limited"):
            failing_llm_call("Test")

        # Trace should still be sent with error info
        assert len(sent_traces) == 1
        trace = sent_traces[0]
        assert "error" in trace
        assert "Rate limited" in trace["error"]
