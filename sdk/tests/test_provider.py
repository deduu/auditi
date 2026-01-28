"""
Tests for provider abstraction layer.

Run with: pytest tests/test_providers.py -v
"""

import pytest
from auditi.providers import (
    detect_provider,
    get_registry,
    OpenAIProvider,
    AnthropicProvider,
    GoogleProvider,
)


class TestOpenAIProvider:
    """Tests for OpenAI provider."""

    def test_extract_usage_dict(self):
        """Test usage extraction from OpenAI dict response."""
        provider = OpenAIProvider()
        usage = {"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150}

        input_tokens, output_tokens, total_tokens = provider.extract_usage(usage)

        assert input_tokens == 100
        assert output_tokens == 50
        assert total_tokens == 150

    def test_extract_usage_object(self):
        """Test usage extraction from OpenAI object response."""
        provider = OpenAIProvider()

        class MockUsage:
            prompt_tokens = 200
            completion_tokens = 100
            total_tokens = 300

        input_tokens, output_tokens, total_tokens = provider.extract_usage(MockUsage())

        assert input_tokens == 200
        assert output_tokens == 100
        assert total_tokens == 300

    def test_calculate_cost_gpt4o(self):
        """Test cost calculation for GPT-4o."""
        provider = OpenAIProvider()

        # GPT-4o: $2.50 per 1M input, $10.00 per 1M output
        cost = provider.calculate_cost("gpt-4o", 1_000_000, 1_000_000)

        assert cost == 12.50  # 2.50 + 10.00

    def test_calculate_cost_gpt4o_mini(self):
        """Test cost calculation for GPT-4o-mini."""
        provider = OpenAIProvider()

        # GPT-4o-mini: $0.15 per 1M input, $0.60 per 1M output
        cost = provider.calculate_cost("gpt-4o-mini", 1_000_000, 1_000_000)

        assert cost == 0.75  # 0.15 + 0.60

    def test_matches_model(self):
        """Test model name matching."""
        provider = OpenAIProvider()

        assert provider.matches_model("gpt-4o")
        assert provider.matches_model("gpt-3.5-turbo")
        assert provider.matches_model("o1-preview")
        assert not provider.matches_model("claude-3-opus")
        assert not provider.matches_model("gemini-pro")

    def test_matches_response_structure(self):
        """Test response structure detection."""
        provider = OpenAIProvider()

        response = {
            "choices": [{"message": {"content": "Hello"}}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 5},
        }

        assert provider.matches_response(response)


class TestAnthropicProvider:
    """Tests for Anthropic provider."""

    def test_extract_usage_dict(self):
        """Test usage extraction from Anthropic dict response."""
        provider = AnthropicProvider()
        usage = {
            "input_tokens": 100,
            "output_tokens": 50,
            # Note: Anthropic doesn't provide total_tokens
        }

        input_tokens, output_tokens, total_tokens = provider.extract_usage(usage)

        assert input_tokens == 100
        assert output_tokens == 50
        assert total_tokens == 150  # Should be calculated

    def test_extract_usage_object(self):
        """Test usage extraction from Anthropic object response."""
        provider = AnthropicProvider()

        class MockUsage:
            input_tokens = 200
            output_tokens = 100

        input_tokens, output_tokens, total_tokens = provider.extract_usage(MockUsage())

        assert input_tokens == 200
        assert output_tokens == 100
        assert total_tokens == 300  # Should be calculated

    def test_calculate_cost_claude_sonnet(self):
        """Test cost calculation for Claude Sonnet."""
        provider = AnthropicProvider()

        # Claude 3.5 Sonnet: $3.00 per 1M input, $15.00 per 1M output
        cost = provider.calculate_cost("claude-3-5-sonnet-20241022", 1_000_000, 1_000_000)

        assert cost == 18.00  # 3.00 + 15.00

    def test_calculate_cost_claude_opus(self):
        """Test cost calculation for Claude Opus."""
        provider = AnthropicProvider()

        # Claude 3 Opus: $15.00 per 1M input, $75.00 per 1M output
        cost = provider.calculate_cost("claude-3-opus-20240229", 1_000_000, 1_000_000)

        assert cost == 90.00  # 15.00 + 75.00

    def test_calculate_cost_claude_4_5_sonnet(self):
        """Test cost calculation for Claude 4.5 Sonnet."""
        provider = AnthropicProvider()

        # Claude 4.5 Sonnet: $3.00 per 1M input, $15.00 per 1M output
        cost = provider.calculate_cost("claude-sonnet-4-5-20250929", 1_000_000, 1_000_000)

        assert cost == 18.00  # 3.00 + 15.00

    def test_matches_model(self):
        """Test model name matching."""
        provider = AnthropicProvider()

        assert provider.matches_model("claude-3-5-sonnet-20241022")
        assert provider.matches_model("claude-3-opus-20240229")
        assert provider.matches_model("claude-sonnet-4-5-20250929")
        assert not provider.matches_model("gpt-4o")
        assert not provider.matches_model("gemini-pro")

    def test_matches_response_structure(self):
        """Test response structure detection."""
        provider = AnthropicProvider()

        response = {
            "content": [{"type": "text", "text": "Hello"}],
            "usage": {"input_tokens": 10, "output_tokens": 5},
            "stop_reason": "end_turn",
        }

        assert provider.matches_response(response)


class TestGoogleProvider:
    """Tests for Google Gemini provider."""

    def test_extract_usage_dict_camelcase(self):
        """Test usage extraction from Gemini dict response (camelCase)."""
        provider = GoogleProvider()
        usage = {"promptTokenCount": 100, "candidatesTokenCount": 50, "totalTokenCount": 150}

        input_tokens, output_tokens, total_tokens = provider.extract_usage(usage)

        assert input_tokens == 100
        assert output_tokens == 50
        assert total_tokens == 150

    def test_extract_usage_dict_snakecase(self):
        """Test usage extraction from Gemini dict response (snake_case)."""
        provider = GoogleProvider()
        usage = {"prompt_token_count": 100, "candidates_token_count": 50, "total_token_count": 150}

        input_tokens, output_tokens, total_tokens = provider.extract_usage(usage)

        assert input_tokens == 100
        assert output_tokens == 50
        assert total_tokens == 150

    def test_calculate_cost_gemini_pro(self):
        """Test cost calculation for Gemini 1.5 Pro."""
        provider = GoogleProvider()

        # Gemini 1.5 Pro: $1.25 per 1M input, $5.00 per 1M output
        cost = provider.calculate_cost("gemini-1.5-pro", 1_000_000, 1_000_000)

        assert cost == 6.25  # 1.25 + 5.00

    def test_calculate_cost_gemini_flash(self):
        """Test cost calculation for Gemini 1.5 Flash."""
        provider = GoogleProvider()

        # Gemini 1.5 Flash: $0.075 per 1M input, $0.30 per 1M output
        cost = provider.calculate_cost("gemini-1.5-flash", 1_000_000, 1_000_000)

        assert cost == 0.375  # 0.075 + 0.30

    def test_matches_model(self):
        """Test model name matching."""
        provider = GoogleProvider()

        assert provider.matches_model("gemini-1.5-pro")
        assert provider.matches_model("gemini-1.5-flash")
        assert provider.matches_model("gemini-2.0-flash")
        assert not provider.matches_model("gpt-4o")
        assert not provider.matches_model("claude-3-opus")

    def test_matches_response_structure(self):
        """Test response structure detection."""
        provider = GoogleProvider()

        response = {
            "candidates": [{"content": {"parts": [{"text": "Hello"}]}}],
            "usageMetadata": {
                "promptTokenCount": 10,
                "candidatesTokenCount": 5,
                "totalTokenCount": 15,
            },
        }

        assert provider.matches_response(response)


class TestProviderRegistry:
    """Tests for provider registry and auto-detection."""

    def test_detect_from_model_openai(self):
        """Test provider detection from OpenAI model name."""
        provider = detect_provider(model="gpt-4o")

        assert isinstance(provider, OpenAIProvider)

    def test_detect_from_model_anthropic(self):
        """Test provider detection from Anthropic model name."""
        provider = detect_provider(model="claude-3-5-sonnet-20241022")

        assert isinstance(provider, AnthropicProvider)

    def test_detect_from_model_google(self):
        """Test provider detection from Google model name."""
        provider = detect_provider(model="gemini-1.5-pro")

        assert isinstance(provider, GoogleProvider)

    def test_detect_from_response_openai(self):
        """Test provider detection from OpenAI response structure."""
        response = {
            "choices": [{"message": {"content": "Hello"}}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 5},
        }

        provider = detect_provider(response=response)

        assert isinstance(provider, OpenAIProvider)

    def test_detect_from_response_anthropic(self):
        """Test provider detection from Anthropic response structure."""
        response = {
            "content": [{"type": "text", "text": "Hello"}],
            "usage": {"input_tokens": 10, "output_tokens": 5},
        }

        provider = detect_provider(response=response)

        assert isinstance(provider, AnthropicProvider)

    def test_detect_from_response_google(self):
        """Test provider detection from Google response structure."""
        response = {
            "candidates": [{"content": {"parts": [{"text": "Hello"}]}}],
            "usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 5},
        }

        provider = detect_provider(response=response)

        assert isinstance(provider, GoogleProvider)

    def test_fallback_to_default(self):
        """Test fallback to default provider for unknown models."""
        provider = detect_provider(model="unknown-model-xyz")

        # Should fall back to OpenAI (default)
        assert isinstance(provider, OpenAIProvider)

    def test_get_registry(self):
        """Test getting the global registry."""
        registry = get_registry()

        assert registry is not None
        assert registry.get_provider("openai") is not None
        assert registry.get_provider("anthropic") is not None
        assert registry.get_provider("google") is not None


class TestRealWorldScenarios:
    """Tests simulating real-world API responses."""

    def test_openai_chat_completion(self):
        """Test with realistic OpenAI ChatCompletion response."""
        response = {
            "id": "chatcmpl-123",
            "object": "chat.completion",
            "created": 1677652288,
            "model": "gpt-4o-2024-08-06",
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": "Hello! How can I help you today?"},
                    "finish_reason": "stop",
                }
            ],
            "usage": {"prompt_tokens": 9, "completion_tokens": 12, "total_tokens": 21},
        }

        provider = detect_provider(response=response)
        assert isinstance(provider, OpenAIProvider)

        input_tokens, output_tokens, total_tokens = provider.extract_usage(response["usage"])
        assert input_tokens == 9
        assert output_tokens == 12
        assert total_tokens == 21

        model = provider.extract_model(response)
        assert model == "gpt-4o-2024-08-06"

        cost = provider.calculate_cost(model, input_tokens, output_tokens)
        # GPT-4o: $2.50 per 1M input, $10.00 per 1M output
        expected_cost = (9 / 1_000_000 * 2.50) + (12 / 1_000_000 * 10.00)
        assert abs(cost - expected_cost) < 0.0001

    def test_anthropic_message(self):
        """Test with realistic Anthropic Messages API response."""
        response = {
            "id": "msg_01XFDUDYJgAACzvnptvVoYEL",
            "type": "message",
            "role": "assistant",
            "content": [
                {
                    "type": "text",
                    "text": "Hello! I'm Claude, an AI assistant. How can I help you today?",
                }
            ],
            "model": "claude-3-5-sonnet-20241022",
            "stop_reason": "end_turn",
            "stop_sequence": None,
            "usage": {"input_tokens": 10, "output_tokens": 15},
        }

        provider = detect_provider(response=response)
        assert isinstance(provider, AnthropicProvider)

        input_tokens, output_tokens, total_tokens = provider.extract_usage(response["usage"])
        assert input_tokens == 10
        assert output_tokens == 15
        assert total_tokens == 25  # Calculated since Anthropic doesn't provide it

        model = provider.extract_model(response)
        assert model == "claude-3-5-sonnet-20241022"

        cost = provider.calculate_cost(model, input_tokens, output_tokens)
        # Claude 3.5 Sonnet: $3.00 per 1M input, $15.00 per 1M output
        expected_cost = (10 / 1_000_000 * 3.00) + (15 / 1_000_000 * 15.00)
        assert abs(cost - expected_cost) < 0.0001

    def test_gemini_generate_content(self):
        """Test with realistic Gemini generateContent response."""
        response = {
            "candidates": [
                {
                    "content": {
                        "parts": [{"text": "Hello! How can I assist you today?"}],
                        "role": "model",
                    },
                    "finishReason": "STOP",
                    "index": 0,
                }
            ],
            "usageMetadata": {
                "promptTokenCount": 8,
                "candidatesTokenCount": 10,
                "totalTokenCount": 18,
            },
        }

        provider = detect_provider(response=response)
        assert isinstance(provider, GoogleProvider)

        input_tokens, output_tokens, total_tokens = provider.extract_usage(
            response["usageMetadata"]
        )
        assert input_tokens == 8
        assert output_tokens == 10
        assert total_tokens == 18

        # For this test, let's assume model is provided separately
        model = "gemini-1.5-pro"
        cost = provider.calculate_cost(model, input_tokens, output_tokens)
        # Gemini 1.5 Pro: $1.25 per 1M input, $5.00 per 1M output
        expected_cost = (8 / 1_000_000 * 1.25) + (10 / 1_000_000 * 5.00)
        assert abs(cost - expected_cost) < 0.0001


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
