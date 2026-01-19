"""Evaluations API routes."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import case, desc, func
from typing import List, Optional

from app.database import get_db
from app.models import Trace
from pydantic import BaseModel

router = APIRouter(tags=["evaluations"])


class EvaluationStat(BaseModel):
    id: str
    name: str
    score: float
    trend: str
    pass_rate: float
    count: int

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
        # Group by Agent Name
        # We want: Name, Avg Score, Pass Rate
        
        results = db.query(
            Trace.name,
            func.count(Trace.id).label("total"),
            func.avg(Trace.score).label("avg_score"),
            func.sum(case((Trace.status == "pass", 1), else_=0)).label("passed")
        ).filter(
            Trace.name != None
        ).group_by(Trace.name).all()
        
        stats = []
        for i, row in enumerate(results):
            name = row.name
            total = row.total
            avg_score = round(row.avg_score or 0, 1)
            passed = row.passed or 0
            pass_rate = round((passed / total) * 100, 1)
            
            # Mock trend for now (requires time-series query)
            trend = "+2.5%" if avg_score > 80 else "-1.2%"
            
            stats.append(EvaluationStat(
                id=f"eval_{i}",
                name=str(name),
                score=float(avg_score),
                trend=str(trend),
                pass_rate=float(pass_rate),
                count=int(total)
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
