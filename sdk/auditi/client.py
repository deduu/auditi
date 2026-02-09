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
Auditi SDK Client

Manages SDK initialization and provides access to the transport layer.
"""
from typing import Optional
from .transport import BaseTransport, SyncHttpTransport
from .pricing import get_pricing_manager


class AuditiClient:
    """
    Main client for the Auditi SDK.
    Manages the transport layer for sending traces to the Auditi platform.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "http://localhost:8000",
        transport: Optional[BaseTransport] = None,
    ):
        """
        Initialize the Auditi client.

        Args:
            api_key: API key for authentication (optional for local development)
            base_url: Base URL of the Auditi API
            transport: Custom transport implementation (optional)
        """
        if transport:
            self.transport = transport
        else:
            self.transport = SyncHttpTransport(base_url, api_key)


# Global client instance
_client_instance: Optional[AuditiClient] = None


def init(
    api_key: Optional[str] = None,
    base_url: str = "http://localhost:8000",
    transport: Optional[BaseTransport] = None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> AuditiClient:
    """
    Initialize the Auditi SDK with the given configuration.

    Args:
        api_key: API key for authentication
        base_url: Base URL of the Auditi API (default: localhost:8000)
        transport: Custom transport implementation
        user_id: Optional user identifier to set in global context
        session_id: Optional session/conversation identifier to set in global context

    Returns:
        The initialized AuditiClient instance

    Example:
        >>> import auditi
        >>> auditi.init(api_key="your-key", base_url="http://localhost:8000")
        >>> # With user context (applied to all traces including auto-instrumented)
        >>> auditi.init(api_key="your-key", user_id="user123", session_id="conv456")
    """
    global _client_instance
    _client_instance = AuditiClient(api_key, base_url, transport)

    # Configure pricing manager with the same base URL for remote pricing
    get_pricing_manager().set_base_url(base_url)

    # Set global context if user_id or session_id provided
    if user_id or session_id:
        from .context import set_context

        set_context(user_id=user_id, session_id=session_id)

    return _client_instance


def get_client() -> AuditiClient:
    """
    Get the current Auditi client instance.
    If not initialized, creates a default client for local development.

    Returns:
        The current AuditiClient instance
    """
    global _client_instance
    if _client_instance is None:
        _client_instance = AuditiClient()
    return _client_instance
