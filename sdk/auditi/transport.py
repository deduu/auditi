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
Transport layer for sending traces to the Auditi platform.

Provides different transport implementations for various use cases:
- SyncHttpTransport: Synchronous HTTP transport (default)
- DebugTransport: Debug transport that prints to console
"""

import abc
import logging
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)


class BaseTransport(abc.ABC):
    """
    Abstract base class for transport implementations.
    Subclass this to create custom transport mechanisms.
    """

    @abc.abstractmethod
    def send_trace(self, trace_data: dict[str, Any]) -> None:
        """
        Send trace data to the Auditi platform.

        Args:
            trace_data: Serialized trace data as a dictionary
        """
        pass


class SyncHttpTransport(BaseTransport):
    """
    Synchronous HTTP transport using httpx.
    Sends traces immediately via HTTP POST.
    """

    def __init__(self, base_url: str, api_key: Optional[str] = None):
        """
        Initialize the transport.

        Args:
            base_url: Base URL of the Auditi API
            api_key: API key for authentication (optional)
        """
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.headers = {
            "Content-Type": "application/json",
        }
        if api_key:
            self.headers["Authorization"] = f"Bearer {api_key}"

    def send_trace(self, trace_data: dict[str, Any]) -> None:
        """Send trace data via HTTP POST."""
        url = f"{self.base_url}/api/v1/ingest"
        try:
            with httpx.Client() as client:
                response = client.post(url, json=trace_data, headers=self.headers, timeout=5.0)
                response.raise_for_status()
                logger.debug(f"Trace sent successfully: {trace_data.get('id')}")
        except Exception as e:
            logger.error(f"Failed to send trace to Auditi: {e}")


class DebugTransport(BaseTransport):
    """
    Debug transport that prints trace data to console.
    Useful for local development and testing.
    """

    def send_trace(self, trace_data: dict[str, Any]) -> None:
        """Print trace data to console."""
        trace_id = trace_data.get("id", "unknown")
        spans_count = len(trace_data.get("spans", []))
        logger.debug("Trace captured: %s (%d spans)", trace_id, spans_count)
