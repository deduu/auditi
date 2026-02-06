import importlib
import functools
from typing import Any, Callable, Optional
import logging

from .decorators import trace_llm
from .client import get_client

logger = logging.getLogger("auditi.instrumentation")


def instrument(
    openai: bool = True,
    anthropic: bool = True,
    google: bool = True,
    langchain: bool = False,  # Placeholder for future
):
    """
    Automatically instrument installed libraries to capture traces.

    Args:
        openai: Whether to instrument the OpenAI library
        anthropic: Whether to instrument the Anthropic library
        google: Whether to instrument the Google Generative AI library
        langchain: Whether to instrument LangChain (not yet implemented)
    """
    if openai:
        _instrument_openai()

    if anthropic:
        _instrument_anthropic()

    if google:
        _instrument_google()


def _instrument_openai():
    """Patch OpenAI client methods"""
    try:
        import openai
        from openai import OpenAI, AsyncOpenAI
        from openai.resources.chat.completions import Completions, AsyncCompletions
    except ImportError:
        logger.debug("OpenAI library not found, skipping instrumentation")
        return

    logger.info("Instrumenting OpenAI...")

    # We patch the 'create' method of the Completions resource
    # checks if already patched to avoid double patching
    if getattr(Completions.create, "_is_auditi_patched", False):
        return

    original_create = Completions.create
    original_async_create = AsyncCompletions.create

    @trace_llm(name="OpenAI Chat Completion", standalone=True)
    def patched_create(self, *args, **kwargs):
        # We need to make sure we don't double-trace if the user is already using decorators
        # But for now, simple wrapping using our existing @trace_llm is easiest.
        # It handles standalone vs nested automatically.
        return original_create(self, *args, **kwargs)

    @trace_llm(name="OpenAI Chat Completion", standalone=True)
    async def patched_async_create(self, *args, **kwargs):
        return await original_async_create(self, *args, **kwargs)

    # Mark as patched
    patched_create._is_auditi_patched = True
    patched_async_create._is_auditi_patched = True

    # Apply patches
    Completions.create = patched_create
    AsyncCompletions.create = patched_async_create

    logger.info("OpenAI instrumentation applied successfully")


def _instrument_anthropic():
    """Patch Anthropic client methods"""
    try:
        import anthropic
        from anthropic.resources.messages import Messages, AsyncMessages
    except ImportError:
        logger.debug("Anthropic library not found, skipping instrumentation")
        return

    logger.info("Instrumenting Anthropic...")

    if getattr(Messages.create, "_is_auditi_patched", False):
        return

    original_create = Messages.create
    original_async_create = AsyncMessages.create

    @trace_llm(name="Anthropic Message", standalone=True)
    def patched_create(self, *args, **kwargs):
        return original_create(self, *args, **kwargs)

    @trace_llm(name="Anthropic Message", standalone=True)
    async def patched_async_create(self, *args, **kwargs):
        return await original_async_create(self, *args, **kwargs)

    patched_create._is_auditi_patched = True
    patched_async_create._is_auditi_patched = True

    Messages.create = patched_create
    AsyncMessages.create = patched_async_create

    logger.info("Anthropic instrumentation applied successfully")


def _instrument_google():
    """Patch Google Generative AI (Gemini) client methods"""
    try:
        import google.generativeai as genai
        from google.generativeai import GenerativeModel
    except ImportError:
        logger.debug("Google Generative AI library not found, skipping instrumentation")
        return

    logger.info("Instrumenting Google Generative AI (Gemini)...")

    # Check if already patched
    if getattr(GenerativeModel.generate_content, "_is_auditi_patched", False):
        return

    original_generate_content = GenerativeModel.generate_content
    original_generate_content_async = GenerativeModel.generate_content_async

    @trace_llm(name="Google Gemini", standalone=True)
    def patched_generate_content(self, *args, **kwargs):
        return original_generate_content(self, *args, **kwargs)

    @trace_llm(name="Google Gemini", standalone=True)
    async def patched_generate_content_async(self, *args, **kwargs):
        return await original_generate_content_async(self, *args, **kwargs)

    # Mark as patched
    patched_generate_content._is_auditi_patched = True
    patched_generate_content_async._is_auditi_patched = True

    # Apply patches
    GenerativeModel.generate_content = patched_generate_content
    GenerativeModel.generate_content_async = patched_generate_content_async

    logger.info("Google Generative AI instrumentation applied successfully")
