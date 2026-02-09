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
