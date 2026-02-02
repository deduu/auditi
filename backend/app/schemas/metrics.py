from typing import Dict
from pydantic import Field
from .base import APIModel


class MetricTrend(APIModel):
    value: float
    direction: str  # up | down | stable


class MetricDetail(APIModel):
    value: float
    p50: float
    p90: float
    p95: float
    p99: float
    trend: MetricTrend | None = None


class MetricsResponse(APIModel):
    total_conversations: int = Field(..., alias="totalConversations")
    total_requests: int = Field(..., alias="totalRequests")
    pass_rate: float = Field(..., alias="passRate")
    avg_score: MetricDetail = Field(..., alias="avgScore")
    avg_latency: MetricDetail = Field(..., alias="avgLatencyMs")

    # We keep the top-level trends for backward compatibility or easy access if needed,
    # but the detailed trend info is now also inside MetricDetail
    trends: Dict[str, MetricTrend]
