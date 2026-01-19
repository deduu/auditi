import abc
import httpx
from typing import Any, Dict
import logging

logger = logging.getLogger("upgradeai")

class BaseTransport(abc.ABC):
    @abc.abstractmethod
    def send_trace(self, trace_data: Dict[str, Any]):
        pass

class SyncHttpTransport(BaseTransport):
    def __init__(self, base_url: str, api_key: str = None):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}" if api_key else "",
        }

    def send_trace(self, trace_data: Dict[str, Any]):
        url = f"{self.base_url}/v1/ingest"
        try:
            with httpx.Client() as client:
                response = client.post(url, json=trace_data, headers=self.headers, timeout=5.0)
                response.raise_for_status()
        except Exception as e:
            logger.error(f"Failed to send trace to UpgradeAI: {e}")

class DebugTransport(BaseTransport):
    def send_trace(self, trace_data: Dict[str, Any]):
        print(f"[UpgradeAI] Trace captured: {trace_data['id']}")
