"""Actions and Failure Modes API routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.database import get_db
from app.models import Trace
from app.schemas import ActionResponse, FailureModeStat

router = APIRouter(tags=["actions"])


@router.get("/actions", response_model=List[ActionResponse])
@router.get("/v1/actions", response_model=List[ActionResponse])
def get_actions():
    """Get list of recommended actions (mock data for now)."""
    return [
        ActionResponse(
            id=1, 
            title="Retrain Billing Knowledge", 
            description="High failure rate in billing Qs", 
            priority="high", 
            status="pending", 
            category="Accuracy"
        ),
        ActionResponse(
            id=2, 
            title="Optimizer Latency", 
            description="Slow response in search tool", 
            priority="medium", 
            status="pending", 
            category="Performance"
        )
    ]


@router.get("/failure-modes", response_model=List[FailureModeStat])
@router.get("/v1/failure-modes", response_model=List[FailureModeStat])
def get_failure_modes(db: Session = Depends(get_db)):
    """Get statistics on failure modes."""
    stats = db.query(
        Trace.failure_mode, 
        func.count(Trace.id)
    ).filter(
        Trace.failure_mode != None
    ).group_by(Trace.failure_mode).all()
    
    total_failures = sum(count for _, count in stats)
    
    return [
        FailureModeStat(
            id=idx,
            name=mode,
            count=count,
            percentage=round((count/total_failures)*100, 1) if total_failures else 0
        )
        for idx, (mode, count) in enumerate(stats)
    ]
