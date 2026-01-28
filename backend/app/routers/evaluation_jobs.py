"""
Evaluation jobs router - handles batch evaluation requests and job status.
"""

from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, or_, and_
import uuid

from app.database import get_db
from app.models import Trace, Span
from app.models.evaluator import Evaluator, EvaluatorSetupState
from app.models.llm_connection import LLMConnection

router = APIRouter(prefix="/evaluation-jobs", tags=["evaluation-jobs"])


# ============================================
# Schemas
# ============================================


class FilterParams(BaseModel):
    dateFrom: Optional[str] = None
    dateTo: Optional[str] = None
    models: Optional[List[str]] = []
    traceName: Optional[str] = None
    tags: Optional[List[str]] = []
    status: Optional[str] = "all"


class EvaluationJobCreate(BaseModel):
    evaluator_id: str
    target_type: str = "live"
    include_new: bool = True
    include_existing: bool = True
    sampling_rate: float = Field(1.0, ge=0, le=1)
    delay_seconds: int = Field(30, ge=0)
    filters: Optional[FilterParams] = None
    # Optional: specific trace IDs to evaluate (overrides query if provided)
    trace_ids: Optional[List[str]] = None


class EvaluationJobResponse(BaseModel):
    id: str
    evaluator_id: str
    status: str
    target_type: str
    include_new: bool
    include_existing: bool
    sampling_rate: float
    delay_seconds: int
    total_traces: int
    evaluated_count: int
    created_at: datetime
    completed_at: Optional[datetime] = None


class TracePreview(BaseModel):
    id: str
    name: Optional[str] = None
    user_input: Optional[str] = None
    assistant_output: Optional[str] = None
    start_time: datetime
    latency: Optional[float] = None
    total_tokens: Optional[int] = None
    status: Optional[str] = None


class TracePreviewResponse(BaseModel):
    traces: List[TracePreview]
    total: int


# In-memory job storage (in production, use database)
_evaluation_jobs = {}


# ============================================
# Trace Preview Endpoints
# ============================================


@router.get("/traces/preview", response_model=TracePreviewResponse)
def get_traces_preview(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    models: Optional[str] = None,
    name: Optional[str] = None,
    tags: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 10,
    db: Session = Depends(get_db),
):
    """Get preview of traces matching filters"""
    query = db.query(Trace)

    # Apply filters
    if date_from:
        try:
            dt = datetime.fromisoformat(date_from)
            query = query.filter(Trace.start_time >= dt)
        except:
            pass

    if date_to:
        try:
            dt = datetime.fromisoformat(date_to)
            query = query.filter(Trace.start_time <= dt)
        except:
            pass

    if name:
        query = query.filter(Trace.name.ilike(f"%{name}%"))

    if status and status != "all":
        if status == "success":
            query = query.filter(Trace.status == "pass")
        elif status == "error":
            query = query.filter(Trace.status == "fail")

    # Get total count
    total = query.count()

    # Get limited results
    traces = query.order_by(desc(Trace.start_time)).limit(limit).all()

    return TracePreviewResponse(
        traces=[
            TracePreview(
                id=str(t.id),
                name=t.name,
                user_input=t.user_input[:100] if t.user_input else None,
                assistant_output=(
                    t.assistant_output[:100] if t.assistant_output else None
                ),
                start_time=t.start_time,
                latency=t.latency,
                total_tokens=t.total_tokens,
                status=t.status,
            )
            for t in traces
        ],
        total=total,
    )


@router.get("/traces/models")
def get_available_models(db: Session = Depends(get_db)):
    """Get list of unique models from traces"""
    # Get models from spans
    models = db.query(Span.model).filter(Span.model.isnot(None)).distinct().all()
    return [m[0] for m in models if m[0]]


@router.get("/traces/tags")
def get_available_tags(db: Session = Depends(get_db)):
    """Get list of unique tags from traces"""
    # For now return empty - can implement when tags are added to trace model
    return []


# ============================================
# Evaluation Job Endpoints
# ============================================


