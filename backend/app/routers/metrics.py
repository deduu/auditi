from datetime import datetime, timedelta, timezone
from typing import List, Optional
import numpy as np
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.database import get_db
from app.models import Conversation, Trace
from app.schemas import MetricsResponse, MetricTrend, MetricDetail

router = APIRouter(tags=["metrics"])


def calculate_trend(
    current_value: float, previous_value: float, invert_direction: bool = False
) -> MetricTrend:
    if previous_value == 0:
        return MetricTrend(value=0, direction="stable")

    change_pct = ((current_value - previous_value) / previous_value) * 100
    direction = "stable"

    # Standard logic: increase is "up" (good/neutral), decrease is "down"
    # Inverted logic (e.g. latency): increase is "down" (bad), decrease is "up" (good)
    if change_pct > 0.5:
        direction = "down" if invert_direction else "up"
    elif change_pct < -0.5:
        direction = "up" if invert_direction else "down"

    return MetricTrend(value=round(change_pct, 1), direction=direction)


def calculate_percentiles(values: List[float]) -> dict:
    if not values:
        return {"p50": 0, "p90": 0, "p95": 0, "p99": 0}

    return {
        "p50": round(float(np.percentile(values, 50)), 2),
        "p90": round(float(np.percentile(values, 90)), 2),
        "p95": round(float(np.percentile(values, 95)), 2),
        "p99": round(float(np.percentile(values, 99)), 2),
    }


def get_date_range(time_range: str):
    now = datetime.now(timezone.utc)
    if time_range == "24h":
        start_date = now - timedelta(hours=24)
        prev_start_date = now - timedelta(hours=48)
    elif time_range == "30d":
        start_date = now - timedelta(days=30)
        prev_start_date = now - timedelta(days=60)
    else:  # default 7d
        start_date = now - timedelta(days=7)
        prev_start_date = now - timedelta(days=14)

    return start_date, prev_start_date, now


@router.get("/metrics", response_model=MetricsResponse)
@router.get("/v1/metrics", response_model=MetricsResponse)
def get_metrics(
    timeRange: str = Query("7d"),
    model: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Get aggregated dashboard metrics with percentiles and trends."""
    current_start, previous_start, now = get_date_range(timeRange)
    previous_end = current_start

    # Base filters for Traces
    base_filter = [Trace.start_time >= current_start]
    prev_filter = [Trace.start_time >= previous_start, Trace.start_time < previous_end]

    if model:
        base_filter.append(Trace.model_name == model)
        prev_filter.append(Trace.model_name == model)

    # We don't apply status filter to pass_rate calculation itself usually,
    # but if the user strictly wants "metrics for failed traces", maybe we should.
    # For now, let's treat status filter as a global filter if provided.
    if status:
        base_filter.append(Trace.status == status)
        prev_filter.append(Trace.status == status)

    # Helper to fetch data
    def fetch_trace_data(filters):
        query = db.query(Trace.status, Trace.score, Trace.latency).filter(
            and_(*filters)
        )
        return query.all()

    current_data = fetch_trace_data(base_filter)
    prev_data = fetch_trace_data(prev_filter)

    # --- Calculations Helper ---
    def process_metrics(data):
        total = len(data)
        passes = sum(1 for d in data if d.status == "pass")
        scores = [d.score for d in data if d.score is not None]
        latencies = [d.latency for d in data if d.latency is not None]

        pass_rate = (passes / total * 100) if total > 0 else 0
        avg_score = float(np.mean(scores)) if scores else 0
        avg_latency = float(np.mean(latencies)) if latencies else 0

        return {
            "total": total,
            "pass_rate": pass_rate,
            "avg_score": avg_score,
            "avg_latency": avg_latency,
            "scores": scores,
            "latencies": latencies,
        }

    curr = process_metrics(current_data)
    prev = process_metrics(prev_data)

    # Calculate Percentiles for Current Period
    score_pct = calculate_percentiles(curr["scores"])
    latency_pct = calculate_percentiles(curr["latencies"])

    # Conversations Count (current and previous periods)
    conv_base_filter = [Conversation.created_at >= current_start]
    conv_prev_filter = [
        Conversation.created_at >= previous_start,
        Conversation.created_at < previous_end,
    ]

    query = db.query(Conversation).filter(and_(*conv_base_filter))
    prev_query = db.query(Conversation).filter(and_(*conv_prev_filter))

    if status:  # Conversation status filtering based on traces
        query = query.filter(Conversation.traces.any(Trace.status == status))
        prev_query = prev_query.filter(Conversation.traces.any(Trace.status == status))

    total_convs = query.count()
    prev_total_convs = prev_query.count()

    # Calculate Trends
    trends = {
        "conversations": calculate_trend(total_convs, prev_total_convs),
        "passRate": calculate_trend(curr["pass_rate"], prev["pass_rate"]),
        "score": calculate_trend(curr["avg_score"], prev["avg_score"]),
        "latency": calculate_trend(
            curr["avg_latency"], prev["avg_latency"], invert_direction=True
        ),
    }

    # Construct Response
    return MetricsResponse(
        totalConversations=total_convs,
        totalRequests=curr["total"],
        passRate=round(curr["pass_rate"], 1),
        avgScore=MetricDetail(
            value=round(curr["avg_score"], 1), **score_pct, trend=trends["score"]
        ),
        avgLatencyMs=MetricDetail(
            value=round(curr["avg_latency"], 2), **latency_pct, trend=trends["latency"]
        ),
        trends={
            "conversations": trends["conversations"],
            "passRate": trends["passRate"],
            "score": trends["score"],
            "latency": trends["latency"],
        },
    )
