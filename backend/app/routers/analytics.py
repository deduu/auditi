"""Analytics API routes for trends, distributions, and insights."""

from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, case, cast, String
from pydantic import BaseModel

from app.database import get_db
from app.models import Trace, Span

router = APIRouter(prefix="/analytics", tags=["analytics"])


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


# ============== Helper Functions ==============


def get_date_range(time_range: str):
    """Parse time range string and return start/end dates."""
    now = datetime.now(timezone.utc)
    if time_range == "24h":
        start = now - timedelta(hours=24)
        prev_start = now - timedelta(hours=48)
    elif time_range == "7d":
        start = now - timedelta(days=7)
        prev_start = now - timedelta(days=14)
    elif time_range == "30d":
        start = now - timedelta(days=30)
        prev_start = now - timedelta(days=60)
    elif time_range == "90d":
        start = now - timedelta(days=90)
        prev_start = now - timedelta(days=180)
    else:
        start = now - timedelta(days=7)
        prev_start = now - timedelta(days=14)

    return start, prev_start, now


def get_time_bucket(time_range: str) -> str:
    """Return SQL date truncation format based on time range."""
    if time_range == "24h":
        return "hour"
    elif time_range in ["7d", "30d"]:
        return "day"
    else:
        return "week"


# ============== Endpoints ==============


@router.get("/score-distribution", response_model=ScoreDistributionResponse)
def get_score_distribution(
    time_range: str = Query("7d", alias="timeRange"), db: Session = Depends(get_db)
):
    """Get distribution of scores in buckets (0-25, 25-50, 50-75, 75-100)."""
    start_date, _, _ = get_date_range(time_range)

    # Query traces with scores in the time range
    traces = (
        db.query(Trace.score)
        .filter(Trace.start_time >= start_date, Trace.score != None)
        .all()
    )

    # Calculate distribution
    buckets = {"0-25": 0, "25-50": 0, "50-75": 0, "75-100": 0}

    for (score,) in traces:
        if score is not None:
            # Convert 0-1 score to 0-100 percentage
            # score_pct = score * 100
            # BUT: We need to handle potentially already scaled scores or edge cases
            # Assuming DB always has 0.0-1.0
            score_pct = score * 100

            if score_pct < 25:
                buckets["0-25"] += 1
            elif score_pct < 50:
                buckets["25-50"] += 1
            elif score_pct < 75:
                buckets["50-75"] += 1
            else:
                buckets["75-100"] += 1

    total = len(traces)

    result = [
        ScoreDistributionBucket(
            range=range_key,
            count=count,
            percentage=round((count / total * 100) if total > 0 else 0, 1),
        )
        for range_key, count in buckets.items()
    ]

    return ScoreDistributionResponse(buckets=result, total=total)


@router.get("/low-scoring-traces", response_model=LowScoringTracesResponse)
def get_low_scoring_traces(
    time_range: str = Query("7d", alias="timeRange"),
    threshold: float = Query(50.0),  # Expected as 0-100
    limit: int = Query(10),
    db: Session = Depends(get_db),
):
    """Get traces with scores below a threshold."""
    start_date, _, _ = get_date_range(time_range)

    # Threshold comes in as percentage (e.g., 50), convert to 0-1 for DB query
    db_threshold = threshold / 100.0

    traces = (
        db.query(Trace)
        .filter(
            Trace.start_time >= start_date,
            Trace.score != None,
            Trace.score < db_threshold,
        )
        .order_by(Trace.score.asc())
        .limit(limit)
        .all()
    )

    # Get total count
    total = (
        db.query(func.count(Trace.id))
        .filter(
            Trace.start_time >= start_date,
            Trace.score != None,
            Trace.score < db_threshold,
        )
        .scalar()
    )

    result = [
        LowScoringTrace(
            id=t.id,
            name=t.name,
            score=(t.score * 100) if t.score is not None else 0,  # Convert to 0-100
            status=t.status,
            failure_mode=t.failure_mode,
            model_name=t.model_name,
            latency=t.latency,
            start_time=t.start_time,
        )
        for t in traces
    ]

    return LowScoringTracesResponse(traces=result, total=total or 0)


