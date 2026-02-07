"""
Tests for OpenAI Responses API instrumentation and response handling.

Verifies:
1. Provider detects Responses API responses
2. Usage extraction works with input_tokens/output_tokens format
3. output_text is properly extracted in traces
4. Instrumentation patches Responses.create
5. New model prefixes match correctly (o3, o4, gpt-5)
"""

import pytest
import sys
import importlib
from unittest.mock import MagicMock, patch
import auditi
from auditi.transport import DebugTransport
from auditi.providers import OpenAIProvider, detect_provider


# --- Mock classes for OpenAI Responses API ---


class MockResponsesUsage:
    """Mock usage object matching Responses API format."""

    def __init__(self, input_tokens=10, output_tokens=20, total_tokens=30):
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens
        self.total_tokens = total_tokens


class MockResponsesContentText:
    """Mock content text block."""

    def __init__(self, text):
        self.text = text
        self.type = "output_text"


class MockResponsesOutputMessage:
    """Mock output message item."""

    def __init__(self, text):
        self.content = [MockResponsesContentText(text)]
        self.type = "message"
        self.role = "assistant"


class MockResponsesAPIResponse:
    """Mock response matching OpenAI Responses API structure."""

    def __init__(self, text="Hello world", model="gpt-4.1"):
        self.output_text = text
        self.output = [MockResponsesOutputMessage(text)]
        self.model = model
        self.usage = MockResponsesUsage()
        self.object = "response"
        self.id = "resp_123"
        # Explicitly does NOT have .choices


# --- Provider tests ---


class TestOpenAIResponsesAPIProvider:
    """Test provider detection and usage extraction for Responses API."""

    def test_extract_usage_input_tokens_dict_format(self):
        provider = OpenAIProvider()
        usage = {"input_tokens": 100, "output_tokens": 50, "total_tokens": 150}
        i, o, t = provider.extract_usage(usage)
        assert i == 100
        assert o == 50
        assert t == 150

    def test_extract_usage_input_tokens_object_format(self):
        provider = OpenAIProvider()
        usage = MockResponsesUsage(input_tokens=200, output_tokens=100, total_tokens=300)
        i, o, t = provider.extract_usage(usage)
        assert i == 200
        assert o == 100
        assert t == 300

    def test_extract_usage_prefers_prompt_tokens_over_input_tokens(self):
        """Chat Completions format should take priority over Responses API format."""
        provider = OpenAIProvider()
        usage = {
            "prompt_tokens": 100,
            "completion_tokens": 50,
            "total_tokens": 150,
            "input_tokens": 999,  # Should be ignored
        }
        i, o, t = provider.extract_usage(usage)
        assert i == 100
        assert o == 50
        assert t == 150

    def test_matches_response_responses_api_object(self):
        provider = OpenAIProvider()
        response = MockResponsesAPIResponse()
        assert provider.matches_response(response)

    def test_matches_response_responses_api_dict(self):
        provider = OpenAIProvider()
        response = {
            "object": "response",
            "output_text": "Hello",
            "model": "gpt-4.1",
        }
        assert provider.matches_response(response)

    def test_detect_provider_from_responses_api_response(self):
        response = MockResponsesAPIResponse(model="gpt-4.1")
        provider = detect_provider(response=response)
        assert isinstance(provider, OpenAIProvider)

    def test_matches_model_new_prefixes(self):
        provider = OpenAIProvider()
        assert provider.matches_model("o3")
        assert provider.matches_model("o3-mini")
        assert provider.matches_model("o3-pro")
        assert provider.matches_model("o4-mini")
        assert provider.matches_model("gpt-5")
        assert provider.matches_model("gpt-5.1")
        assert provider.matches_model("gpt-5.2")
        assert provider.matches_model("gpt-4.1")
        assert provider.matches_model("gpt-4.1-mini")
        assert provider.matches_model("gpt-4.1-nano")


# --- Pricing tests ---


class TestNewModelPricing:
    """Test pricing for newly added models."""

    def test_cost_gpt5(self):
        provider = OpenAIProvider()
        cost = provider.calculate_cost("gpt-5", 1_000_000, 1_000_000)
        assert cost == 11.25  # 1.25 + 10.00

    def test_cost_gpt4_1(self):
        provider = OpenAIProvider()
        cost = provider.calculate_cost("gpt-4.1", 1_000_000, 1_000_000)
        assert cost == 10.00  # 2.00 + 8.00

    def test_cost_gpt4_1_mini(self):
        provider = OpenAIProvider()
        cost = provider.calculate_cost("gpt-4.1-mini", 1_000_000, 1_000_000)
        assert cost == 2.00  # 0.40 + 1.60

    def test_cost_gpt4_1_nano(self):
        provider = OpenAIProvider()
        cost = provider.calculate_cost("gpt-4.1-nano", 1_000_000, 1_000_000)
        assert cost == 0.50  # 0.10 + 0.40

    def test_cost_o3(self):
        provider = OpenAIProvider()
        cost = provider.calculate_cost("o3", 1_000_000, 1_000_000)
        assert cost == 10.00  # 2.00 + 8.00

    def test_cost_o4_mini(self):
        provider = OpenAIProvider()
        cost = provider.calculate_cost("o4-mini", 1_000_000, 1_000_000)
        assert cost == 5.50  # 1.10 + 4.40


# --- Trace capture tests ---


