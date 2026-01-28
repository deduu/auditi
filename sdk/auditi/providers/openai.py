"""
OpenAI provider implementation for usage extraction and cost calculation.
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


class OpenAIProvider(BaseProvider):
    """Provider implementation for OpenAI models."""

    @property
    def name(self) -> str:
        return "openai"

    @property
    def model_pricing(self) -> Dict[str, Tuple[float, float]]:
        """
        OpenAI model pricing per 1M tokens (input, output) in USD.
        Updated as of January 2025.
        """
        return {
            # GPT-4o family
            "gpt-4o": (2.50, 10.00),
            "gpt-4o-2024-11-20": (2.50, 10.00),
            "gpt-4o-2024-08-06": (2.50, 10.00),
            "gpt-4o-2024-05-13": (5.00, 15.00),
            "gpt-4o-mini": (0.15, 0.60),
            "gpt-4o-mini-2024-07-18": (0.15, 0.60),
            # GPT-4 Turbo
            "gpt-4-turbo": (10.00, 30.00),
            "gpt-4-turbo-2024-04-09": (10.00, 30.00),
            "gpt-4-turbo-preview": (10.00, 30.00),
            "gpt-4-0125-preview": (10.00, 30.00),
            "gpt-4-1106-preview": (10.00, 30.00),
            # GPT-4 base
            "gpt-4": (30.00, 60.00),
            "gpt-4-0613": (30.00, 60.00),
            "gpt-4-32k": (60.00, 120.00),
            "gpt-4-32k-0613": (60.00, 120.00),
            # GPT-3.5 Turbo
            "gpt-3.5-turbo": (0.50, 1.50),
            "gpt-3.5-turbo-0125": (0.50, 1.50),
            "gpt-3.5-turbo-1106": (1.00, 2.00),
            "gpt-3.5-turbo-16k": (3.00, 4.00),
            # o1 models
            "o1-preview": (15.00, 60.00),
            "o1-preview-2024-09-12": (15.00, 60.00),
            "o1-mini": (3.00, 12.00),
            "o1-mini-2024-09-12": (3.00, 12.00),
            "o1": (15.00, 60.00),
        }

    def get_default_pricing(self) -> Tuple[float, float]:
        """Conservative default for unknown OpenAI models."""
        return (10.00, 30.00)  # Similar to GPT-4 Turbo

    def get_model_prefixes(self) -> list[str]:
        return ["gpt-", "o1-", "o1"]

    def extract_usage(self, usage: Any) -> Tuple[Optional[int], Optional[int], Optional[int]]:
        """
        Extract usage from OpenAI response.

        OpenAI structure:
        {
            "usage": {
                "prompt_tokens": 100,
                "completion_tokens": 50,
                "total_tokens": 150
            }
        }
        """
        if usage is None:
            return None, None, None

        input_tokens = None
        output_tokens = None
        total_tokens = None

        if isinstance(usage, dict):
            input_tokens = _coerce_int(usage.get("prompt_tokens"))
            output_tokens = _coerce_int(usage.get("completion_tokens"))
            total_tokens = _coerce_int(usage.get("total_tokens"))
        else:
            # Handle object attributes
            input_tokens = _coerce_int(getattr(usage, "prompt_tokens", None))
            output_tokens = _coerce_int(getattr(usage, "completion_tokens", None))
            total_tokens = _coerce_int(getattr(usage, "total_tokens", None))

        # Calculate total if not provided
        if total_tokens is None and (input_tokens is not None or output_tokens is not None):
            total_tokens = (input_tokens or 0) + (output_tokens or 0)

        return input_tokens, output_tokens, total_tokens

    def extract_model(self, response: Any) -> Optional[str]:
        """Extract model name from OpenAI response."""
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
        Detect OpenAI responses by structure.

        OpenAI responses typically have:
        - 'choices' array with 'message' or 'text'
        - 'usage' with 'prompt_tokens' and 'completion_tokens'
        """
        if response is None:
            return False

        # Check for OpenAI-specific structure
        if isinstance(response, dict):
            has_choices = "choices" in response
            has_openai_usage = (
                "usage" in response
                and isinstance(response.get("usage"), dict)
                and "prompt_tokens" in response.get("usage", {})
            )
            if has_choices or has_openai_usage:
                return True
        elif hasattr(response, "choices") and hasattr(response, "usage"):
            return True

        # Fallback to model prefix matching
        return super().matches_response(response)
