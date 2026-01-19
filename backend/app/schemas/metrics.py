"""Metrics-related Pydantic schemas."""
from pydantic import BaseModel
from typing import Dict


class MetricTrend(BaseModel):
    """Schema for metric trend data."""
    value: float
    direction: str  # up, down, stable


class MetricsResponse(BaseModel):
    """Schema for dashboard metrics response."""
    totalConversations: int
    passRate: float
    avgScore: float
    avgLatency: float
    trends: Dict[str, MetricTrend]
