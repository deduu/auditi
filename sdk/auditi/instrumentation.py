# Copyright (c) 2026 Auditibl Inc.
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
        _instrument_openai_responses()

    if anthropic:
        _instrument_anthropic()

    if google:
        _instrument_google()
        _instrument_google_genai()


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


def _instrument_openai_responses():
    """Patch OpenAI Responses API methods (client.responses.create)."""
    try:
        from openai.resources.responses import Responses, AsyncResponses
    except ImportError:
        logger.debug("OpenAI Responses API not available (older openai library), skipping")
        return

    logger.info("Instrumenting OpenAI Responses API...")

    if getattr(Responses.create, "_is_auditi_patched", False):
        return

    original_create = Responses.create
    original_async_create = AsyncResponses.create

    @trace_llm(name="OpenAI Response", standalone=True)
    def patched_create(self, *args, **kwargs):
        return original_create(self, *args, **kwargs)

    @trace_llm(name="OpenAI Response", standalone=True)
    async def patched_async_create(self, *args, **kwargs):
        return await original_async_create(self, *args, **kwargs)

    patched_create._is_auditi_patched = True
    patched_async_create._is_auditi_patched = True

    Responses.create = patched_create
    AsyncResponses.create = patched_async_create

    logger.info("OpenAI Responses API instrumentation applied successfully")


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


def _instrument_google_genai():
    """Patch new google-genai SDK methods (client.models.generate_content)."""
    try:
        from google.genai.models import Models, AsyncModels
    except ImportError:
        logger.debug("google-genai SDK not found, skipping instrumentation")
        return

    logger.info("Instrumenting Google GenAI (new SDK)...")

    if getattr(Models.generate_content, "_is_auditi_patched", False):
        return

    original_generate = Models.generate_content
    original_generate_async = AsyncModels.generate_content

    @trace_llm(name="Google Gemini", standalone=True)
    def patched_generate(self, *args, **kwargs):
        return original_generate(self, *args, **kwargs)

    @trace_llm(name="Google Gemini", standalone=True)
    async def patched_generate_async(self, *args, **kwargs):
        return await original_generate_async(self, *args, **kwargs)

    patched_generate._is_auditi_patched = True
    patched_generate_async._is_auditi_patched = True

    Models.generate_content = patched_generate
    AsyncModels.generate_content = patched_generate_async

    logger.info("Google GenAI (new SDK) instrumentation applied successfully")
