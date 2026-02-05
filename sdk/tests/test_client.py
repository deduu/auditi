import pytest
from auditi.client import init, get_client, AuditiClient
from auditi.transport import SyncHttpTransport


def test_init_creates_client():
    """Test that init creates and returns a client."""
    # Reset singleton
    import auditi.client

    auditi.client._client_instance = None

    client = init(api_key="test-key", base_url="https://api.test.com")
    assert isinstance(client, AuditiClient)
    assert isinstance(client.transport, SyncHttpTransport)
    assert client.transport.api_key == "test-key"
    assert client.transport.base_url == "https://api.test.com"


def test_get_client_defaults():
    """Test that get_client creates a default client if none exists."""
    # Reset singleton
    import auditi.client

    auditi.client._client_instance = None

    client = get_client()
    assert isinstance(client, AuditiClient)
    assert client.transport.base_url == "http://localhost:8000"


def test_get_client_returns_singleton():
    """Test that get_client returns the same instance."""
    # Reset singleton
    import auditi.client

    auditi.client._client_instance = None

    client1 = init(api_key="key1")
    client2 = get_client()

    assert client1 is client2
    assert client2.transport.api_key == "key1"