@router.get("/trends", response_model=TrendsResponse)
def get_trends(
    time_range: str = Query("7d", alias="timeRange"), db: Session = Depends(get_db)
):
    """Get time-series trend data for key metrics."""
    start_date, prev_start, now = get_date_range(time_range)

    # Determine grouping based on time range (PostgreSQL compatible)
    if time_range == "24h":
        # Group by hour for 24h - use to_char for formatting
        date_trunc_col = func.date_trunc("hour", Trace.start_time)
        date_format = func.to_char(date_trunc_col, "YYYY-MM-DD HH24:00")
    elif time_range in ["7d", "30d"]:
        # Group by day
        date_trunc_col = func.date_trunc("day", Trace.start_time)
        date_format = func.to_char(date_trunc_col, "YYYY-MM-DD")
    else:
        # Group by week for longer ranges
        date_trunc_col = func.date_trunc("week", Trace.start_time)
        date_format = func.to_char(date_trunc_col, "YYYY-\"W\"IW")

    # Query current period data grouped by time
    current_data = (
        db.query(
            date_format.label("period"),
            func.avg(Trace.score).label("avg_score"),
            func.avg(Trace.latency).label("avg_latency"),
            func.sum(Trace.cost).label("total_cost"),
            func.count(Trace.id).label("volume"),
            func.sum(case((Trace.status == "fail", 1), else_=0)).label("failures"),
        )
        .filter(Trace.start_time >= start_date)
        .group_by(date_trunc_col)
        .order_by(date_trunc_col)
        .all()
    )

    # Query previous period aggregates
    prev_agg = (
        db.query(
            func.avg(Trace.score).label("avg_score"),
            func.avg(Trace.latency).label("avg_latency"),
            func.sum(Trace.cost).label("total_cost"),
            func.count(Trace.id).label("volume"),
            func.sum(case((Trace.status == "fail", 1), else_=0)).label("failures"),
        )
        .filter(Trace.start_time >= prev_start, Trace.start_time < start_date)
        .first()
    )

    # Query current period aggregates
    curr_agg = (
        db.query(
            func.avg(Trace.score).label("avg_score"),
            func.avg(Trace.latency).label("avg_latency"),
            func.sum(Trace.cost).label("total_cost"),
            func.count(Trace.id).label("volume"),
            func.sum(case((Trace.status == "fail", 1), else_=0)).label("failures"),
        )
        .filter(Trace.start_time >= start_date)
        .first()
    )

    def calc_change(current, previous):
        if not previous or previous == 0:
            return 0.0
        return round(((current - previous) / previous) * 100, 1)

    def build_metric(data_key, current_val, prev_val):
        # Scale score data points if needed
        is_score = data_key == "avg_score"

        data_points = []
        for row in current_data:
            val = getattr(row, data_key) or 0
            if is_score:
                val = val * 100  # Scale score to 0-100
            data_points.append(TrendDataPoint(date=row.period, value=round(val, 2)))

        final_curr = current_val or 0
        final_prev = prev_val or 0

        if is_score:
            final_curr *= 100
            final_prev *= 100

        return TrendMetric(
            data=data_points,
            current=round(final_curr, 2),
            previous=round(final_prev, 2),
            change_percent=calc_change(final_curr, final_prev),
        )

    # Calculate error rates
    curr_error_rate = (
        (curr_agg.failures / curr_agg.volume * 100)
        if curr_agg and curr_agg.volume
        else 0
    )
    prev_error_rate = (
        (prev_agg.failures / prev_agg.volume * 100)
        if prev_agg and prev_agg.volume
        else 0
    )

    # Build error rate data points
    error_rate_data = [
        TrendDataPoint(
            date=row.period,
            value=round((row.failures / row.volume * 100) if row.volume else 0, 2),
        )
        for row in current_data
    ]

    return TrendsResponse(
        score=build_metric(
            "avg_score",
            curr_agg.avg_score if curr_agg else 0,
            prev_agg.avg_score if prev_agg else 0,
        ),
        latency=build_metric(
            "avg_latency",
            curr_agg.avg_latency if curr_agg else 0,
            prev_agg.avg_latency if prev_agg else 0,
        ),
        cost=build_metric(
            "total_cost",
            curr_agg.total_cost if curr_agg else 0,
            prev_agg.total_cost if prev_agg else 0,
        ),
        error_rate=TrendMetric(
            data=error_rate_data,
            current=round(curr_error_rate, 2),
            previous=round(prev_error_rate, 2),
            change_percent=calc_change(curr_error_rate, prev_error_rate),
        ),
        volume=build_metric(
            "volume",
            curr_agg.volume if curr_agg else 0,
            prev_agg.volume if prev_agg else 0,
        ),
    )


