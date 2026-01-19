"""Models API routes."""
from fastapi import APIRouter
from typing import List

from app.schemas import ModelStat

router = APIRouter(tags=["models"])


from app.database import get_db
from app.models import Span
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from fastapi import Depends

@router.get("/models", response_model=List[ModelStat])
@router.get("/v1/models", response_model=List[ModelStat])
def get_models(db: Session = Depends(get_db)):
    """
    Get aggregated model statistics from Spans.
    """
    try:
        # Aggregate data from Spans where type='llm' and model is set
        results = db.query(
            Span.model,
            func.count(Span.id).label("requests"),
            # Database agnostic way to get seconds (for Postgres use extract epoch)
            func.avg(
                func.extract('epoch', Span.end_time) - func.extract('epoch', Span.start_time)
            ).label("avg_latency_seconds"),
            func.sum(Span.cost).label("total_cost")
        ).filter(
            Span.span_type == "llm",
            Span.model != None
        ).group_by(Span.model).all()
        
        stats = []
        for i, row in enumerate(results):
            model_name = row.model
            req_count = row.requests
            # We now get seconds directly
            avg_latency_sec = row.avg_latency_seconds or 0
            cost = row.total_cost or 0.0
            
            # Format for UI
            requests_str = f"{req_count/1000:.1f}K" if req_count > 1000 else str(req_count)
            latency_str = f"{avg_latency_sec:.2f}s"
            cost_str = f"${cost:.4f}"
            
            stats.append(ModelStat(
                id=i,
                name=str(model_name),
                status="active", # dynamic status not yet implemented
                accuracy=0.0, # Span doesn't inherently have accuracy unless linked to eval
                latency=latency_str,
                cost=cost_str,
                requests=requests_str
            ))
            
        return stats
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise e
