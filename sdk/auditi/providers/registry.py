"""
Provider registry for auto-detecting and managing LLM providers.
"""

from typing import Optional, Any, List
from .base import BaseProvider
from .openai import OpenAIProvider
from .anthropic import AnthropicProvider
from .google import GoogleProvider


class ProviderRegistry:
    """
    Central registry for LLM providers.

    Handles:
    - Provider registration
    - Auto-detection from model names
    - Auto-detection from response structures
    - Fallback to generic provider
    """

    def __init__(self):
        self._providers: List[BaseProvider] = []
        self._default_provider: Optional[BaseProvider] = None

        # Register built-in providers
        self.register(OpenAIProvider())
        self.register(AnthropicProvider())
        self.register(GoogleProvider())

        # Set OpenAI as default fallback (most common format)
        self._default_provider = self.get_provider("openai")

    def register(self, provider: BaseProvider) -> None:
        """Register a new provider."""
        self._providers.append(provider)

    def get_provider(self, name: str) -> Optional[BaseProvider]:
        """Get provider by name."""
        for provider in self._providers:
            if provider.name == name:
                return provider
        return None

    def detect_from_model(self, model: Optional[str]) -> Optional[BaseProvider]:
        """
        Detect provider from model name.

        Args:
            model: Model name string (e.g., "gpt-4", "claude-3-opus-20240229")

        Returns:
            Matching provider, or None if no match

        Example:
            >>> registry.detect_from_model("gpt-4o")
            OpenAIProvider()
            >>> registry.detect_from_model("claude-3-5-sonnet-20241022")
            AnthropicProvider()
        """
        if not model:
            return None

        for provider in self._providers:
            if provider.matches_model(model):
                return provider

        return None

    def detect_from_response(self, response: Any) -> Optional[BaseProvider]:
        """
        Detect provider from response structure.

        This is useful when the model name is not known but we have
        the API response object.

        Args:
            response: Raw API response object or dict

        Returns:
            Matching provider, or None if no match

        Example:
            >>> response = {"choices": [...], "usage": {"prompt_tokens": 10}}
            >>> registry.detect_from_response(response)
            OpenAIProvider()
        """
        if response is None:
            return None

        # Try to extract model first (fastest method)
        for provider in self._providers:
            model = provider.extract_model(response)
            if model and provider.matches_model(model):
                return provider

        # Fall back to structure detection
        for provider in self._providers:
            if provider.matches_response(response):
                return provider

        return None

    def get_provider_or_default(
        self, model: Optional[str] = None, response: Any = None
    ) -> BaseProvider:
        """
        Get provider with fallback to default.

        Tries in order:
        1. Detect from model name
        2. Detect from response structure
        3. Use default provider

        Args:
            model: Optional model name
            response: Optional API response

        Returns:
            Provider (never None, returns default if detection fails)
        """
        # Try model detection first
        if model:
            provider = self.detect_from_model(model)
            if provider:
                return provider

        # Try response detection
        if response:
            provider = self.detect_from_response(response)
            if provider:
                return provider

        # Fallback to default
        return self._default_provider or self._providers[0]


# Global singleton registry
_registry = ProviderRegistry()


def get_registry() -> ProviderRegistry:
    """Get the global provider registry."""
    return _registry


def detect_provider(model: Optional[str] = None, response: Any = None) -> BaseProvider:
    """
    Detect provider from model name or response.

    This is the main entry point for provider detection.

    Args:
        model: Optional model name
        response: Optional API response

    Returns:
        Detected provider (falls back to default if detection fails)

    Example:
        >>> provider = detect_provider(model="gpt-4o")
        >>> input_tokens, output_tokens, total = provider.extract_usage(usage)
        >>> cost = provider.calculate_cost(model, input_tokens, output_tokens)
    """
    return _registry.get_provider_or_default(model=model, response=response)
