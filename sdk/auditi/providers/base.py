"""
Base provider interface for LLM usage extraction and cost calculation.
"""

from abc import ABC, abstractmethod
from typing import Optional, Any, Dict, Tuple

from ..pricing import get_pricing_manager


class BaseProvider(ABC):
    """
    Abstract base class for LLM provider-specific logic.

    Each provider implements:
    1. Usage extraction from API responses
    2. Model pricing lookup
    3. Cost calculation
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name (e.g., 'openai', 'anthropic', 'google')."""
        pass

    @property
    @abstractmethod
    def model_pricing(self) -> Dict[str, Tuple[float, float]]:
        """
        Model pricing dictionary.

        Returns:
            Dict mapping model names to (input_price, output_price) per 1M tokens in USD

        Example:
            {
                "gpt-4o": (2.50, 10.00),
                "claude-3-5-sonnet-20241022": (3.00, 15.00)
            }
        """
        pass

    @abstractmethod
    def extract_usage(self, usage: Any) -> Tuple[Optional[int], Optional[int], Optional[int]]:
        """
        Extract token counts from provider-specific usage object.

        Args:
            usage: Raw usage object/dict from API response

        Returns:
            Tuple of (input_tokens, output_tokens, total_tokens)
            Returns (None, None, None) if extraction fails
        """
        pass

    @abstractmethod
    def extract_model(self, response: Any) -> Optional[str]:
        """
        Extract model name from API response.

        Args:
            response: Raw API response object

        Returns:
            Model name string, or None if not found
        """
        pass

    def calculate_cost(
        self, model: Optional[str], input_tokens: Optional[int], output_tokens: Optional[int]
    ) -> float:
        """
        Calculate cost based on model-specific pricing.

        Pricing is resolved in priority order:
        1. User overrides (configured via configure_pricing)
        2. Remote pricing from Auditi API
        3. Hardcoded defaults

        Args:
            model: Model name
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens

        Returns:
            Total cost in USD
        """
        if input_tokens is None and output_tokens is None:
            return 0.0

        input_tokens = input_tokens or 0
        output_tokens = output_tokens or 0

        # Look up pricing with remote + override support
        pricing = self.get_pricing(model)

        input_price, output_price = pricing

        # Convert from price per 1M tokens to per token
        input_cost = (input_tokens / 1_000_000) * input_price
        output_cost = (output_tokens / 1_000_000) * output_price

        return input_cost + output_cost

    def get_pricing(self, model: Optional[str]) -> Tuple[float, float]:
        """
        Get pricing for a model with remote fetching and override support.

        Priority: user override > remote API > hardcoded default

        Args:
            model: Model name

        Returns:
            Tuple of (input_price, output_price) per 1M tokens in USD
        """
        if model is None:
            return self.get_default_pricing()

        # Check hardcoded pricing first (used as default fallback)
        default = self.model_pricing.get(model, self.get_default_pricing())

        # Use pricing manager for remote + override lookup
        pricing_manager = get_pricing_manager()
        return pricing_manager.get_pricing(self.name, model, default)

    @abstractmethod
    def get_default_pricing(self) -> Tuple[float, float]:
        """
        Get default fallback pricing for unknown models.

        Returns:
            Tuple of (input_price, output_price) per 1M tokens in USD
        """
        pass

    def matches_model(self, model: Optional[str]) -> bool:
        """
        Check if a model name belongs to this provider.

        Default implementation checks if model starts with common prefixes.
        Override for custom logic.

        Args:
            model: Model name string

        Returns:
            True if this provider handles the model
        """
        if not model:
            return False

        model_lower = model.lower()
        return any(model_lower.startswith(prefix) for prefix in self.get_model_prefixes())

    @abstractmethod
    def get_model_prefixes(self) -> list[str]:
        """
        Get list of model name prefixes for this provider.

        Returns:
            List of lowercase prefixes (e.g., ['gpt-', 'o1-'])
        """
        pass

    def matches_response(self, response: Any) -> bool:
        """
        Check if a response object comes from this provider.

        Default implementation tries to extract model and check prefixes.
        Override for custom detection logic (e.g., checking response structure).

        Args:
            response: Raw API response object

        Returns:
            True if this provider handles the response
        """
        model = self.extract_model(response)
        return self.matches_model(model)