@router.get("/models", response_model=ModelComparisonResponse)
def get_model_comparison(
    time_range: str = Query("7d", alias="timeRange"), db: Session = Depends(get_db)
):
    """Get performance comparison across models."""
    start_date, _, _ = get_date_range(time_range)

    # Query model stats
    model_stats = (
        db.query(
            Trace.model_name,
            func.avg(Trace.score).label("avg_score"),
            func.avg(Trace.latency).label("avg_latency"),
            func.sum(Trace.cost).label("total_cost"),
            func.count(Trace.id).label("volume"),
            func.sum(case((Trace.status == "fail", 1), else_=0)).label("failures"),
        )
        .filter(Trace.start_time >= start_date, Trace.model_name != None)
        .group_by(Trace.model_name)
        .all()
    )

    # For P50/P90 latency, we need to fetch all latencies per model
    # This is a simplified approach - for large datasets, consider using window functions
    result = []
    for row in model_stats:
        # Fetch latencies for this model to calculate percentiles
        latencies = (
            db.query(Trace.latency)
            .filter(
                Trace.start_time >= start_date,
                Trace.model_name == row.model_name,
                Trace.latency != None,
            )
            .all()
        )

        latency_values = sorted([l[0] for l in latencies if l[0] is not None])

        p50 = latency_values[len(latency_values) // 2] if latency_values else 0
        p90_idx = int(len(latency_values) * 0.9)
        p90 = (
            latency_values[p90_idx]
            if latency_values and p90_idx < len(latency_values)
            else 0
        )

        error_rate = (row.failures / row.volume * 100) if row.volume else 0

        # Scale score to 0-100
        avg_score = (row.avg_score or 0) * 100

        result.append(
            ModelComparisonItem(
                model=row.model_name or "Unknown",
                score=round(avg_score, 1),
                latency_p50=round(p50, 3),
                latency_p90=round(p90, 3),
                cost=round(row.total_cost or 0, 4),
                volume=row.volume,
                error_rate=round(error_rate, 1),
            )
        )

    # Sort by volume descending
    result.sort(key=lambda x: x.volume, reverse=True)

    return ModelComparisonResponse(models=result)


@router.get("/tools", response_model=ToolAnalyticsResponse)
def get_tool_analytics(
    time_range: str = Query("7d", alias="timeRange"),
    span_type: Optional[str] = Query(None, alias="spanType"),
    db: Session = Depends(get_db),
):
    """Get analytics for tool calls (spans)."""
    start_date, _, _ = get_date_range(time_range)

    # Build base filter
    base_filter = [Span.start_time >= start_date]
    if span_type:
        base_filter.append(Span.span_type == span_type)

    # Query aggregated stats per tool (span name + type)
    tool_stats = (
        db.query(
            Span.name,
            Span.span_type,
            func.count(Span.id).label("total_calls"),
            func.sum(case((Span.status == "ok", 1), else_=0)).label("success_count"),
            func.sum(case((Span.status != "ok", 1), else_=0)).label("error_count"),
            func.avg(Span.processing_time).label("avg_latency"),
            func.sum(Span.cost).label("total_cost"),
            func.sum(Span.tokens).label("total_tokens"),
        )
        .filter(and_(*base_filter))
        .group_by(Span.name, Span.span_type)
        .all()
    )

    # Calculate percentiles per tool
    result = []
    total_calls = 0
    total_success = 0
    total_cost = 0.0
    all_latencies = []

    for row in tool_stats:
        # Fetch latencies for percentile calculation
        latencies = (
            db.query(Span.processing_time)
            .filter(
                Span.start_time >= start_date,
                Span.name == row.name,
                Span.span_type == row.span_type,
                Span.processing_time != None,
            )
            .all()
        )

        latency_values = sorted([l[0] for l in latencies if l[0] is not None])
        all_latencies.extend(latency_values)

        p50 = latency_values[len(latency_values) // 2] if latency_values else 0
        p90_idx = int(len(latency_values) * 0.9)
        p90 = (
            latency_values[p90_idx]
            if latency_values and p90_idx < len(latency_values)
            else 0
        )

        success_rate = (
            (row.success_count / row.total_calls * 100) if row.total_calls else 0
        )

        result.append(
            ToolAnalyticsItem(
                name=row.name or "Unknown",
                span_type=row.span_type or "unknown",
                total_calls=row.total_calls,
                success_count=row.success_count or 0,
                error_count=row.error_count or 0,
                success_rate=round(success_rate, 1),
                avg_latency=round(row.avg_latency or 0, 3),
                p50_latency=round(p50, 3),
                p90_latency=round(p90, 3),
                total_cost=round(row.total_cost or 0, 4),
                total_tokens=row.total_tokens or 0,
            )
        )

        total_calls += row.total_calls
        total_success += row.success_count or 0
        total_cost += row.total_cost or 0

    # Sort by total calls descending
    result.sort(key=lambda x: x.total_calls, reverse=True)

    # Calculate summary
    overall_success_rate = (total_success / total_calls * 100) if total_calls else 0
    avg_latency = sum(all_latencies) / len(all_latencies) if all_latencies else 0

    summary = ToolAnalyticsSummary(
        total_calls=total_calls,
        total_tools=len(result),
        overall_success_rate=round(overall_success_rate, 1),
        avg_latency=round(avg_latency, 3),
        total_cost=round(total_cost, 4),
    )

    return ToolAnalyticsResponse(summary=summary, tools=result)


def calculate_pearson_correlation(x_values: List[float], y_values: List[float]) -> float:
    """Calculate Pearson correlation coefficient."""
    n = len(x_values)
    if n < 2:
        return 0.0

    mean_x = sum(x_values) / n
    mean_y = sum(y_values) / n

    numerator = sum((x - mean_x) * (y - mean_y) for x, y in zip(x_values, y_values))
    denominator_x = sum((x - mean_x) ** 2 for x in x_values) ** 0.5
    denominator_y = sum((y - mean_y) ** 2 for y in y_values) ** 0.5

    if denominator_x == 0 or denominator_y == 0:
        return 0.0

    return numerator / (denominator_x * denominator_y)


def interpret_correlation(r: float) -> str:
    """Interpret correlation coefficient."""
    abs_r = abs(r)
    if abs_r >= 0.7:
        return "strong_positive" if r > 0 else "strong_negative"
    elif abs_r >= 0.4:
        return "moderate_positive" if r > 0 else "moderate_negative"
    elif abs_r >= 0.2:
        return "weak_positive" if r > 0 else "weak_negative"
    else:
        return "none"


@router.get("/correlations", response_model=CorrelationsResponse)
def get_correlations(
    time_range: str = Query("7d", alias="timeRange"),
    db: Session = Depends(get_db),
):
    """Get correlation analysis between different metrics."""
    start_date, _, _ = get_date_range(time_range)

    # Fetch raw trace data for correlation analysis
    traces = (
        db.query(
            Trace.id,
            Trace.name,
            Trace.score,
            Trace.latency,
            Trace.cost,
            Trace.total_tokens,
        )
        .filter(
            Trace.start_time >= start_date,
            Trace.score != None,
            Trace.latency != None,
        )
        .limit(500)  # Limit for performance
        .all()
    )

    if len(traces) < 5:
        return CorrelationsResponse(correlations=[])

    # Extract values
    scores = [(t.score or 0) * 100 for t in traces]
    latencies = [t.latency or 0 for t in traces]
    costs = [t.cost or 0 for t in traces]
    tokens = [t.total_tokens or 0 for t in traces]

    correlations = []

    # Score vs Latency
    r_score_latency = calculate_pearson_correlation(scores, latencies)
    interpretation = interpret_correlation(r_score_latency)
    insight = ""
    if "negative" in interpretation:
        insight = "Higher latency tends to correlate with lower scores. Consider optimizing slow requests."
    elif "positive" in interpretation:
        insight = "Surprisingly, higher latency correlates with better scores. This may indicate more thorough processing."
    else:
        insight = "No significant relationship between latency and score quality."

    correlations.append(
        CorrelationResult(
            x_metric="latency",
            y_metric="score",
            correlation=round(r_score_latency, 3),
            interpretation=interpretation,
            data_points=[
                CorrelationDataPoint(
                    x=t.latency or 0,
                    y=(t.score or 0) * 100,
                    id=t.id,
                    label=t.name,
                )
                for t in traces[:100]  # Limit points for visualization
            ],
            insight=insight,
        )
    )

    # Score vs Cost
    r_score_cost = calculate_pearson_correlation(scores, costs)
    interpretation = interpret_correlation(r_score_cost)
    if "positive" in interpretation:
        insight = "Higher cost correlates with better scores. More expensive models may be worth the investment."
    elif "negative" in interpretation:
        insight = "Higher cost does not guarantee better scores. Review cost efficiency of expensive calls."
    else:
        insight = "Cost and score quality appear independent. Good opportunity for cost optimization."

    correlations.append(
        CorrelationResult(
            x_metric="cost",
            y_metric="score",
            correlation=round(r_score_cost, 3),
            interpretation=interpretation,
            data_points=[
                CorrelationDataPoint(
                    x=t.cost or 0,
                    y=(t.score or 0) * 100,
                    id=t.id,
                    label=t.name,
                )
                for t in traces[:100]
            ],
            insight=insight,
        )
    )

    # Score vs Tokens
    r_score_tokens = calculate_pearson_correlation(scores, tokens)
    interpretation = interpret_correlation(r_score_tokens)
    if "positive" in interpretation:
        insight = "More tokens correlate with better scores. Detailed responses tend to perform better."
    elif "negative" in interpretation:
        insight = "Shorter responses score better. Consider being more concise."
    else:
        insight = "Response length doesn't significantly affect score quality."

    correlations.append(
        CorrelationResult(
            x_metric="tokens",
            y_metric="score",
            correlation=round(r_score_tokens, 3),
            interpretation=interpretation,
            data_points=[
                CorrelationDataPoint(
                    x=t.total_tokens or 0,
                    y=(t.score or 0) * 100,
                    id=t.id,
                    label=t.name,
                )
                for t in traces[:100]
            ],
            insight=insight,
        )
    )

    return CorrelationsResponse(correlations=correlations)


@router.get("/cost-forecast", response_model=CostForecastResponse)
def get_cost_forecast(
    time_range: str = Query("7d", alias="timeRange"),
    forecast_days: int = Query(7),
    db: Session = Depends(get_db),
):
    """Get cost forecast based on historical data."""
    start_date, _, now = get_date_range(time_range)

    # Get daily cost data
    date_trunc_col = func.date_trunc("day", Trace.start_time)
    date_format = func.to_char(date_trunc_col, "YYYY-MM-DD")

    daily_costs = (
        db.query(
            date_format.label("date"),
            func.sum(Trace.cost).label("cost"),
        )
        .filter(Trace.start_time >= start_date)
        .group_by(date_trunc_col)
        .order_by(date_trunc_col)
        .all()
    )

    historical = [
        TrendDataPoint(date=row.date, value=round(row.cost or 0, 4))
        for row in daily_costs
    ]

    # Simple linear forecast (could be enhanced with more sophisticated methods)
    if len(historical) < 2:
        avg_daily = historical[0].value if historical else 0
        slope = 0
    else:
        costs = [h.value for h in historical]
        avg_daily = sum(costs) / len(costs)

        # Calculate trend (simple linear regression slope)
        n = len(costs)
        x_vals = list(range(n))
        x_mean = sum(x_vals) / n
        y_mean = avg_daily

        numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_vals, costs))
        denominator = sum((x - x_mean) ** 2 for x in x_vals)
        slope = numerator / denominator if denominator else 0

    # Generate forecast
    forecast = []
    last_date = datetime.strptime(historical[-1].date, "%Y-%m-%d") if historical else now
    last_value = historical[-1].value if historical else 0

    for i in range(1, forecast_days + 1):
        forecast_date = last_date + timedelta(days=i)
        forecast_value = max(0, last_value + slope * i)

        # Calculate confidence interval (simplified)
        std_dev = (
            (sum((h.value - avg_daily) ** 2 for h in historical) / len(historical))
            ** 0.5
            if historical
            else 0
        )
        margin = std_dev * 1.96 * (1 + i * 0.1)  # Widen over time

        forecast.append(
            ForecastDataPoint(
                date=forecast_date.strftime("%Y-%m-%d"),
                actual=None,
                forecast=round(forecast_value, 4),
                lower_bound=round(max(0, forecast_value - margin), 4),
                upper_bound=round(forecast_value + margin, 4),
            )
        )

    projected_total = sum(f.forecast for f in forecast)
    historical_total = sum(h.value for h in historical)
    projected_change = (
        ((projected_total - historical_total) / historical_total * 100)
        if historical_total
        else 0
    )

    return CostForecastResponse(
        historical=historical,
        forecast=forecast,
        projected_total=round(projected_total, 4),
        projected_change_percent=round(projected_change, 1),
        avg_daily_cost=round(avg_daily, 4),
    )


