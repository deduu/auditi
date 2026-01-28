"""
Anthropic provider implementation for usage extraction and cost calculation.
"""

from typing import Optional, Any, Dict, Tuple
from .base import BaseProvider


def _coerce_int(value: Any) -> Optional[int]:
    """Helper to safely convert values to int."""
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


class AnthropicProvider(BaseProvider):
    """Provider implementation for Anthropic Claude models."""

    @property
    def name(self) -> str:
        return "anthropic"

    @property
    def model_pricing(self) -> Dict[str, Tuple[float, float]]:
        """
        Anthropic model pricing per 1M tokens (input, output) in USD.
        Updated as of January 2025.
        """
        return {
            # Claude 4.5 family (newest)
            "claude-opus-4-5-20251101": (15.00, 75.00),
            "claude-sonnet-4-5-20250929": (3.00, 15.00),
            "claude-haiku-4-5-20251001": (0.80, 4.00),
            # Claude 3.5 family
            "claude-3-5-sonnet-20241022": (3.00, 15.00),
            "claude-3-5-sonnet-20240620": (3.00, 15.00),
            "claude-3-5-sonnet-latest": (3.00, 15.00),
            "claude-3-5-haiku-20241022": (0.80, 4.00),
            "claude-3-5-haiku-latest": (0.80, 4.00),
            # Claude 3 family
            "claude-3-opus-20240229": (15.00, 75.00),
            "claude-3-opus-latest": (15.00, 75.00),
            "claude-3-sonnet-20240229": (3.00, 15.00),
            "claude-3-haiku-20240307": (0.25, 1.25),
            # Legacy models
            "claude-2.1": (8.00, 24.00),
            "claude-2.0": (8.00, 24.00),
            "claude-instant-1.2": (0.80, 2.40),
        }

    def get_default_pricing(self) -> Tuple[float, float]:
        """Conservative default for unknown Anthropic models."""
        return (3.00, 15.00)  # Similar to Sonnet pricing

    def get_model_prefixes(self) -> list[str]:
        return ["claude-"]

    def extract_usage(self, usage: Any) -> Tuple[Optional[int], Optional[int], Optional[int]]:
        """
        Extract usage from Anthropic response.

        Anthropic structure:
        {
            "usage": {
                "input_tokens": 100,
                "output_tokens": 50
            }
        }

        Note: Anthropic does NOT return total_tokens, only input and output.
        """
        if usage is None:
            return None, None, None

        input_tokens = None
        output_tokens = None
        total_tokens = None

        if isinstance(usage, dict):
            input_tokens = _coerce_int(usage.get("input_tokens"))
            output_tokens = _coerce_int(usage.get("output_tokens"))
            # Anthropic doesn't provide total_tokens, we calculate it
        else:
            # Handle object attributes
            input_tokens = _coerce_int(getattr(usage, "input_tokens", None))
            output_tokens = _coerce_int(getattr(usage, "output_tokens", None))

        # Always calculate total for Anthropic
        if input_tokens is not None or output_tokens is not None:
            total_tokens = (input_tokens or 0) + (output_tokens or 0)

        return input_tokens, output_tokens, total_tokens

    def extract_model(self, response: Any) -> Optional[str]:
        """Extract model name from Anthropic response."""
        if response is None:
            return None

        # Try dict access
        if isinstance(response, dict):
            return response.get("model")

        # Try object attribute
        if hasattr(response, "model"):
            return str(response.model)

        return None

    def matches_response(self, response: Any) -> bool:
        """
        Detect Anthropic responses by structure.

        Anthropic responses typically have:
        - 'content' array with text blocks
        - 'usage' with 'input_tokens' and 'output_tokens' (NOT prompt_tokens)
        - 'stop_reason' field
        """
        if response is None:
            return False

        # Check for Anthropic-specific structure
        if isinstance(response, dict):
            has_anthropic_usage = (
                "usage" in response
                and isinstance(response.get("usage"), dict)
                and "input_tokens" in response.get("usage", {})
            )
            has_stop_reason = "stop_reason" in response

            if has_anthropic_usage or has_stop_reason:
                return True
        elif hasattr(response, "usage"):
            usage = response.usage
            if hasattr(usage, "input_tokens"):  # Anthropic-specific field
                return True

        # Fallback to model prefix matching
        return super().matches_response(response)
