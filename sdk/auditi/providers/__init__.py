"""
Provider abstraction layer for LLM usage extraction and cost calculation.

This module provides a clean, extensible way to handle different LLM providers
(OpenAI, Anthropic, Google, etc.) with automatic detection and provider-specific
pricing and usage extraction.

Usage:
    >>> from auditi.providers import detect_provider
    >>>
    >>> # Auto-detect from model name
    >>> provider = detect_provider(model="gpt-4o")
    >>> input_tokens, output_tokens, total = provider.extract_usage(response.usage)
    >>> cost = provider.calculate_cost("gpt-4o", input_tokens, output_tokens)
    >>>
    >>> # Or detect from response structure
    >>> provider = detect_provider(response=api_response)
    >>> model = provider.extract_model(api_response)

Adding a new provider:
    1. Create a new file in auditi/providers/ (e.g., cohere.py)
    2. Subclass BaseProvider and implement all abstract methods
    3. Register it in registry.py's __init__ method
    4. That's it! It will automatically be used for detection
"""

from .base import BaseProvider
from .registry import get_registry, detect_provider, ProviderRegistry
from .openai import OpenAIProvider
from .anthropic import AnthropicProvider
from .google import GoogleProvider

__all__ = [
    "BaseProvider",
    "ProviderRegistry",
    "get_registry",
    "detect_provider",
    "OpenAIProvider",
    "AnthropicProvider",
    "GoogleProvider",
]