@router.get("/insights", response_model=InsightsResponse)
def get_insights(
    time_range: str = Query("7d", alias="timeRange"),
    db: Session = Depends(get_db),
):
    """Generate data-driven insights and recommendations."""
    start_date, prev_start, now = get_date_range(time_range)

    # Current period aggregates
    curr = (
        db.query(
            func.avg(Trace.score).label("avg_score"),
            func.avg(Trace.latency).label("avg_latency"),
            func.sum(Trace.cost).label("total_cost"),
            func.count(Trace.id).label("volume"),
            func.sum(case((Trace.status == "fail", 1), else_=0)).label("failures"),
        )
        .filter(Trace.start_time >= start_date)
        .first()
    )

    # Previous period aggregates
    prev = (
        db.query(
            func.avg(Trace.score).label("avg_score"),
            func.avg(Trace.latency).label("avg_latency"),
            func.sum(Trace.cost).label("total_cost"),
            func.count(Trace.id).label("volume"),
            func.sum(case((Trace.status == "fail", 1), else_=0)).label("failures"),
        )
        .filter(Trace.start_time >= prev_start, Trace.start_time < start_date)
        .first()
    )

    # Model performance
    model_stats = (
        db.query(
            Trace.model_name,
            func.avg(Trace.score).label("avg_score"),
            func.sum(Trace.cost).label("total_cost"),
            func.count(Trace.id).label("volume"),
        )
        .filter(Trace.start_time >= start_date, Trace.model_name != None)
        .group_by(Trace.model_name)
        .all()
    )

    # Failure modes
    failure_modes = (
        db.query(Trace.failure_mode, func.count(Trace.id).label("count"))
        .filter(
            Trace.start_time >= start_date,
            Trace.failure_mode != None,
            Trace.status == "fail",
        )
        .group_by(Trace.failure_mode)
        .order_by(func.count(Trace.id).desc())
        .limit(5)
        .all()
    )

    insights = []

    # Calculate metrics
    curr_score = (curr.avg_score or 0) * 100
    prev_score = (prev.avg_score or 0) * 100 if prev else 0
    curr_error_rate = (
        (curr.failures / curr.volume * 100) if curr and curr.volume else 0
    )
    prev_error_rate = (prev.failures / prev.volume * 100) if prev and prev.volume else 0

    # Quality insights
    if curr_score >= 80:
        insights.append(
            InsightItem(
                type="success",
                category="quality",
                title="Strong Quality Performance",
                description=f"Average score is {curr_score:.1f}%, indicating high-quality AI responses.",
                metric_value=f"{curr_score:.1f}%",
                recommendation="Maintain current quality standards and document successful patterns.",
            )
        )
    elif curr_score < 60:
        insights.append(
            InsightItem(
                type="danger",
                category="quality",
                title="Quality Below Target",
                description=f"Average score is {curr_score:.1f}%, below the recommended 60% threshold.",
                metric_value=f"{curr_score:.1f}%",
                recommendation="Review low-scoring traces and identify common failure patterns.",
            )
        )

    # Score trend
    if prev_score > 0:
        score_change = curr_score - prev_score
        if score_change <= -5:
            insights.append(
                InsightItem(
                    type="warning",
                    category="quality",
                    title="Quality Declining",
                    description=f"Score dropped by {abs(score_change):.1f}% compared to previous period.",
                    metric_value=f"{score_change:+.1f}%",
                    recommendation="Investigate recent changes that may have affected quality.",
                )
            )
        elif score_change >= 5:
            insights.append(
                InsightItem(
                    type="success",
                    category="quality",
                    title="Quality Improving",
                    description=f"Score improved by {score_change:.1f}% compared to previous period.",
                    metric_value=f"+{score_change:.1f}%",
                    recommendation="Document changes that led to improvement for future reference.",
                )
            )

    # Error rate insights
    if curr_error_rate > 10:
        insights.append(
            InsightItem(
                type="danger",
                category="reliability",
                title="High Error Rate",
                description=f"Error rate is {curr_error_rate:.1f}%, significantly above acceptable levels.",
                metric_value=f"{curr_error_rate:.1f}%",
                recommendation="Prioritize error investigation and implement error handling improvements.",
            )
        )
    elif curr_error_rate > 5:
        insights.append(
            InsightItem(
                type="warning",
                category="reliability",
                title="Elevated Error Rate",
                description=f"Error rate is {curr_error_rate:.1f}%, consider investigating failures.",
                metric_value=f"{curr_error_rate:.1f}%",
                recommendation="Review failure modes and address the most common issues.",
            )
        )

    # Cost insights
    if model_stats:
        # Find cost optimization opportunities
        models_by_cost_efficiency = sorted(
            model_stats,
            key=lambda m: ((m.avg_score or 0) / (m.total_cost / m.volume))
            if m.total_cost and m.volume
            else 0,
            reverse=True,
        )

        if len(models_by_cost_efficiency) > 1:
            best = models_by_cost_efficiency[0]
            worst = models_by_cost_efficiency[-1]
            if best.model_name != worst.model_name:
                best_efficiency = (
                    (best.avg_score or 0) * 100 / (best.total_cost / best.volume)
                    if best.total_cost and best.volume
                    else 0
                )
                worst_efficiency = (
                    (worst.avg_score or 0)
                    * 100
                    / (worst.total_cost / worst.volume)
                    if worst.total_cost and worst.volume
                    else 0
                )
                if best_efficiency > worst_efficiency * 1.5:
                    insights.append(
                        InsightItem(
                            type="info",
                            category="cost",
                            title="Cost Optimization Opportunity",
                            description=f"{best.model_name} offers better cost efficiency than {worst.model_name}.",
                            metric_value=f"{best_efficiency:.1f} vs {worst_efficiency:.1f} score/$",
                            recommendation=f"Consider shifting more traffic to {best.model_name} for cost savings.",
                        )
                    )

    # Failure mode insights
    if failure_modes:
        top_failure = failure_modes[0]
        total_failures = sum(f.count for f in failure_modes)
        top_percentage = (top_failure.count / total_failures * 100) if total_failures else 0

        if top_percentage > 40:
            insights.append(
                InsightItem(
                    type="warning",
                    category="reliability",
                    title="Dominant Failure Mode",
                    description=f"'{top_failure.failure_mode}' accounts for {top_percentage:.0f}% of failures.",
                    metric_value=f"{top_failure.count} occurrences",
                    recommendation=f"Focus improvement efforts on addressing '{top_failure.failure_mode}' issues.",
                )
            )

    # Volume insights
    if curr.volume and prev and prev.volume:
        volume_change = ((curr.volume - prev.volume) / prev.volume) * 100
        if volume_change > 50:
            insights.append(
                InsightItem(
                    type="info",
                    category="performance",
                    title="Traffic Surge",
                    description=f"Request volume increased by {volume_change:.0f}% compared to previous period.",
                    metric_value=f"{curr.volume} requests",
                    recommendation="Monitor system performance and consider scaling if trend continues.",
                )
            )

    # Summary
    summary = {
        "total_insights": len(insights),
        "by_type": {
            "success": len([i for i in insights if i.type == "success"]),
            "warning": len([i for i in insights if i.type == "warning"]),
            "danger": len([i for i in insights if i.type == "danger"]),
            "info": len([i for i in insights if i.type == "info"]),
        },
        "current_score": round(curr_score, 1),
        "current_error_rate": round(curr_error_rate, 1),
        "total_cost": round(curr.total_cost or 0, 4),
        "total_volume": curr.volume or 0,
    }

    return InsightsResponse(insights=insights, summary=summary)


