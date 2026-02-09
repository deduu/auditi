"""Evaluations API routes."""

import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import case, desc, func
from typing import List, Optional

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Trace
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(tags=["evaluations"], dependencies=[Depends(get_current_user)])


from datetime import datetime, timedelta, timezone


class EvaluationStat(BaseModel):
    id: str
    name: str
    score: float
    trend: str
    pass_rate: float
    count: int
    avg_latency: float
    total_cost: float
    total_tokens: int


class EvaluationsResponse(BaseModel):
    evaluations: List[EvaluationStat]


class FailureModeStat(BaseModel):
    id: str
    name: str
    count: int
    percentage: float


class FailureTrendPoint(BaseModel):
    date: str
    count: int
    failure_rate: float


class FailureTrendsResponse(BaseModel):
    trends: List[FailureTrendPoint]
    total_failures: int
    avg_daily_failures: float


class FailureByModelItem(BaseModel):
    model: str
    total_traces: int
    failures: int
    failure_rate: float
    top_failure_mode: Optional[str] = None


class FailureInsight(BaseModel):
    type: str  # "warning", "danger", "info", "success"
    title: str
    description: str
    metric_value: Optional[str] = None
    recommendation: Optional[str] = None


class FailureAnalyticsResponse(BaseModel):
    modes: List[FailureModeStat]
    trends: List[FailureTrendPoint]
    by_model: List[FailureByModelItem]
    insights: List[FailureInsight]
    summary: dict


@router.get("/evaluations", response_model=EvaluationsResponse)
def get_evaluations(
    time_range: str = Query("7d", alias="timeRange"), db: Session = Depends(get_db)
):
    """
    Get aggregated evaluation statistics grouped by Agent/Task name.
    """
    try:
        # 1. Parse Time Range
        now = datetime.now(timezone.utc)
        if time_range == "24h":
            delta = timedelta(hours=24)
        elif time_range == "7d":
            delta = timedelta(days=7)
        elif time_range == "30d":
            delta = timedelta(days=30)
        else:
            delta = timedelta(days=7)  # Default

        start_date = now - delta
        prev_start_date = start_date - delta

        # 2. Query Current Period Stats
        current_stats = (
            db.query(
                Trace.name,
                func.count(Trace.id).label("total"),
                func.avg(Trace.score).label("avg_score"),
                func.sum(case((Trace.status == "pass", 1), else_=0)).label("passed"),
                func.avg(Trace.latency).label("avg_latency"),
                func.sum(Trace.cost).label("total_cost"),
                func.sum(Trace.total_tokens).label("total_tokens"),
            )
            .filter(Trace.name != None, Trace.start_time >= start_date)
            .group_by(Trace.name)
            .all()
        )

        # 3. Query Previous Period Stats (for Trend)
        prev_stats_result = (
            db.query(Trace.name, func.avg(Trace.score).label("avg_score"))
            .filter(
                Trace.name != None,
                Trace.start_time >= prev_start_date,
                Trace.start_time < start_date,
            )
            .group_by(Trace.name)
            .all()
        )

        prev_stats_map = {row.name: row.avg_score for row in prev_stats_result}

        stats = []
        for i, row in enumerate(current_stats):
            name = row.name
            total = row.total
            avg_score = round(row.avg_score or 0, 2)
            passed = row.passed or 0
            pass_rate = round((passed / total) * 100, 1)
            avg_latency = round(row.avg_latency or 0, 2)
            total_cost = round(row.total_cost or 0, 4)
            total_tokens = int(row.total_tokens or 0)

            # Calculate Trend
            prev_score = prev_stats_map.get(name, 0)
            if prev_score > 0:
                trend_val = ((avg_score - prev_score) / prev_score) * 100
                trend = f"{'+' if trend_val >= 0 else ''}{round(trend_val, 1)}%"
            else:
                trend = "0%"  # No previous data

            stats.append(
                EvaluationStat(
                    id=f"eval_{i}",
                    name=str(name),
                    score=float(avg_score * 100),
                    trend=str(trend),
                    pass_rate=float(pass_rate),
                    count=int(total),
                    avg_latency=float(avg_latency),
                    total_cost=float(total_cost),
                    total_tokens=total_tokens,
                )
            )

        return EvaluationsResponse(evaluations=stats)
    except Exception as e:
        logger.exception("Failed to get evaluations")
        raise e


