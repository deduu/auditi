"""Metrics API routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import Conversation, Trace
from app.schemas import MetricsResponse, MetricTrend

router = APIRouter(tags=["metrics"])


@router.get("/metrics", response_model=MetricsResponse)
@router.get("/v1/metrics", response_model=MetricsResponse)
def get_metrics(db: Session = Depends(get_db)):
    """Get aggregated dashboard metrics."""
    total_convs = db.query(Conversation).count()
    
    # Calculate Pass Rate
    total_traces = db.query(Trace).filter(
        Trace.status.in_(["pass", "fail"])
    ).count()
    pass_traces = db.query(Trace).filter(Trace.status == "pass").count()
    pass_rate = (pass_traces / total_traces * 100) if total_traces > 0 else 0
    
    # Avg Score
    avg_score = db.query(func.avg(Trace.score)).filter(
        Trace.score != None
    ).scalar() or 0
    
    # Avg Latency
    avg_latency = db.query(func.avg(Trace.latency)).filter(
        Trace.latency != None
    ).scalar() or 0

    return MetricsResponse(
        totalConversations=total_convs,
        passRate=round(pass_rate, 1),
        avgScore=round(float(avg_score), 1),
        avgLatencyMs=round(float(avg_latency), 2),
        trends={
            "conversations": MetricTrend(value=5, direction="up"),
            "passRate": MetricTrend(value=2, direction="up"),
            "score": MetricTrend(value=0.5, direction="up"),
            "latency": MetricTrend(value=-0.2, direction="down")
        }
    )