@router.post("", response_model=EvaluationJobResponse)
async def create_evaluation_job(
    data: EvaluationJobCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Create and start a batch evaluation job"""

    # Validate evaluator exists
    evaluator = db.query(Evaluator).filter(Evaluator.id == data.evaluator_id).first()
    if not evaluator:
        raise HTTPException(status_code=404, detail="Evaluator not found")

    # Check for valid connection
    connection = (
        db.query(LLMConnection)
        .filter(
            LLMConnection.is_default == True,
            LLMConnection.api_key_encrypted.isnot(None),
        )
        .first()
    )

    if not connection:
        raise HTTPException(
            status_code=400, detail="No valid LLM connection configured"
        )

    # Determine which traces to evaluate:
    # 1. If trace_ids provided by frontend (user selected specific traces), use those
    # 2. Otherwise, build query from filters and apply sampling

    if data.trace_ids and len(data.trace_ids) > 0:
        # Use explicitly selected trace IDs from frontend
        trace_ids_to_evaluate = data.trace_ids
        total_traces = len(trace_ids_to_evaluate)
        print(f"[EVAL JOB] Using {total_traces} explicitly selected traces")
    else:
        # Build query for matching traces
        query = db.query(Trace)

        if data.filters:
            if data.filters.dateFrom:
                try:
                    dt = datetime.fromisoformat(data.filters.dateFrom)
                    query = query.filter(Trace.start_time >= dt)
                except:
                    pass

            if data.filters.dateTo:
                try:
                    dt = datetime.fromisoformat(data.filters.dateTo)
                    query = query.filter(Trace.start_time <= dt)
                except:
                    pass

            if data.filters.traceName:
                query = query.filter(Trace.name.ilike(f"%{data.filters.traceName}%"))

            if data.filters.status and data.filters.status != "all":
                if data.filters.status == "success":
                    query = query.filter(Trace.status == "pass")
                elif data.filters.status == "error":
                    query = query.filter(Trace.status == "fail")

        total_traces = query.count()

        # Apply sampling
        import random

        sampled_count = int(total_traces * data.sampling_rate)
        traces = query.limit(sampled_count).all()
        trace_ids_to_evaluate = [str(t.id) for t in traces]
        print(f"[EVAL JOB] Queried {total_traces} traces, sampled {sampled_count}")

    # Create job
    job_id = str(uuid.uuid4())
    job = {
        "id": job_id,
        "evaluator_id": data.evaluator_id,
        "status": "pending",
        "target_type": data.target_type,
        "include_new": data.include_new,
        "include_existing": data.include_existing,
        "sampling_rate": data.sampling_rate,
        "delay_seconds": data.delay_seconds,
        "total_traces": len(trace_ids_to_evaluate),
        "evaluated_count": 0,
        "created_at": datetime.utcnow(),
        "completed_at": None,
        "trace_ids": trace_ids_to_evaluate,
    }

    _evaluation_jobs[job_id] = job

    # Start background evaluation (pass only job_id, not db session)
    background_tasks.add_task(run_batch_evaluation, job_id)

    return EvaluationJobResponse(**{k: v for k, v in job.items() if k != "trace_ids"})


@router.get("/{job_id}", response_model=EvaluationJobResponse)
def get_evaluation_job(job_id: str):
    """Get status of an evaluation job"""
    if job_id not in _evaluation_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = _evaluation_jobs[job_id]
    return EvaluationJobResponse(**{k: v for k, v in job.items() if k != "trace_ids"})


# ============================================
# Background Evaluation Task
# ============================================


def run_batch_evaluation(job_id: str):
    """Run batch evaluation - enqueues traces for the eval worker to process"""
    from app.services.eval_worker import enqueue_evaluation

    print(f"\n[BATCH EVAL] Starting batch evaluation job: {job_id}")

    job = _evaluation_jobs.get(job_id)
    if not job:
        print(f"[BATCH EVAL] Job {job_id} not found in memory")
        return

    print(f"[BATCH EVAL] Found job with {len(job['trace_ids'])} traces to evaluate")
    job["status"] = "running"

    try:
        # Enqueue each trace for evaluation
        for i, trace_id in enumerate(job["trace_ids"]):
            print(
                f"[BATCH EVAL] Enqueueing trace {i+1}/{len(job['trace_ids'])}: {trace_id}"
            )
            enqueue_evaluation(trace_id)
            job["evaluated_count"] += 1

        job["status"] = "completed"
        job["completed_at"] = datetime.utcnow()
        print(
            f"[BATCH EVAL] ✓ Job {job_id} completed - enqueued {job['evaluated_count']} traces"
        )

    except Exception as e:
        job["status"] = "failed"
        job["completed_at"] = datetime.utcnow()
        print(f"[BATCH EVAL] ✗ Error in job {job_id}: {e}")
        import traceback

        traceback.print_exc()
