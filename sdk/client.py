from typing import Optional
from .transport import BaseTransport, SyncHttpTransport, DebugTransport

class UpgradeAIClient:
    def __init__(self, api_key: str = None, base_url: str = "http://localhost:8000", transport: BaseTransport = None):
        if transport:
            self.transport = transport
        else:
            # We use SyncHttpTransport by default, even without api_key for local dev
            self.transport = SyncHttpTransport(base_url, api_key)

_client_instance: Optional[UpgradeAIClient] = None

def init(api_key: str = None, base_url: str = "http://localhost:8000", transport: BaseTransport = None):
    global _client_instance
    _client_instance = UpgradeAIClient(api_key, base_url, transport)

def get_client() -> UpgradeAIClient:
    global _client_instance
    if _client_instance is None:
        # Default to debug mode if not initialized
        _client_instance = UpgradeAIClient()
    return _client_instance