@router.get("/failure-modes", response_model=List[FailureModeStat])
def get_failure_modes(
    time_range: str = Query("7d", alias="timeRange"), db: Session = Depends(get_db)
):
    """
    Get statistics on failure modes.
    """
    # 1. Get total failures
    total_failures = (
        db.query(func.count(Trace.id)).filter(Trace.status == "fail").scalar() or 0
    )

    if total_failures == 0:
        return []

    # 2. Group by failure_mode
    results = (
        db.query(Trace.failure_mode, func.count(Trace.id).label("count"))
        .filter(Trace.status == "fail", Trace.failure_mode != None)
        .group_by(Trace.failure_mode)
        .order_by(desc("count"))
        .all()
    )

    stats = []
    for i, row in enumerate(results):
        mode_name = row.failure_mode
        count = row.count
        percentage = round((count / total_failures) * 100, 1)

        stats.append(
            FailureModeStat(
                id=f"fm_{i}", name=mode_name, count=count, percentage=percentage
            )
        )

    return stats


def get_time_range_dates(time_range: str):
    """Parse time range and return start date."""
    now = datetime.now(timezone.utc)
    if time_range == "24h":
        return now - timedelta(hours=24), now
    elif time_range == "7d":
        return now - timedelta(days=7), now
    elif time_range == "30d":
        return now - timedelta(days=30), now
    elif time_range == "90d":
        return now - timedelta(days=90), now
    return now - timedelta(days=7), now


@router.get("/failure-modes/trends", response_model=FailureTrendsResponse)
def get_failure_trends(
    time_range: str = Query("7d", alias="timeRange"), db: Session = Depends(get_db)
):
    """Get failure trends over time."""
    start_date, end_date = get_time_range_dates(time_range)

    # PostgreSQL compatible date truncation
    date_trunc_col = func.date_trunc("day", Trace.start_time)
    date_format = func.to_char(date_trunc_col, "YYYY-MM-DD")

    # Query daily failure counts
    daily_data = (
        db.query(
            date_format.label("date"),
            func.count(Trace.id).label("total"),
            func.sum(case((Trace.status == "fail", 1), else_=0)).label("failures"),
        )
        .filter(Trace.start_time >= start_date)
        .group_by(date_trunc_col)
        .order_by(date_trunc_col)
        .all()
    )

    trends = []
    total_failures = 0

    for row in daily_data:
        failures = row.failures or 0
        total = row.total or 1
        failure_rate = round((failures / total) * 100, 1) if total > 0 else 0
        total_failures += failures

        trends.append(
            FailureTrendPoint(
                date=row.date,
                count=failures,
                failure_rate=failure_rate,
            )
        )

    avg_daily = round(total_failures / len(trends), 1) if trends else 0

    return FailureTrendsResponse(
        trends=trends,
        total_failures=total_failures,
        avg_daily_failures=avg_daily,
    )


