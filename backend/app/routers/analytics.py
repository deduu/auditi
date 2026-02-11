# Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
"""Analytics API routes for trends, distributions, and insights."""

from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, case, cast, String, desc

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Trace, Span
from app.models.annotation import Annotation
from app.models.score_config import ScoreConfig
from app.schemas.analytics import (
    ScoreDistributionResponse,
    ScoreDistributionBucket,
    LowScoringTracesResponse,
    LowScoringTrace,
    TrendsResponse,
    TrendMetric,
    TrendDataPoint,
    ModelComparisonResponse,
    ModelComparisonItem,
    FailureModeCount,
    TraceNameCount,
    ToolAnalyticsResponse,
    ToolAnalyticsSummary,
    ToolAnalyticsItem,
    CorrelationsResponse,
    CorrelationResult,
    CorrelationDataPoint,
    CostForecastResponse,
    ForecastDataPoint,
    InsightsResponse,
    InsightItem,
    AnomaliesResponse,
    AnomalyMetric,
    AnomalyDataPoint,
    LatencyPercentileDataPoint,
    LatencyPercentilesTimeSeriesResponse,
    UserConsumptionDataPoint,
    UserConsumptionResponse,
    ScoreTrendDataPoint,
    ScoreTrendByEvaluatorResponse,
)

router = APIRouter(prefix="/analytics", tags=["analytics"], dependencies=[Depends(get_current_user)])


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


@router.get("/dashboard-kpis")
def get_dashboard_kpis(
    time_range: str = Query("7d", alias="timeRange"),
    limit: int = Query(5),
    trace_type: Optional[str] = Query(
        None, alias="traceType"
    ),  # agent, standalone, or None
    db: Session = Depends(get_db),
):
    """
    Get KPI data for the dashboard with breakdown views:
    - traces_by_name: Traces grouped by name with counts
    - model_costs: Model costs with token breakdowns
    - score_evaluations: Score breakdown by evaluator with pass/fail counts
    """
    start_date, _, _ = get_date_range(time_range)

    # 1. Traces by name
    # Filter by trace type based on tags:
    # - Agent traces: do NOT have "standalone" in tags
    # - Standalone traces: have "standalone" in tags
    trace_query = db.query(Trace.name, func.count(Trace.id).label("count")).filter(
        Trace.start_time >= start_date, Trace.name != None
    )

    if trace_type == "agent":
        # Agent traces don't have "standalone" tag
        trace_query = trace_query.filter(
            ~func.coalesce(func.cast(Trace.tags, String), "[]").contains('"standalone"')
        )
    elif trace_type == "standalone":
        # Standalone traces have "standalone" tag
        trace_query = trace_query.filter(
            func.coalesce(func.cast(Trace.tags, String), "[]").contains('"standalone"')
        )

    traces_by_name_data = (
        trace_query.group_by(Trace.name).order_by(desc("count")).limit(limit).all()
    )

    traces_by_name = [
        {"name": row.name or "unknown", "count": row.count}
        for row in traces_by_name_data
    ]

    total_traces_query = db.query(func.count(Trace.id)).filter(
        Trace.start_time >= start_date
    )
    if trace_type == "agent":
        total_traces_query = total_traces_query.filter(
            ~func.coalesce(func.cast(Trace.tags, String), "[]").contains('"standalone"')
        )
    elif trace_type == "standalone":
        total_traces_query = total_traces_query.filter(
            func.coalesce(func.cast(Trace.tags, String), "[]").contains('"standalone"')
        )

    total_traces = total_traces_query.scalar() or 0

    # Compute counts by trace type for tab badges
    all_count = (
        db.query(func.count(Trace.id)).filter(Trace.start_time >= start_date).scalar()
        or 0
    )

    standalone_count = (
        db.query(func.count(Trace.id))
        .filter(
            Trace.start_time >= start_date,
            func.coalesce(func.cast(Trace.tags, String), "[]").contains('"standalone"'),
        )
        .scalar()
        or 0
    )

    agent_count = all_count - standalone_count

    counts_by_type = {
        "all": all_count,
        "agent": agent_count,
        "standalone": standalone_count,
    }

    # 2. Model costs with tokens
    model_costs_data = (
        db.query(
            Span.model,
            func.sum(Span.input_tokens + Span.output_tokens).label("total_tokens"),
            func.sum(Span.cost).label("total_cost"),
        )
        .filter(
            Span.span_type == "llm", Span.model != None, Span.start_time >= start_date
        )
        .group_by(Span.model)
        .order_by(desc("total_cost"))
        .limit(limit)
        .all()
    )

    model_costs = [
        {
            "model": row.model,
            "tokens": row.total_tokens or 0,
            "cost": row.total_cost or 0.0,
        }
        for row in model_costs_data
    ]
    total_cost = (
        db.query(func.sum(Span.cost))
        .filter(Span.span_type == "llm", Span.start_time >= start_date)
        .scalar()
        or 0.0
    )

    # 3. Score evaluations breakdown (by score config name)
    score_evaluations_data = (
        db.query(
            ScoreConfig.name,
            func.count(Annotation.id).label("count"),
            func.avg(Annotation.value).label("avg_value"),
            func.sum(case((Annotation.value == 0, 1), else_=0)).label("fail_count"),
            func.sum(case((Annotation.value == 1, 1), else_=0)).label("pass_count"),
        )
        .join(ScoreConfig, Annotation.score_config_id == ScoreConfig.id)
        .filter(Annotation.created_at >= start_date)
        .group_by(ScoreConfig.name)
        .order_by(desc("count"))
        .limit(limit)
        .all()
    )

    score_evaluations = [
        {
            "name": f"{row.name} (eval)",
            "count": row.count,
            "avg": round(row.avg_value, 2) if row.avg_value else 0,
            "fail_count": row.fail_count or 0,
            "pass_count": row.pass_count or 0,
        }
        for row in score_evaluations_data
    ]
    total_scores = (
        db.query(func.count(Annotation.id))
        .filter(Annotation.created_at >= start_date)
        .scalar()
        or 0
    )

    return {
        "traces": {
            "total": total_traces,
            "by_name": traces_by_name,
            "counts_by_type": counts_by_type,
        },
        "model_costs": {"total": total_cost, "by_model": model_costs},
        "scores": {"total": total_scores, "by_evaluator": score_evaluations},
    }