def detect_anomalies(values: List[float], dates: List[str], z_threshold: float = 2.0):
    """Detect anomalies using z-score method."""
    if len(values) < 3:
        return [], [], 0, 0

    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / len(values)
    std_dev = variance ** 0.5

    if std_dev == 0:
        # No variance - return all data points with zero z-scores
        data_points = [
            AnomalyDataPoint(
                date=date,
                value=round(value, 4),
                z_score=0,
                is_anomaly=False,
                anomaly_type=None,
            )
            for value, date in zip(values, dates)
        ]
        return data_points, [], mean, 0

    anomalies = []
    data_points = []

    for i, (value, date) in enumerate(zip(values, dates)):
        z_score = (value - mean) / std_dev
        is_anomaly = abs(z_score) > z_threshold

        anomaly_type = None
        if is_anomaly:
            if z_score > 0:
                anomaly_type = "spike" if z_score > z_threshold + 1 else "high"
            else:
                anomaly_type = "drop" if z_score < -(z_threshold + 1) else "low"

        point = AnomalyDataPoint(
            date=date,
            value=round(value, 4),
            z_score=round(z_score, 2),
            is_anomaly=is_anomaly,
            anomaly_type=anomaly_type,
        )
        data_points.append(point)
        if is_anomaly:
            anomalies.append(point)

    return data_points, anomalies, mean, std_dev


