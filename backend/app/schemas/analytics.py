# Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
from typing import List, Optional, Dict
from pydantic import BaseModel
from datetime import datetime

# ============== Pydantic Models ==============


class ScoreDistributionBucket(BaseModel):
    range: str  # e.g., "0-25", "25-50"
    count: int
    percentage: float


class ScoreDistributionResponse(BaseModel):
    buckets: List[ScoreDistributionBucket]
    total: int


class LowScoringTrace(BaseModel):
    id: str
    name: Optional[str]
    score: float
    status: Optional[str]
    failure_mode: Optional[str]
    model_name: Optional[str]
    latency: Optional[float]
    start_time: datetime


class LowScoringTracesResponse(BaseModel):
    traces: List[LowScoringTrace]
    total: int


class TrendDataPoint(BaseModel):
    date: str  # ISO date string
    value: float


class TrendMetric(BaseModel):
    data: List[TrendDataPoint]
    current: float
    previous: float
    change_percent: float


class TrendsResponse(BaseModel):
    score: TrendMetric
    latency: TrendMetric
    cost: TrendMetric
    error_rate: TrendMetric
    volume: TrendMetric


class ModelComparisonItem(BaseModel):
    model: str
    score: float
    latency_p50: float
    latency_p90: float
    latency_p95: float
    latency_p99: float
    cost: float
    volume: int
    error_rate: float


class ModelComparisonResponse(BaseModel):
    models: List[ModelComparisonItem]


class ToolAnalyticsItem(BaseModel):
    name: str
    span_type: str
    total_calls: int
    success_count: int
    error_count: int
    success_rate: float
    avg_latency: float
    p50_latency: float
    p90_latency: float
    total_cost: float
    total_tokens: int


class ToolAnalyticsSummary(BaseModel):
    total_calls: int
    total_tools: int
    overall_success_rate: float
    avg_latency: float
    total_cost: float


class ToolAnalyticsResponse(BaseModel):
    summary: ToolAnalyticsSummary
    tools: List[ToolAnalyticsItem]


class CorrelationDataPoint(BaseModel):
    x: float
    y: float
    id: str
    label: Optional[str] = None


class CorrelationResult(BaseModel):
    x_metric: str
    y_metric: str
    correlation: float  # Pearson correlation coefficient
    interpretation: str  # "strong_positive", "moderate_positive", "weak", etc.
    data_points: List[CorrelationDataPoint]
    insight: str


class CorrelationsResponse(BaseModel):
    correlations: List[CorrelationResult]


class ForecastDataPoint(BaseModel):
    date: str
    actual: Optional[float] = None
    forecast: float
    lower_bound: float
    upper_bound: float


class CostForecastResponse(BaseModel):
    historical: List[TrendDataPoint]
    forecast: List[ForecastDataPoint]
    projected_total: float
    projected_change_percent: float
    avg_daily_cost: float


class InsightItem(BaseModel):
    type: str  # "success", "warning", "danger", "info"
    category: str  # "cost", "quality", "performance", "reliability"
    title: str
    description: str
    metric_value: Optional[str] = None
    recommendation: Optional[str] = None
    severity: Optional[str] = None  # "critical", "warning", "info"


class InsightsResponse(BaseModel):
    insights: List[InsightItem]
    summary: dict


class AnomalyDataPoint(BaseModel):
    date: str
    value: float
    z_score: float
    is_anomaly: bool
    anomaly_type: Optional[str] = None  # "spike", "drop", "high", "low"


class AnomalyMetric(BaseModel):
    metric: str
    data_points: List[AnomalyDataPoint]
    anomalies: List[AnomalyDataPoint]
    mean: float
    std_dev: float
    anomaly_count: int


class AnomaliesResponse(BaseModel):
    metrics: List[AnomalyMetric]
    total_anomalies: int
    summary: str


class LatencyPercentileDataPoint(BaseModel):
    date: str
    p50: float
    p90: float
    p95: float
    p99: float


class LatencyPercentilesTimeSeriesResponse(BaseModel):
    trace_latency: List[LatencyPercentileDataPoint]
    generation_latency: List[LatencyPercentileDataPoint]
    span_latency: List[LatencyPercentileDataPoint]


class UserConsumptionDataPoint(BaseModel):
    date: str
    value: float
    user_id: str


class UserConsumptionResponse(BaseModel):
    data: List[UserConsumptionDataPoint]
    users: List[str]
    metric: str
    total: float


class ScoreTrendDataPoint(BaseModel):
    date: str
    evaluator_name: str
    value: float


class ScoreTrendByEvaluatorResponse(BaseModel):
    data: List[ScoreTrendDataPoint]
    evaluators: List[str]
    total_avg: float