@router.get("/failure-modes/by-model")
def get_failures_by_model(
    time_range: str = Query("7d", alias="timeRange"), db: Session = Depends(get_db)
):
    """Get failure statistics grouped by model."""
    start_date, _ = get_time_range_dates(time_range)

    # Query model failure stats
    model_stats = (
        db.query(
            Trace.model_name,
            func.count(Trace.id).label("total"),
            func.sum(case((Trace.status == "fail", 1), else_=0)).label("failures"),
        )
        .filter(Trace.start_time >= start_date, Trace.model_name != None)
        .group_by(Trace.model_name)
        .all()
    )

    result = []
    for row in model_stats:
        model = row.model_name or "Unknown"
        total = row.total or 0
        failures = row.failures or 0
        failure_rate = round((failures / total) * 100, 1) if total > 0 else 0

        # Get top failure mode for this model
        top_mode = (
            db.query(Trace.failure_mode, func.count(Trace.id).label("cnt"))
            .filter(
                Trace.start_time >= start_date,
                Trace.model_name == row.model_name,
                Trace.status == "fail",
                Trace.failure_mode != None,
            )
            .group_by(Trace.failure_mode)
            .order_by(desc("cnt"))
            .first()
        )

        result.append(
            FailureByModelItem(
                model=model,
                total_traces=total,
                failures=failures,
                failure_rate=failure_rate,
                top_failure_mode=top_mode.failure_mode if top_mode else None,
            )
        )

    # Sort by failure rate descending
    result.sort(key=lambda x: x.failure_rate, reverse=True)
    return result