class TestResponsesAPITraceCapture:
    """Test that traces capture Responses API output correctly."""

    def setup_method(self):
        import auditi.client as client_module

        client_module._client_instance = None

    def test_trace_captures_output_text(self):
        sent_traces = []

        class MockTransport(DebugTransport):
            def send_trace(self, trace_data):
                sent_traces.append(trace_data)

        auditi.init(api_key="test-key", transport=MockTransport())

        @auditi.trace_llm(standalone=True)
        def call_responses_api(input):
            return MockResponsesAPIResponse(text="The answer is 42")

        call_responses_api("What is the meaning of life?")

        assert len(sent_traces) == 1
        trace = sent_traces[0]
        assert "42" in trace["assistant_output"]

    def test_trace_captures_usage_from_responses_api(self):
        sent_traces = []

        class MockTransport(DebugTransport):
            def send_trace(self, trace_data):
                sent_traces.append(trace_data)

        auditi.init(api_key="test-key", transport=MockTransport())

        @auditi.trace_llm(standalone=True)
        def call_responses_api(input):
            resp = MockResponsesAPIResponse()
            resp.usage = MockResponsesUsage(
                input_tokens=100, output_tokens=50, total_tokens=150
            )
            return resp

        call_responses_api("Test")

        assert len(sent_traces) == 1
        trace = sent_traces[0]
        assert trace.get("total_tokens") == 150 or (
            trace.get("spans") and trace["spans"][0].get("tokens") == 150
        )

    def test_trace_captures_model_from_responses_api(self):
        sent_traces = []

        class MockTransport(DebugTransport):
            def send_trace(self, trace_data):
                sent_traces.append(trace_data)

        auditi.init(api_key="test-key", transport=MockTransport())

        @auditi.trace_llm(standalone=True)
        def call_responses_api(input):
            return MockResponsesAPIResponse(model="gpt-4.1")

        call_responses_api("Test")

        assert len(sent_traces) == 1
        span = sent_traces[0]["spans"][0]
        assert span["model"] == "gpt-4.1"


# --- Instrumentation patching tests ---


class TestResponsesAPIInstrumentation:
    """Test that Responses API patching works."""

    def test_instrumentation_patches_responses_api(self):
        mock_create = MagicMock(return_value=MockResponsesAPIResponse())
        mock_async_create = MagicMock()
        mock_create._is_auditi_patched = False
        mock_async_create._is_auditi_patched = False

        class MockResponses:
            create = mock_create

        class MockAsyncResponses:
            create = mock_async_create

        mock_responses_module = MagicMock()
        mock_responses_module.Responses = MockResponses
        mock_responses_module.AsyncResponses = MockAsyncResponses

        # Chat completions mocks (already patched to avoid re-patching)
        mock_completions_module = MagicMock()
        mock_completions_module.Completions = MagicMock()
        mock_completions_module.Completions.create = MagicMock()
        mock_completions_module.Completions.create._is_auditi_patched = True
        mock_completions_module.AsyncCompletions = MagicMock()

        with patch.dict(
            sys.modules,
            {
                "openai": MagicMock(),
                "openai.resources": MagicMock(),
                "openai.resources.chat": MagicMock(),
                "openai.resources.chat.completions": mock_completions_module,
                "openai.resources.responses": mock_responses_module,
            },
        ):
            import auditi.instrumentation

            importlib.reload(auditi.instrumentation)

            auditi.instrumentation.instrument(openai=True, anthropic=False, google=False)

            assert getattr(MockResponses.create, "_is_auditi_patched", False) is True
            assert getattr(MockAsyncResponses.create, "_is_auditi_patched", False) is True

    def test_responses_api_instrumentation_calls_through(self):
        """Test that patched Responses.create calls the original and returns result."""
        original_response = MockResponsesAPIResponse(text="patched response")
        mock_create = MagicMock(return_value=original_response)
        mock_async_create = MagicMock()
        mock_create._is_auditi_patched = False
        mock_async_create._is_auditi_patched = False

        class MockResponses:
            create = mock_create

        class MockAsyncResponses:
            create = mock_async_create

        mock_responses_module = MagicMock()
        mock_responses_module.Responses = MockResponses
        mock_responses_module.AsyncResponses = MockAsyncResponses

        mock_completions_module = MagicMock()
        mock_completions_module.Completions = MagicMock()
        mock_completions_module.Completions.create = MagicMock()
        mock_completions_module.Completions.create._is_auditi_patched = True
        mock_completions_module.AsyncCompletions = MagicMock()

        with patch.dict(
            sys.modules,
            {
                "openai": MagicMock(),
                "openai.resources": MagicMock(),
                "openai.resources.chat": MagicMock(),
                "openai.resources.chat.completions": mock_completions_module,
                "openai.resources.responses": mock_responses_module,
            },
        ):
            import auditi.instrumentation

            importlib.reload(auditi.instrumentation)

            # Init with mock transport
            mock_client = MagicMock()
            with patch("auditi.decorators.get_client", return_value=mock_client):
                auditi.instrumentation.instrument(openai=True, anthropic=False, google=False)

                dummy_self = MagicMock()
                response = MockResponses.create(
                    dummy_self, model="gpt-4.1", input="Hello"
                )

                assert response.output_text == "patched response"
                mock_create.assert_called()
                mock_client.transport.send_trace.assert_called()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