@router.get("/observations-by-level")
def get_observations_by_level(
    time_range: str = Query("7d", alias="timeRange"), db: Session = Depends(get_db)
):
    """Get observations (spans) count breakdown by level (span_type) over time."""
    start_date, prev_start, now = get_date_range(time_range)

    if time_range == "24h":
        date_trunc_col = func.date_trunc("hour", Span.start_time)
        date_format = func.to_char(date_trunc_col, "HH24:00")
    elif time_range in ["7d", "30d"]:
        date_trunc_col = func.date_trunc("day", Span.start_time)
        date_format = func.to_char(date_trunc_col, "YYYY-MM-DD")
    else:
        date_trunc_col = func.date_trunc("week", Span.start_time)
        date_format = func.to_char(date_trunc_col, 'YYYY-"W"IW')

    # Query spans grouped by time and type
    results = (
        db.query(
            date_format.label("period"),
            Span.span_type,
            func.count(Span.id).label("count"),
        )
        .filter(Span.start_time >= start_date)
        .group_by(date_trunc_col, Span.span_type)
        .order_by(date_trunc_col)
        .all()
    )

    # Process into chart-friendly format: [{date: "...", agent: 10, llm: 5, tool: 2}]
    data_map = {}
    all_types = set()

    for row in results:
        period = row.period
        if period not in data_map:
            data_map[period] = {"date": period}

        # Normalize span types
        s_type = row.span_type.lower() if row.span_type else "unknown"
        data_map[period][s_type] = row.count
        all_types.add(s_type)

    # Ensure all periods have all keys (for Recharts stacking/ordering if needed, usually optional)
    # Recharts handles missing keys fine, but good for consistency
    chart_data = list(data_map.values())

    # Sort by date
    # Note: dictionary iteration order is insertion order in modern python,
    # and we ordered by date_trunc_col, so it should be sorted.

    return {"data": chart_data, "levels": list(all_types)}


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

    problem_filter = or_(Trace.score < db_threshold, Trace.status == "fail")

    traces = (
        db.query(Trace)
        .filter(
            Trace.start_time >= start_date,
            Trace.score != None,
            problem_filter,
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
            problem_filter,
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
        date_format = func.to_char(date_trunc_col, 'YYYY-"W"IW')

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
            return None
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

    # Query model stats including total_tokens
    model_stats = (
        db.query(
            Trace.model_name,
            func.avg(Trace.score).label("avg_score"),
            func.avg(Trace.latency).label("avg_latency"),
            func.sum(Trace.cost).label("total_cost"),
            func.count(Trace.id).label("volume"),
            func.sum(case((Trace.status == "fail", 1), else_=0)).label("failures"),
            func.sum(func.coalesce(Trace.total_tokens, 0)).label("total_tokens"),
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
        p95_idx = int(len(latency_values) * 0.95)
        p95 = (
            latency_values[p95_idx]
            if latency_values and p95_idx < len(latency_values)
            else 0
        )
        p99_idx = int(len(latency_values) * 0.99)
        p99 = (
            latency_values[p99_idx]
            if latency_values and p99_idx < len(latency_values)
            else 0
        )

        error_rate = (row.failures / row.volume * 100) if row.volume else 0
        failures_count = row.failures or 0

        # Scale score to 0-100
        avg_score = (row.avg_score or 0) * 100

        # Derived cost/token fields
        total_cost = row.total_cost or 0
        volume = row.volume or 0
        total_tokens = row.total_tokens or 0

        cost_per_request = (total_cost / volume) if volume else 0
        tokens_per_request = (total_tokens / volume) if volume else 0
        cost_per_1k_tokens = ((total_cost / total_tokens) * 1000) if total_tokens else 0

        # Sub-query: top 5 failure modes for this model
        failure_mode_rows = (
            db.query(
                Trace.failure_mode,
                func.count(Trace.id).label("cnt"),
            )
            .filter(
                Trace.start_time >= start_date,
                Trace.model_name == row.model_name,
                Trace.failure_mode != None,
                Trace.failure_mode != "",
            )
            .group_by(Trace.failure_mode)
            .order_by(desc("cnt"))
            .limit(5)
            .all()
        )
        failure_modes = [
            FailureModeCount(mode=fm.failure_mode, count=fm.cnt)
            for fm in failure_mode_rows
        ]

        # Sub-query: top 5 trace names using this model
        trace_name_rows = (
            db.query(
                Trace.name,
                func.count(Trace.id).label("cnt"),
            )
            .filter(
                Trace.start_time >= start_date,
                Trace.model_name == row.model_name,
                Trace.name != None,
            )
            .group_by(Trace.name)
            .order_by(desc("cnt"))
            .limit(5)
            .all()
        )
        trace_names = [
            TraceNameCount(name=tn.name, count=tn.cnt)
            for tn in trace_name_rows
        ]

        result.append(
            ModelComparisonItem(
                model=row.model_name or "Unknown",
                score=round(avg_score, 1),
                latency_p50=round(p50, 3),
                latency_p90=round(p90, 3),
                latency_p95=round(p95, 3),
                latency_p99=round(p99, 3),
                cost=round(total_cost, 4),
                volume=volume,
                error_rate=round(error_rate, 1),
                cost_per_request=round(cost_per_request, 6),
                total_tokens=total_tokens,
                tokens_per_request=round(tokens_per_request, 1),
                cost_per_1k_tokens=round(cost_per_1k_tokens, 6),
                failure_modes=failure_modes,
                trace_names=trace_names,
                error_count=failures_count,
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


def calculate_pearson_correlation(
    x_values: List[float], y_values: List[float]
) -> float:
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
    last_date = (
        datetime.strptime(historical[-1].date, "%Y-%m-%d") if historical else now
    )
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
    # Import locally to avoid circular imports if any, though service structure handles it well.
    # The service function was verified to match this logic.
    from app.services.analytics import generate_insights as generate_insights_service

    insights, summary = generate_insights_service(db, time_range)

    return InsightsResponse(insights=insights, summary=summary)


def detect_anomalies(values: List[float], dates: List[str], z_threshold: float = 2.0):
    """Detect anomalies using z-score method."""
    if len(values) < 3:
        return [], [], 0, 0

    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / len(values)
    std_dev = variance**0.5

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
        date_format = func.to_char(date_trunc_col, 'YYYY-"W"IW')

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


# ============== Latency Percentiles Time Series ==============


@router.get(
    "/latency-percentiles-time-series",
    response_model=LatencyPercentilesTimeSeriesResponse,
)
def get_latency_percentiles_time_series(
    time_range: str = Query("7d", alias="timeRange"),
    db: Session = Depends(get_db),
):
    """Get time-series latency percentiles for traces, generations, and spans."""
    start_date, _, _ = get_date_range(time_range)

    # Build date truncation and formatting columns
    if time_range == "24h":
        trace_trunc = func.date_trunc("hour", Trace.start_time)
        trace_fmt = func.to_char(trace_trunc, "YYYY-MM-DD HH24:00")
        span_trunc = func.date_trunc("hour", Span.start_time)
        span_fmt = func.to_char(span_trunc, "YYYY-MM-DD HH24:00")
    elif time_range in ["7d", "30d"]:
        trace_trunc = func.date_trunc("day", Trace.start_time)
        trace_fmt = func.to_char(trace_trunc, "YYYY-MM-DD")
        span_trunc = func.date_trunc("day", Span.start_time)
        span_fmt = func.to_char(span_trunc, "YYYY-MM-DD")
    else:
        trace_trunc = func.date_trunc("week", Trace.start_time)
        trace_fmt = func.to_char(trace_trunc, 'YYYY-"W"IW')
        span_trunc = func.date_trunc("week", Span.start_time)
        span_fmt = func.to_char(span_trunc, 'YYYY-"W"IW')

    # 1) Trace latency percentiles
    trace_rows = (
        db.query(
            trace_fmt.label("period"),
            func.percentile_cont(0.5).within_group(Trace.latency.asc()).label("p50"),
            func.percentile_cont(0.9).within_group(Trace.latency.asc()).label("p90"),
            func.percentile_cont(0.95).within_group(Trace.latency.asc()).label("p95"),
            func.percentile_cont(0.99).within_group(Trace.latency.asc()).label("p99"),
        )
        .filter(Trace.start_time >= start_date, Trace.latency.isnot(None))
        .group_by(trace_trunc)
        .order_by(trace_trunc)
        .all()
    )

    # 2) Generation (LLM span) latency percentiles
    gen_rows = (
        db.query(
            span_fmt.label("period"),
            func.percentile_cont(0.5)
            .within_group(Span.processing_time.asc())
            .label("p50"),
            func.percentile_cont(0.9)
            .within_group(Span.processing_time.asc())
            .label("p90"),
            func.percentile_cont(0.95)
            .within_group(Span.processing_time.asc())
            .label("p95"),
            func.percentile_cont(0.99)
            .within_group(Span.processing_time.asc())
            .label("p99"),
        )
        .filter(
            Span.start_time >= start_date,
            Span.processing_time.isnot(None),
            Span.span_type == "llm",
        )
        .group_by(span_trunc)
        .order_by(span_trunc)
        .all()
    )

    # 3) All-span latency percentiles
    span_rows = (
        db.query(
            span_fmt.label("period"),
            func.percentile_cont(0.5)
            .within_group(Span.processing_time.asc())
            .label("p50"),
            func.percentile_cont(0.9)
            .within_group(Span.processing_time.asc())
            .label("p90"),
            func.percentile_cont(0.95)
            .within_group(Span.processing_time.asc())
            .label("p95"),
            func.percentile_cont(0.99)
            .within_group(Span.processing_time.asc())
            .label("p99"),
        )
        .filter(Span.start_time >= start_date, Span.processing_time.isnot(None))
        .group_by(span_trunc)
        .order_by(span_trunc)
        .all()
    )

    def to_points(rows):
        return [
            LatencyPercentileDataPoint(
                date=r.period,
                p50=round(r.p50 or 0, 4),
                p90=round(r.p90 or 0, 4),
                p95=round(r.p95 or 0, 4),
                p99=round(r.p99 or 0, 4),
            )
            for r in rows
        ]

    return LatencyPercentilesTimeSeriesResponse(
        trace_latency=to_points(trace_rows),
        generation_latency=to_points(gen_rows),
        span_latency=to_points(span_rows),
    )


# ============== User Consumption ==============


@router.get("/user-consumption", response_model=UserConsumptionResponse)
def get_user_consumption(
    time_range: str = Query("7d", alias="timeRange"),
    metric: str = Query("cost"),
    limit: int = Query(10),
    db: Session = Depends(get_db),
):
    """Get per-user consumption time series (cost or trace count)."""
    start_date, _, _ = get_date_range(time_range)

    user_col = func.coalesce(Trace.user_id, "Anonymous")

    # Determine aggregation
    if metric == "cost":
        agg_func = func.sum(Trace.cost)
    else:
        agg_func = func.count(Trace.id)

    # Step 1: Find top N users by total metric
    top_users_q = (
        db.query(user_col.label("uid"), agg_func.label("total"))
        .filter(Trace.start_time >= start_date)
        .group_by(user_col)
        .order_by(desc("total"))
        .limit(limit)
        .all()
    )

    top_user_ids = [r.uid for r in top_users_q]
    overall_total = sum(r.total or 0 for r in top_users_q)

    if not top_user_ids:
        return UserConsumptionResponse(data=[], users=[], metric=metric, total=0)

    # Step 2: Time-series for those users
    if time_range == "24h":
        date_trunc_col = func.date_trunc("hour", Trace.start_time)
        date_format = func.to_char(date_trunc_col, "YYYY-MM-DD HH24:00")
    elif time_range in ["7d", "30d"]:
        date_trunc_col = func.date_trunc("day", Trace.start_time)
        date_format = func.to_char(date_trunc_col, "YYYY-MM-DD")
    else:
        date_trunc_col = func.date_trunc("week", Trace.start_time)
        date_format = func.to_char(date_trunc_col, 'YYYY-"W"IW')

    ts_rows = (
        db.query(
            date_format.label("period"),
            user_col.label("uid"),
            agg_func.label("value"),
        )
        .filter(Trace.start_time >= start_date, user_col.in_(top_user_ids))
        .group_by(date_trunc_col, user_col)
        .order_by(date_trunc_col)
        .all()
    )

    data_points = [
        UserConsumptionDataPoint(
            date=r.period,
            user_id=r.uid,
            value=round(float(r.value or 0), 6),
        )
        for r in ts_rows
    ]

    return UserConsumptionResponse(
        data=data_points,
        users=top_user_ids,
        metric=metric,
        total=round(float(overall_total), 6),
    )


# ============== Score Trends by Evaluator ==============


@router.get(
    "/score-trends-by-evaluator",
    response_model=ScoreTrendByEvaluatorResponse,
)
def get_score_trends_by_evaluator(
    time_range: str = Query("7d", alias="timeRange"),
    limit: int = Query(5),
    db: Session = Depends(get_db),
):
    """Get time-series score trends broken down by evaluator (score config)."""
    start_date, _, _ = get_date_range(time_range)

    # Build date truncation
    if time_range == "24h":
        date_trunc_col = func.date_trunc("hour", Annotation.created_at)
        date_format = func.to_char(date_trunc_col, "YYYY-MM-DD HH24:00")
    elif time_range in ["7d", "30d"]:
        date_trunc_col = func.date_trunc("day", Annotation.created_at)
        date_format = func.to_char(date_trunc_col, "YYYY-MM-DD")
    else:
        date_trunc_col = func.date_trunc("week", Annotation.created_at)
        date_format = func.to_char(date_trunc_col, 'YYYY-"W"IW')

    # 1) Find top evaluators by annotation count
    top_evaluators = (
        db.query(
            ScoreConfig.id,
            ScoreConfig.name,
            func.count(Annotation.id).label("cnt"),
        )
        .join(Annotation, Annotation.score_config_id == ScoreConfig.id)
        .filter(Annotation.created_at >= start_date)
        .group_by(ScoreConfig.id, ScoreConfig.name)
        .order_by(desc("cnt"))
        .limit(limit)
        .all()
    )

    if not top_evaluators:
        return ScoreTrendByEvaluatorResponse(data=[], evaluators=[], total_avg=0.0)

    evaluator_ids = [e.id for e in top_evaluators]
    evaluator_names = [e.name for e in top_evaluators]
    id_to_name = {e.id: e.name for e in top_evaluators}

    # 2) Get time-series data for those evaluators
    ts_rows = (
        db.query(
            date_format.label("period"),
            Annotation.score_config_id,
            func.avg(Annotation.value).label("avg_value"),
        )
        .filter(
            Annotation.created_at >= start_date,
            Annotation.score_config_id.in_(evaluator_ids),
        )
        .group_by(date_trunc_col, Annotation.score_config_id)
        .order_by(date_trunc_col)
        .all()
    )

    # 3) Calculate overall average
    overall_avg = (
        db.query(func.avg(Annotation.value))
        .filter(
            Annotation.created_at >= start_date,
            Annotation.score_config_id.in_(evaluator_ids),
        )
        .scalar()
    ) or 0.0

    data_points = [
        ScoreTrendDataPoint(
            date=r.period,
            evaluator_name=id_to_name.get(r.score_config_id, "Unknown"),
            value=round(float(r.avg_value or 0) * 100, 2),  # Scale to 0-100
        )
        for r in ts_rows
    ]

    return ScoreTrendByEvaluatorResponse(
        data=data_points,
        evaluators=evaluator_names,
        total_avg=round(float(overall_avg) * 100, 2),
    )
