"""Evaluations API routes."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import case, desc, func
from typing import List, Optional

from app.database import get_db
from app.models import Trace
from pydantic import BaseModel

router = APIRouter(tags=["evaluations"])


from datetime import datetime, timedelta

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


@router.get("/evaluations", response_model=EvaluationsResponse)
def get_evaluations(
    time_range: str = Query("7d", alias="timeRange"),
    db: Session = Depends(get_db)
):
    """
    Get aggregated evaluation statistics grouped by Agent/Task name.
    """
    try:
        # 1. Parse Time Range
        now = datetime.utcnow()
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
        current_stats = db.query(
            Trace.name,
            func.count(Trace.id).label("total"),
            func.avg(Trace.score).label("avg_score"),
            func.sum(case((Trace.status == "pass", 1), else_=0)).label("passed"),
            func.avg(Trace.latency).label("avg_latency"),
            func.sum(Trace.cost).label("total_cost"),
            func.sum(Trace.total_tokens).label("total_tokens")
        ).filter(
            Trace.name != None,
            Trace.start_time >= start_date
        ).group_by(Trace.name).all()
        
        # 3. Query Previous Period Stats (for Trend)
        prev_stats_result = db.query(
            Trace.name,
            func.avg(Trace.score).label("avg_score")
        ).filter(
            Trace.name != None,
            Trace.start_time >= prev_start_date,
            Trace.start_time < start_date
        ).group_by(Trace.name).all()
        
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
            
            stats.append(EvaluationStat(
                id=f"eval_{i}",
                name=str(name),
                score=float(avg_score),
                trend=str(trend),
                pass_rate=float(pass_rate),
                count=int(total),
                avg_latency=float(avg_latency),
                total_cost=float(total_cost),
                total_tokens=total_tokens
            ))
            
        return EvaluationsResponse(evaluations=stats)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise e


@router.get("/failure-modes", response_model=List[FailureModeStat])
def get_failure_modes(
    time_range: str = Query("7d", alias="timeRange"),
    db: Session = Depends(get_db)
):
    """
    Get statistics on failure modes.
    """
    # 1. Get total failures
    total_failures = db.query(func.count(Trace.id)).filter(Trace.status == "fail").scalar() or 0
    
    if total_failures == 0:
        return []

    # 2. Group by failure_mode
    results = db.query(
        Trace.failure_mode,
        func.count(Trace.id).label("count")
    ).filter(
        Trace.status == "fail",
        Trace.failure_mode != None
    ).group_by(Trace.failure_mode).order_by(desc("count")).all()
    
    stats = []
    for i, row in enumerate(results):
        mode_name = row.failure_mode
        count = row.count
        percentage = round((count / total_failures) * 100, 1)
        
        stats.append(FailureModeStat(
            id=f"fm_{i}",
            name=mode_name,
            count=count,
            percentage=percentage
        ))
        
    return stats
