# Copyright (c) 2026 Auditi Contributors
#
# MIT License
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

"""Trace ingestion API routes."""

from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy import desc, cast, String, or_
from typing import List

from app.database import get_db
from app.dependencies import get_current_user, validate_api_key
from app.models import Conversation, Trace, Span
from app.models.api_key import APIKey
from app.models.user import User
from app.schemas import TraceIngest
from app.services.eval_worker import enqueue_evaluation

router = APIRouter(tags=["traces"])


@router.post("/ingest")
@router.post("/v1/ingest")
def ingest_trace(trace_data: TraceIngest, db: Session = Depends(get_db), _api_key: APIKey = Depends(validate_api_key)):
    """
    Ingest a trace with spans and evaluation data.
    Creates conversation if it doesn't exist.

    If no evaluation is provided, the trace is saved with status='pending'
    and queued for async LLM-based evaluation.
    """
    # 1. Handle Conversation (concurrent-safe)
    if trace_data.conversation_id:
        conversation = (
            db.query(Conversation)
            .filter(Conversation.id == str(trace_data.conversation_id))
            .first()
        )
        if not conversation:
            try:
                conversation = Conversation(
                    id=str(trace_data.conversation_id), user_id=trace_data.user_id
                )
                db.add(conversation)
                db.flush()
            except IntegrityError:
                db.rollback()
                conversation = (
                    db.query(Conversation)
                    .filter(Conversation.id == str(trace_data.conversation_id))
                    .first()
                )

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
            processing_time=span.processing_time
            or (
                (span.end_time - span.start_time).total_seconds()
                if span.end_time and span.start_time
                else None
            ),
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

import csv
import io
from datetime import datetime as dt_module

from sqlalchemy import desc
from typing import List, Optional
from fastapi import HTTPException, Query
from fastapi.responses import StreamingResponse
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


@router.get("/traces/export")
@router.get("/v1/traces/export")
def export_traces(
    status: Optional[str] = None,
    trace_type: Optional[str] = None,
    model: Optional[str] = None,
    standalone_only: bool = False,
    exclude_ask_auditi: bool = True,
    ask_auditi_only: bool = False,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Export all matching traces as CSV with full (non-truncated) content."""
    query = db.query(Trace)

    if ask_auditi_only:
        query = query.filter(cast(Trace.tags, String).like('%"ask_auditi"%'))
    elif exclude_ask_auditi:
        query = query.filter(~cast(Trace.tags, String).like('%"ask_auditi"%'))

    if standalone_only:
        query = query.filter(cast(Trace.tags, String).like('%"standalone"%'))
    if status and status != "all":
        if status == "pending":
            query = query.filter((Trace.status == "pending") | (Trace.status.is_(None)))
        else:
            query = query.filter(Trace.status == status)
    if trace_type and trace_type != "all":
        query = query.filter(Trace.spans.any(Span.span_type == trace_type))
    if model and model != "all":
        query = query.filter(Trace.model_name == model)
    if date_from:
        query = query.filter(Trace.start_time >= datetime.fromisoformat(date_from))
    if date_to:
        query = query.filter(Trace.start_time < datetime.fromisoformat(date_to))

    traces = query.order_by(desc(Trace.start_time)).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Name", "Status", "Score", "Model", "Latency_ms",
        "Tokens", "Cost", "UserInput", "AssistantOutput",
        "Tags", "EvalReason", "FailureMode", "StartTime",
    ])

    for t in traces:
        latency_ms = 0.0
        if t.latency:
            latency_ms = t.latency * 1000
        elif t.end_time and t.start_time:
            latency_ms = (t.end_time - t.start_time).total_seconds() * 1000

        writer.writerow([
            t.id,
            t.name or "",
            t.status or "pending",
            t.score if t.score is not None else "",
            t.model_name or "",
            round(latency_ms, 2),
            t.total_tokens or 0,
            t.cost or 0.0,
            t.user_input or "",
            t.assistant_output or "",
            "; ".join(t.tags) if t.tags else "",
            t.eval_reason or "",
            t.failure_mode or "",
            t.start_time.isoformat() if t.start_time else "",
        ])

    output.seek(0)
    timestamp = datetime.now().strftime("%Y-%m-%d")
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="traces_export_{timestamp}.csv"'
        },
    )


@router.get("/traces", response_model=List[TraceSummary])
@router.get("/v1/traces", response_model=List[TraceSummary])
def get_traces(
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    trace_type: Optional[str] = None,
    model: Optional[str] = None,
    name: Optional[str] = None,
    standalone_only: bool = False,
    exclude_ask_auditi: bool = True,
    ask_auditi_only: bool = False,
    search: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """
    Get paginated list of traces (flattened view).
    Supports filtering by status, model, etc.

    Args:
        standalone_only: If True, returns only traces NOT linked to a conversation.
    """
    query = db.query(Trace)

    # Ask Auditi self-trace filtering
    if ask_auditi_only:
        query = query.filter(cast(Trace.tags, String).like('%"ask_auditi"%'))
    elif exclude_ask_auditi:
        query = query.filter(~cast(Trace.tags, String).like('%"ask_auditi"%'))

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                Trace.name.ilike(pattern),
                Trace.user_input.ilike(pattern),
                Trace.assistant_output.ilike(pattern),
                Trace.eval_reason.ilike(pattern),
            )
        )

    if standalone_only:
        # Filter strictly for traces marked as standalone (vs just no conversation_id)
        # Using string matching for robustness across JSON types (JSON vs JSONB)
        query = query.filter(cast(Trace.tags, String).like('%"standalone"%'))

    if status and status != "all":
        if status == "pending":
            # Pending traces have status='pending' OR status=None
            query = query.filter((Trace.status == "pending") | (Trace.status.is_(None)))
        else:
            query = query.filter(Trace.status == status)

    if trace_type and trace_type != "all":
        # Filter traces that contain at least one span of the specified type
        query = query.filter(Trace.spans.any(Span.span_type == trace_type))

    if model and model != "all":
        query = query.filter(Trace.model_name == model)

    if name:
        query = query.filter(Trace.name == name)

    if date_from:
        query = query.filter(Trace.start_time >= datetime.fromisoformat(date_from))
    if date_to:
        query = query.filter(Trace.start_time < datetime.fromisoformat(date_to))

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
def get_trace_detail(trace_id: str, db: Session = Depends(get_db), _current_user: User = Depends(get_current_user)):
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
        evalMetadata=t.eval_metadata,
        spans=spans,
    )


@router.delete("/traces")
@router.delete("/v1/traces")
def delete_traces(
    ids: List[str] = Query(..., description="List of trace IDs to delete"),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """
    Bulk delete traces.
    Also deletes associated spans.
    """
    if not ids:
        return {"status": "success", "count": 0}

    # 1. Find traces
    traces = db.query(Trace).filter(Trace.id.in_(ids)).all()
    if not traces:
        return {"status": "success", "count": 0}

    found_ids = [t.id for t in traces]

    # 2. Delete associated spans
    db.query(Span).filter(Span.trace_id.in_(found_ids)).delete(
        synchronize_session=False
    )

    # 3. Delete traces
    db.query(Trace).filter(Trace.id.in_(found_ids)).delete(synchronize_session=False)

    db.commit()

    return {"status": "success", "count": len(traces)}
