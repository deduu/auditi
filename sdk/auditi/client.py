"""
Auditi SDK Client

Manages SDK initialization and provides access to the transport layer.
"""
from typing import Optional
from .transport import BaseTransport, SyncHttpTransport


class AuditiClient:
    """
    Main client for the Auditi SDK.
    Manages the transport layer for sending traces to the Auditi platform.
    """
    
    def __init__(
        self, 
        api_key: Optional[str] = None, 
        base_url: str = "http://localhost:8000",
        transport: Optional[BaseTransport] = None
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
    transport: Optional[BaseTransport] = None
) -> AuditiClient:
    """
    Initialize the Auditi SDK with the given configuration.
    
    Args:
        api_key: API key for authentication
        base_url: Base URL of the Auditi API (default: localhost:8000)
        transport: Custom transport implementation
        
    Returns:
        The initialized AuditiClient instance
        
    Example:
        >>> import auditi
        >>> auditi.init(api_key="your-key", base_url="https://api.auditi.dev")
    """
    global _client_instance
    _client_instance = AuditiClient(api_key, base_url, transport)
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
