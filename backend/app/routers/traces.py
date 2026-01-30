"""Trace ingestion API routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc, cast, String

from app.database import get_db
from app.models import Conversation, Trace, Span
from app.schemas import TraceIngest
from app.services.eval_worker import enqueue_evaluation

router = APIRouter(tags=["traces"])


@router.post("/ingest")
@router.post("/v1/ingest")
def ingest_trace(trace_data: TraceIngest, db: Session = Depends(get_db)):
    """
    Ingest a trace with spans and evaluation data.
    Creates conversation if it doesn't exist.

    If no evaluation is provided, the trace is saved with status='pending'
    and queued for async LLM-based evaluation.
    """
    # 1. Handle Conversation
    if trace_data.conversation_id:
        conversation = (
            db.query(Conversation)
            .filter(Conversation.id == str(trace_data.conversation_id))
            .first()
        )
        if not conversation:
            conversation = Conversation(
                id=str(trace_data.conversation_id), user_id=trace_data.user_id
            )
            db.add(conversation)

    # 2. Determine initial status
    # If SDK provides evaluation, use it. Otherwise, mark as 'pending' for async eval.
    has_evaluation = trace_data.evaluation is not None
    initial_status = trace_data.evaluation.status if has_evaluation else "pending"
    initial_score = trace_data.evaluation.score if has_evaluation else None
    initial_failure_mode = (
        trace_data.evaluation.failure_mode if has_evaluation else None
    )
    initial_eval_reason = trace_data.evaluation.reason if has_evaluation else None

    # 3. Derive model_name from first LLM span if not provided at trace level
    resolved_model_name = trace_data.model_name
    if not resolved_model_name:
        for span in trace_data.spans:
            if span.span_type == "llm" and span.model:
                resolved_model_name = span.model
                break

    # 4. Aggregate tokens/cost from spans if not provided on trace
    resolved_total_tokens = trace_data.total_tokens or 0
    resolved_cost = trace_data.cost or 0.0
    if resolved_total_tokens == 0:
        for span in trace_data.spans:
            if span.tokens:
                resolved_total_tokens += span.tokens
            if span.cost:
                resolved_cost += span.cost

    # 5. Create Trace with all fields
    db_trace = Trace(
        id=str(trace_data.id),
        conversation_id=(
            str(trace_data.conversation_id) if trace_data.conversation_id else None
        ),
        user_id=trace_data.user_id,
        start_time=trace_data.start_time,
        end_time=trace_data.end_time,
        user_input=trace_data.user_input,
        assistant_output=trace_data.assistant_output,
        latency=(
            (trace_data.end_time - trace_data.start_time).total_seconds()
            if trace_data.end_time and trace_data.start_time
            else 0
        ),
        name=trace_data.name,
        model_name=resolved_model_name,
        total_tokens=resolved_total_tokens,
        cost=resolved_cost,
        tags=trace_data.tags if trace_data.tags else None,
        status=initial_status,
        score=initial_score,
        failure_mode=initial_failure_mode,
        eval_reason=initial_eval_reason,
    )
    db.add(db_trace)

    # 6. Create Spans
    for span in trace_data.spans:
        db_span = Span(
            id=str(span.id),
            trace_id=str(trace_data.id),
            parent_id=str(span.parent_id) if span.parent_id else None,
            name=span.name,
            span_type=span.span_type,
            model=span.model,
            start_time=span.start_time,
            end_time=span.end_time,
            inputs=span.inputs,
            outputs=span.outputs,
            input_tokens=span.input_tokens,
            output_tokens=span.output_tokens,
            tokens=span.tokens,
            cost=span.cost,
            status=span.status,
            error=span.error,
        )
        db.add(db_span)

    db.commit()

    # 7. Enqueue for async evaluation ONLY if auto-eval is enabled
    # Manual batch evaluation (via Execute Evaluation button) bypasses this check
    evaluation_enqueued = False
    if not has_evaluation:
        # Check if auto-evaluation is enabled
        from app.models.evaluator import EvaluatorSetupState

        setup_state = (
            db.query(EvaluatorSetupState)
            .filter(EvaluatorSetupState.id == "default")
            .first()
        )

        if setup_state and setup_state.auto_eval_enabled:
            enqueue_evaluation(str(trace_data.id), api_key=None)
            evaluation_enqueued = True

    return {
        "status": "success",
        "id": str(trace_data.id),
        "evaluation_pending": not has_evaluation,
        "auto_evaluation_enqueued": evaluation_enqueued,
    }


# ============================================================================
# TRACE RETRIEVAL ENDPOINTS
# ============================================================================

from sqlalchemy import desc
from typing import List, Optional
from fastapi import HTTPException, Query
from app.schemas.trace import TraceSummary, TraceDetail
from app.schemas.span import SpanDetail, SpanEvaluation


def compute_span_duration_ms(span: Span) -> float:
    """Compute duration in milliseconds for a span."""
    if span.end_time and span.start_time:
        duration_seconds = (span.end_time - span.start_time).total_seconds()
        return duration_seconds * 1000
    elif span.processing_time:
        return span.processing_time * 1000
    return 0.0


def build_span_detail(span: Span) -> SpanDetail:
    """Build SpanDetail from Span model."""
    evaluation = None
    if any(
        [
            span.eval_relevant is not None,
            span.eval_quality_score is not None,
            span.eval_issues is not None,
            span.eval_reasoning is not None,
        ]
    ):
        evaluation = SpanEvaluation(
            evalRelevant=span.eval_relevant,
            evalQualityScore=span.eval_quality_score,
            evalIssues=span.eval_issues or [],
            evalReasoning=span.eval_reasoning,
        )

    return SpanDetail(
        id=str(span.id),
        spanType=span.span_type,
        name=span.name,
        model=span.model,
        startTime=span.start_time,
        endTime=span.end_time,
        durationMs=compute_span_duration_ms(span),
        inputs=span.inputs,
        outputs=span.outputs,
        inputTokens=span.input_tokens or 0,
        outputTokens=span.output_tokens or 0,
        tokens=span.tokens or 0,
        cost=span.cost or 0.0,
        status=span.status or "ok",
        error=span.error,
        evaluation=evaluation,
    )


@router.get("/traces", response_model=List[TraceSummary])
@router.get("/v1/traces", response_model=List[TraceSummary])
def get_traces(
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    trace_type: Optional[str] = None,
    model: Optional[str] = None,
    standalone_only: bool = False,
    db: Session = Depends(get_db),
):
    """
    Get paginated list of traces (flattened view).
    Supports filtering by status, model, etc.

    Args:
        standalone_only: If True, returns only traces NOT linked to a conversation.
    """
    query = db.query(Trace)

    if standalone_only:
        # Filter strictly for traces marked as standalone (vs just no conversation_id)
        # Using string matching for robustness across JSON types (JSON vs JSONB)
        query = query.filter(cast(Trace.tags, String).like('%"standalone"%'))

    if status and status != "all":
        query = query.filter(Trace.status == status)

    if trace_type and trace_type != "all":
        # Filter traces that contain at least one span of the specified type
        query = query.filter(Trace.spans.any(Span.span_type == trace_type))

    if model and model != "all":
        query = query.filter(Trace.model_name == model)

    # Order by start_time desc
    traces = query.order_by(desc(Trace.start_time)).offset(skip).limit(limit).all()

    results = []
    for t in traces:
        # Compute latency
        latency_ms = 0.0
        if t.latency:
            latency_ms = t.latency * 1000
        elif t.end_time and t.start_time:
            latency_ms = (t.end_time - t.start_time).total_seconds() * 1000

        results.append(
            TraceSummary(
                id=t.id,
                name=t.name,
                status=t.status or "pending",
                score=t.score,
                startTime=t.start_time,
                endTime=t.end_time,
                latencyMs=latency_ms,
                modelName=t.model_name,
                totalTokens=t.total_tokens or 0,
                cost=t.cost or 0.0,
                userInputPreview=t.user_input[:100] if t.user_input else "",
                assistantOutputPreview=(
                    t.assistant_output[:100] if t.assistant_output else ""
                ),
                tags=t.tags or [],
                conversationId=t.conversation_id,
                userId=t.user_id,
            )
        )
    return results


@router.get("/traces/{trace_id}", response_model=TraceDetail)
@router.get("/v1/traces/{trace_id}", response_model=TraceDetail)
def get_trace_detail(trace_id: str, db: Session = Depends(get_db)):
    """Get detailed view of a single trace including spans."""
    t = db.query(Trace).filter(Trace.id == trace_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Trace not found")

    # Compute latency
    latency_ms = 0.0
    if t.latency:
        latency_ms = t.latency * 1000
    elif t.end_time and t.start_time:
        latency_ms = (t.end_time - t.start_time).total_seconds() * 1000

    # Build spans
    sorted_spans = sorted(
        t.spans, key=lambda s: (s.start_time, s.end_time or s.start_time)
    )
    spans = [build_span_detail(span) for span in sorted_spans]

    return TraceDetail(
        id=t.id,
        name=t.name,
        status=t.status or "pending",
        score=t.score,
        startTime=t.start_time,
        endTime=t.end_time,
        latencyMs=latency_ms,
        modelName=t.model_name,
        totalTokens=t.total_tokens or 0,
        cost=t.cost or 0.0,
        userInputPreview=t.user_input[:100] if t.user_input else "",
        assistantOutputPreview=t.assistant_output[:100] if t.assistant_output else "",
        tags=t.tags or [],
        conversationId=t.conversation_id,
        userId=t.user_id,
        # Detail fields
        userInput=t.user_input or "",
        assistantOutput=t.assistant_output,
        failureMode=t.failure_mode,
        evalReason=t.eval_reason,
        spans=spans,
    )
