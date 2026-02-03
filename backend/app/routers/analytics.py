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