@router.get("/failure-modes/analytics", response_model=FailureAnalyticsResponse)
def get_failure_analytics(
    time_range: str = Query("7d", alias="timeRange"), db: Session = Depends(get_db)
):
    """Get comprehensive failure mode analytics."""
    start_date, end_date = get_time_range_dates(time_range)
    prev_start = start_date - (end_date - start_date)

    # 1. Get failure modes
    total_failures = (
        db.query(func.count(Trace.id))
        .filter(Trace.start_time >= start_date, Trace.status == "fail")
        .scalar()
        or 0
    )

    total_traces = (
        db.query(func.count(Trace.id)).filter(Trace.start_time >= start_date).scalar()
        or 0
    )

    mode_results = (
        db.query(Trace.failure_mode, func.count(Trace.id).label("count"))
        .filter(
            Trace.start_time >= start_date,
            Trace.status == "fail",
            Trace.failure_mode != None,
        )
        .group_by(Trace.failure_mode)
        .order_by(desc("count"))
        .all()
    )

    modes = []
    for i, row in enumerate(mode_results):
        percentage = round((row.count / total_failures) * 100, 1) if total_failures > 0 else 0
        modes.append(
            FailureModeStat(
                id=f"fm_{i}",
                name=row.failure_mode,
                count=row.count,
                percentage=percentage,
            )
        )

    # 2. Get trends
    date_trunc_col = func.date_trunc("day", Trace.start_time)
    date_format = func.to_char(date_trunc_col, "YYYY-MM-DD")

    daily_data = (
        db.query(
            date_format.label("date"),
            func.count(Trace.id).label("total"),
            func.sum(case((Trace.status == "fail", 1), else_=0)).label("failures"),
        )
        .filter(Trace.start_time >= start_date)
        .group_by(date_trunc_col)
        .order_by(date_trunc_col)
        .all()
    )

    trends = []
    for row in daily_data:
        failures = row.failures or 0
        total = row.total or 1
        failure_rate = round((failures / total) * 100, 1) if total > 0 else 0
        trends.append(
            FailureTrendPoint(date=row.date, count=failures, failure_rate=failure_rate)
        )

    # 3. Get failures by model
    model_stats = (
        db.query(
            Trace.model_name,
            func.count(Trace.id).label("total"),
            func.sum(case((Trace.status == "fail", 1), else_=0)).label("failures"),
        )
        .filter(Trace.start_time >= start_date, Trace.model_name != None)
        .group_by(Trace.model_name)
        .all()
    )

    by_model = []
    for row in model_stats:
        total = row.total or 0
        failures = row.failures or 0
        if total > 0:
            failure_rate = round((failures / total) * 100, 1)
            by_model.append(
                FailureByModelItem(
                    model=row.model_name or "Unknown",
                    total_traces=total,
                    failures=failures,
                    failure_rate=failure_rate,
                    top_failure_mode=None,
                )
            )

    by_model.sort(key=lambda x: x.failure_rate, reverse=True)

    # 4. Generate insights
    insights = []

    # Overall failure rate
    overall_rate = round((total_failures / total_traces) * 100, 1) if total_traces > 0 else 0

    # Compare with previous period
    prev_failures = (
        db.query(func.count(Trace.id))
        .filter(
            Trace.start_time >= prev_start,
            Trace.start_time < start_date,
            Trace.status == "fail",
        )
        .scalar()
        or 0
    )
    prev_total = (
        db.query(func.count(Trace.id))
        .filter(Trace.start_time >= prev_start, Trace.start_time < start_date)
        .scalar()
        or 0
    )
    prev_rate = round((prev_failures / prev_total) * 100, 1) if prev_total > 0 else 0

    # Failure rate insight
    if overall_rate > 10:
        insights.append(
            FailureInsight(
                type="danger",
                title="High Failure Rate",
                description=f"Current failure rate is {overall_rate}%, which is above the acceptable threshold.",
                metric_value=f"{overall_rate}%",
                recommendation="Investigate the top failure modes and prioritize fixes.",
            )
        )
    elif overall_rate > 5:
        insights.append(
            FailureInsight(
                type="warning",
                title="Elevated Failure Rate",
                description=f"Failure rate is {overall_rate}%, which requires attention.",
                metric_value=f"{overall_rate}%",
                recommendation="Monitor closely and address recurring issues.",
            )
        )
    else:
        insights.append(
            FailureInsight(
                type="success",
                title="Healthy Failure Rate",
                description=f"Failure rate of {overall_rate}% is within acceptable range.",
                metric_value=f"{overall_rate}%",
                recommendation="Maintain current practices and continue monitoring.",
            )
        )

    # Trend insight
    if prev_rate > 0:
        rate_change = overall_rate - prev_rate
        if rate_change > 2:
            insights.append(
                FailureInsight(
                    type="danger",
                    title="Failure Rate Increasing",
                    description=f"Failure rate increased by {rate_change:.1f}% compared to previous period.",
                    metric_value=f"+{rate_change:.1f}%",
                    recommendation="Identify recent changes that may have caused this increase.",
                )
            )
        elif rate_change < -2:
            insights.append(
                FailureInsight(
                    type="success",
                    title="Failure Rate Decreasing",
                    description=f"Failure rate decreased by {abs(rate_change):.1f}% compared to previous period.",
                    metric_value=f"{rate_change:.1f}%",
                    recommendation="Good progress! Document what changes helped.",
                )
            )

    # Top failure mode insight
    if modes:
        top_mode = modes[0]
        if top_mode.percentage > 40:
            insights.append(
                FailureInsight(
                    type="warning",
                    title="Dominant Failure Mode",
                    description=f"'{top_mode.name}' accounts for {top_mode.percentage}% of all failures.",
                    metric_value=f"{top_mode.count} occurrences",
                    recommendation=f"Focus improvement efforts on reducing '{top_mode.name}' failures.",
                )
            )

    # Model-specific insight
    if by_model:
        worst_model = by_model[0]
        if worst_model.failure_rate > 15:
            insights.append(
                FailureInsight(
                    type="warning",
                    title="Model Performance Issue",
                    description=f"Model '{worst_model.model}' has a {worst_model.failure_rate}% failure rate.",
                    metric_value=f"{worst_model.failures} failures",
                    recommendation="Consider switching to a more reliable model or investigating configuration issues.",
                )
            )

    # Summary
    summary = {
        "total_traces": total_traces,
        "total_failures": total_failures,
        "failure_rate": overall_rate,
        "prev_failure_rate": prev_rate,
        "rate_change": round(overall_rate - prev_rate, 1) if prev_rate > 0 else 0,
        "unique_failure_modes": len(modes),
        "top_failure_mode": modes[0].name if modes else None,
    }

    return FailureAnalyticsResponse(
        modes=modes,
        trends=trends,
        by_model=by_model,
        insights=insights,
        summary=summary,
    )
