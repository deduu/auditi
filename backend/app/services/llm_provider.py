"""
LLM Provider abstraction layer for LLM-agnostic operations.

This module provides an abstract interface for LLM calls, allowing
easy swapping between providers (OpenAI, Anthropic, Google, etc.)
"""
import os
import logging
from abc import ABC, abstractmethod
from typing import Optional

logger = logging.getLogger("auditi.llm_provider")


class BaseLLMProvider(ABC):
    """
    Abstract base class for LLM providers.
    
    Implement this to add support for different LLM APIs.
    """
    
    @abstractmethod
    async def complete(
        self, 
        prompt: str, 
        system: Optional[str] = None,
        max_tokens: int = 256
    ) -> str:
        """
        Generate a completion from the LLM.
        
        Args:
            prompt: The user prompt/question
            system: Optional system message
            max_tokens: Maximum tokens in response
            
        Returns:
            The LLM's text response
        """
        pass
    
    @property
    @abstractmethod
    def model_name(self) -> str:
        """Return the model name being used."""
        pass


class OpenAIProvider(BaseLLMProvider):
    """OpenAI LLM provider implementation."""
    
    def __init__(
        self, 
        api_key: Optional[str] = None,
        model: str = "gpt-4o",
        base_url: Optional[str] = None
    ):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = model
        self.base_url = base_url
        self._client = None
    
    @property
    def model_name(self) -> str:
        return self.model
    
    def _get_client(self):
        """Lazy initialization of OpenAI client."""
        if self._client is None:
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(
                api_key=self.api_key,
                base_url=self.base_url
            )
        return self._client
    
    async def complete(
        self, 
        prompt: str, 
        system: Optional[str] = None,
        max_tokens: int = 256
    ) -> str:
        client = self._get_client()
        
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        
        try:
            response = await client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=0.3
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"OpenAI completion failed: {e}")
            raise


class AnthropicProvider(BaseLLMProvider):
    """Anthropic Claude LLM provider implementation."""
    
    def __init__(
        self, 
        api_key: Optional[str] = None,
        model: str = "claude-3-haiku-20240307"
    ):
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        self.model = model
        self._client = None
    
    @property
    def model_name(self) -> str:
        return self.model
    
    def _get_client(self):
        """Lazy initialization of Anthropic client."""
        if self._client is None:
            try:
                from anthropic import AsyncAnthropic
                self._client = AsyncAnthropic(api_key=self.api_key)
            except ImportError:
                raise ImportError("anthropic package not installed. Run: pip install anthropic")
        return self._client
    
    async def complete(
        self, 
        prompt: str, 
        system: Optional[str] = None,
        max_tokens: int = 256
    ) -> str:
        client = self._get_client()
        
        try:
            response = await client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                system=system or "You are a helpful assistant.",
                messages=[{"role": "user", "content": prompt}]
            )
            return response.content[0].text.strip()
        except Exception as e:
            logger.error(f"Anthropic completion failed: {e}")
            raise


# Provider registry
_PROVIDERS = {
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
}


def get_llm_provider(
    provider_name: str = "openai",
    api_key: Optional[str] = None,
    model: Optional[str] = None,
    **kwargs
) -> BaseLLMProvider:
    """
    Factory function to get an LLM provider instance.
    
    Args:
        provider_name: Name of provider ("openai", "anthropic")
        api_key: Optional API key (falls back to env vars)
        model: Optional model name override
        **kwargs: Additional provider-specific arguments
        
    Returns:
        Configured LLM provider instance
    """
    provider_name = provider_name.lower()
    
    if provider_name not in _PROVIDERS:
        raise ValueError(f"Unknown provider: {provider_name}. Available: {list(_PROVIDERS.keys())}")
    
    provider_class = _PROVIDERS[provider_name]
    
    init_kwargs = {"api_key": api_key}
    if model:
        init_kwargs["model"] = model
    init_kwargs.update(kwargs)
    
    return provider_class(**init_kwargs)


# Convenience function for objective extraction
OBJECTIVE_SYSTEM_PROMPT = """You are a helpful assistant that summarizes user intents.
Given a user's message, summarize their main objective or goal in 1-2 concise sentences.
Focus on WHAT the user wants to accomplish, not HOW they asked it.
Be direct and specific. Do not include phrases like "The user wants to" - just state the objective."""


async def extract_objective(
    user_input: str,
    provider: Optional[BaseLLMProvider] = None
) -> str:
    """
    Extract the user's objective from their first message.
    
    Args:
        user_input: The user's message
        provider: Optional LLM provider (defaults to OpenAI)
        
    Returns:
        A 1-2 sentence summary of the user's objective
    """
    if provider is None:
        provider = get_llm_provider("openai")
    
    prompt = f"Summarize this user's objective:\n\n{user_input}"
    
    try:
        objective = await provider.complete(
            prompt=prompt,
            system=OBJECTIVE_SYSTEM_PROMPT,
            max_tokens=100
        )
        return objective
    except Exception as e:
        logger.error(f"Failed to extract objective: {e}")
        return ""  # Return empty string on failure, don't block the pipeline
