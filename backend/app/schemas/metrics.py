from typing import Dict
from pydantic import Field
from .base import APIModel


class MetricTrend(APIModel):
    value: float
    direction: str  # up | down | stable


class MetricsResponse(APIModel):
    total_conversations: int = Field(..., alias="totalConversations")
    pass_rate: float = Field(..., alias="passRate")
    avg_score: float = Field(..., alias="avgScore")
    avg_latency_ms: float = Field(..., alias="avgLatencyMs")

    trends: Dict[str, MetricTrend]