@router.get("/anomalies", response_model=AnomaliesResponse)
def get_anomalies(
    time_range: str = Query("7d", alias="timeRange"),
    z_threshold: float = Query(2.0, alias="zThreshold"),
    db: Session = Depends(get_db),
):
    """Detect anomalies in key metrics using statistical analysis."""
    start_date, _, now = get_date_range(time_range)

    # Determine time bucket for aggregation
    if time_range == "24h":
        date_trunc_col = func.date_trunc("hour", Trace.start_time)
        date_format = func.to_char(date_trunc_col, "YYYY-MM-DD HH24:00")
    elif time_range in ["7d", "30d"]:
        date_trunc_col = func.date_trunc("day", Trace.start_time)
        date_format = func.to_char(date_trunc_col, "YYYY-MM-DD")
    else:
        date_trunc_col = func.date_trunc("week", Trace.start_time)
        date_format = func.to_char(date_trunc_col, "YYYY-\"W\"IW")

    # Query aggregated data
    data = (
        db.query(
            date_format.label("period"),
            func.avg(Trace.score).label("avg_score"),
            func.avg(Trace.latency).label("avg_latency"),
            func.sum(Trace.cost).label("total_cost"),
            func.count(Trace.id).label("volume"),
            func.sum(case((Trace.status == "fail", 1), else_=0)).label("failures"),
        )
        .filter(Trace.start_time >= start_date)
        .group_by(date_trunc_col)
        .order_by(date_trunc_col)
        .all()
    )

    if not data:
        return AnomaliesResponse(
            metrics=[],
            total_anomalies=0,
            summary="Insufficient data for anomaly detection.",
        )

    dates = [row.period for row in data]
    metrics_data = {
        "score": [(row.avg_score or 0) * 100 for row in data],
        "latency": [row.avg_latency or 0 for row in data],
        "cost": [row.total_cost or 0 for row in data],
        "volume": [row.volume or 0 for row in data],
        "error_rate": [
            (row.failures / row.volume * 100) if row.volume else 0 for row in data
        ],
    }

    results = []
    total_anomalies = 0

    for metric_name, values in metrics_data.items():
        data_points, anomalies, mean, std_dev = detect_anomalies(
            values, dates, z_threshold
        )
        total_anomalies += len(anomalies)

        results.append(
            AnomalyMetric(
                metric=metric_name,
                data_points=data_points,
                anomalies=anomalies,
                mean=round(mean, 4),
                std_dev=round(std_dev, 4),
                anomaly_count=len(anomalies),
            )
        )

    # Generate summary
    if total_anomalies == 0:
        summary = "No anomalies detected. All metrics are within normal ranges."
    elif total_anomalies <= 3:
        summary = f"{total_anomalies} anomaly(ies) detected. Minor deviations from normal patterns."
    else:
        summary = f"{total_anomalies} anomalies detected. Significant deviations require attention."

    return AnomaliesResponse(
        metrics=results,
        total_anomalies=total_anomalies,
        summary=summary,
    )
