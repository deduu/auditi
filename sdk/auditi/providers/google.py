# Copyright (c) 2026 Auditi Contributors
#
# MIT License
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

"""
Google Gemini provider implementation for usage extraction and cost calculation.
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


class GoogleProvider(BaseProvider):
    """Provider implementation for Google Gemini models."""

    @property
    def name(self) -> str:
        return "google"

    @property
    def model_pricing(self) -> Dict[str, Tuple[float, float]]:
        """
        Google Gemini model pricing per 1M tokens (input, output) in USD.
        Updated as of February 2026.

        Note: Pricing may vary by context window size and features.
        """
        return {
            # Gemini 3.x family
            "gemini-3-pro": (2.00, 12.00),
            "gemini-3-flash": (0.50, 3.00),
            # Gemini 2.5 family
            "gemini-2.5-pro": (1.25, 10.00),
            "gemini-2.5-flash": (0.30, 2.50),
            "gemini-2.5-flash-lite": (0.10, 0.40),
            # Gemini 2.0 family
            "gemini-2.0-flash": (0.10, 0.40),
            "gemini-2.0-flash-lite": (0.075, 0.30),
            "gemini-2.0-flash-exp": (0.00, 0.00),  # Free during preview
            "gemini-2.0-flash-thinking-exp": (0.00, 0.00),  # Free during preview
            # Gemini 1.5 family
            "gemini-1.5-pro": (1.25, 5.00),
            "gemini-1.5-pro-001": (1.25, 5.00),
            "gemini-1.5-pro-002": (1.25, 5.00),
            "gemini-1.5-pro-latest": (1.25, 5.00),
            "gemini-1.5-flash": (0.075, 0.30),
            "gemini-1.5-flash-001": (0.075, 0.30),
            "gemini-1.5-flash-002": (0.075, 0.30),
            "gemini-1.5-flash-latest": (0.075, 0.30),
            "gemini-1.5-flash-8b": (0.0375, 0.15),
            # Gemini 1.0 family (legacy)
            "gemini-1.0-pro": (0.50, 1.50),
            "gemini-1.0-pro-001": (0.50, 1.50),
            "gemini-1.0-pro-latest": (0.50, 1.50),
            "gemini-pro": (0.50, 1.50),
            # Model variants with features
            "gemini-1.5-pro-exp-0827": (1.25, 5.00),
            "gemini-exp-1206": (0.00, 0.00),  # Experimental, free
        }

    def get_default_pricing(self) -> Tuple[float, float]:
        """Conservative default for unknown Google models."""
        return (1.25, 5.00)  # Similar to Gemini 1.5 Pro

    def get_model_prefixes(self) -> list[str]:
        return ["gemini-", "gemini"]

    def extract_usage(self, usage: Any) -> Tuple[Optional[int], Optional[int], Optional[int]]:
        """
        Extract usage from Google Gemini response.

        Google structure (note the different field names):
        {
            "usageMetadata": {
                "promptTokenCount": 100,
                "candidatesTokenCount": 50,
                "totalTokenCount": 150
            }
        }

        OR older structure:
        {
            "usage_metadata": {
                "prompt_token_count": 100,
                "candidates_token_count": 50,
                "total_token_count": 150
            }
        }
        """
        if usage is None:
            return None, None, None

        input_tokens = None
        output_tokens = None
        total_tokens = None

        if isinstance(usage, dict):
            # Try camelCase (older google.generativeai API)
            input_tokens = _coerce_int(usage.get("promptTokenCount"))
            output_tokens = _coerce_int(usage.get("candidatesTokenCount"))
            total_tokens = _coerce_int(usage.get("totalTokenCount"))

            # Fallback to snake_case (older API variant)
            if input_tokens is None:
                input_tokens = _coerce_int(usage.get("prompt_token_count"))
            if output_tokens is None:
                output_tokens = _coerce_int(usage.get("candidates_token_count"))
            if total_tokens is None:
                total_tokens = _coerce_int(usage.get("total_token_count"))

            # Fallback to generic format (new google-genai SDK)
            if input_tokens is None:
                input_tokens = _coerce_int(usage.get("input_tokens"))
            if output_tokens is None:
                output_tokens = _coerce_int(usage.get("output_tokens"))
            if total_tokens is None:
                total_tokens = _coerce_int(usage.get("total_tokens"))
        else:
            # Handle object attributes (camelCase)
            input_tokens = _coerce_int(getattr(usage, "promptTokenCount", None))
            output_tokens = _coerce_int(getattr(usage, "candidatesTokenCount", None))
            total_tokens = _coerce_int(getattr(usage, "totalTokenCount", None))

            # Fallback to snake_case attributes
            if input_tokens is None:
                input_tokens = _coerce_int(getattr(usage, "prompt_token_count", None))
            if output_tokens is None:
                output_tokens = _coerce_int(getattr(usage, "candidates_token_count", None))
            if total_tokens is None:
                total_tokens = _coerce_int(getattr(usage, "total_token_count", None))

            # Fallback to generic format (new google-genai SDK)
            if input_tokens is None:
                input_tokens = _coerce_int(getattr(usage, "input_tokens", None))
            if output_tokens is None:
                output_tokens = _coerce_int(getattr(usage, "output_tokens", None))
            if total_tokens is None:
                total_tokens = _coerce_int(getattr(usage, "total_tokens", None))

        # Calculate total if not provided
        if total_tokens is None and (input_tokens is not None or output_tokens is not None):
            total_tokens = (input_tokens or 0) + (output_tokens or 0)

        return input_tokens, output_tokens, total_tokens

    def extract_model(self, response: Any) -> Optional[str]:
        """Extract model name from Google response."""
        if response is None:
            return None

        # Try dict access
        if isinstance(response, dict):
            # Try common locations
            model = response.get("model") or response.get("modelVersion")
            if model:
                return model

        # Try object attribute
        if hasattr(response, "model"):
            return str(response.model)
        if hasattr(response, "model_version"):
            return str(response.model_version)

        return None

    def matches_response(self, response: Any) -> bool:
        """
        Detect Google Gemini responses by structure.

        Gemini responses typically have:
        - 'candidates' array (not 'choices')
        - 'usageMetadata' or 'usage_metadata' (not 'usage')
        - 'promptTokenCount' style fields
        """
        if response is None:
            return False

        # Check for Gemini-specific structure
        if isinstance(response, dict):
            has_candidates = "candidates" in response
            has_gemini_usage = "usageMetadata" in response or "usage_metadata" in response

            # Check for Gemini-specific token counting fields
            usage_metadata = response.get("usageMetadata") or response.get("usage_metadata")
            if isinstance(usage_metadata, dict):
                has_prompt_token_count = (
                    "promptTokenCount" in usage_metadata or "prompt_token_count" in usage_metadata
                )
                if has_prompt_token_count:
                    return True

            if has_candidates or has_gemini_usage:
                return True
        elif hasattr(response, "candidates"):
            return True
        elif hasattr(response, "usage_metadata") or hasattr(response, "usageMetadata"):
            return True

        # Fallback to model prefix matching
        return super().matches_response(response)
