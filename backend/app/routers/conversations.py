"""Conversations API routes with proper schema validation."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from datetime import datetime, timedelta

from app.database import get_db
from app.models import Conversation, Trace, Span
from app.schemas import (
    ConversationSummary,
    ConversationDetail,
    ConversationTurn,
    UserMessage,
    AssistantMessage,
    AssistantEvaluation,
    SpanDetail,
    SpanEvaluation,
)

router = APIRouter(tags=["conversations"])


def extract_models_from_spans(spans: List[Span]) -> List[str]:
    """Extract unique model names from spans."""
    models = set()
    for span in spans:
        if span.model:
            models.add(span.model)
    return sorted(list(models)) if models else ["Unknown"]


def compute_span_duration_ms(span: Span) -> float:
    """Compute duration in milliseconds for a span."""
    if span.end_time and span.start_time:
        duration_seconds = (span.end_time - span.start_time).total_seconds()
        return duration_seconds * 1000  # Convert to milliseconds
    elif span.processing_time:
        return span.processing_time * 1000  # Assume processing_time is in seconds
    return 0.0


def compute_trace_latency_ms(trace: Trace) -> float:
    """Compute latency in milliseconds for a trace."""
    if trace.latency:
        # Assume latency is stored in seconds
        return trace.latency * 1000
    elif trace.end_time and trace.start_time:
        duration_seconds = (trace.end_time - trace.start_time).total_seconds()
        return duration_seconds * 1000
    return 0.0


def build_span_detail(span: Span) -> SpanDetail:
    """Build SpanDetail from Span model."""
    # Build evaluation if exists
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


def build_conversation_turn(trace: Trace) -> ConversationTurn:
    """Build ConversationTurn from Trace model."""
    # Extract model from spans or fallback to trace model_name or default
    models = extract_models_from_spans(trace.spans)
    model = models[0] if models else (trace.model_name or "Unknown")

    # Build evaluation
    evaluation = AssistantEvaluation(
        status=trace.status or "pending",
        score=trace.score,
        failureMode=trace.failure_mode,
        reason=trace.eval_reason,
        # IMPORTANT: Return None (null) if not present, not "None" string
        recommendedAction=(
            trace.recommended_action if trace.recommended_action else None
        ),
    )

    # Build assistant message
    assistant = AssistantMessage(
        content=trace.assistant_output or "",
        model=model,
        latencyMs=compute_trace_latency_ms(trace),
        evaluation=evaluation,
    )

    # Build user message
    user = UserMessage(content=trace.user_input or "")

    # Build spans
    # Sort by start_time, then end_time (ensures longer running tasks appear after instant ones if started same time)
    sorted_spans = sorted(
        trace.spans, key=lambda s: (s.start_time, s.end_time or s.start_time)
    )
    spans = [build_span_detail(span) for span in sorted_spans]

    return ConversationTurn(
        id=str(trace.id), user=user, assistant=assistant, spans=spans
    )


@router.get("/conversations", response_model=List[ConversationSummary])
@router.get("/v1/conversations", response_model=List[ConversationSummary])
def get_conversations(
    skip: int = 0,
    limit: int = 20,
    status: Optional[str] = None,
    model: Optional[str] = None,
    range: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Get paginated list of conversations with aggregated stats."""
    query = db.query(Conversation)

    # Filter by range
    if range:
        now = datetime.utcnow()
        cutoff = None
        if range == "24h":
            cutoff = now - timedelta(hours=24)
        elif range == "7d":
            cutoff = now - timedelta(days=7)
        elif range == "30d":
            cutoff = now - timedelta(days=30)

        if cutoff:
            query = query.filter(Conversation.updated_at >= cutoff)

    # Filter by status
    if status and status != "all":
        query = query.filter(Conversation.traces.any(Trace.status == status))

    # Filter by model
    if model and model != "all":
        # Check both Trace.model_name and Span.model
        query = query.filter(
            Conversation.traces.any(
                (Trace.model_name == model)
                | (Trace.spans.any(Span.model.ilike(f"%{model}%")))
            )
        )

    convs = (
        query.order_by(desc(Conversation.updated_at)).offset(skip).limit(limit).all()
    )

    results = []
    for c in convs:
        # Aggregate stats per conversation
        traces = list(c.traces)
        pass_count = sum(1 for t in traces if t.status == "pass")
        fail_count = sum(1 for t in traces if t.status == "fail")
        scores = [t.score for t in traces if t.score is not None]
        avg_score = sum(scores) / len(scores) if scores else 0.0

        # Extract unique models from all spans
        all_spans = []
        for trace in traces:
            all_spans.extend(trace.spans)
        models = extract_models_from_spans(all_spans)

        # Calculate average latency in milliseconds
        latencies_ms = [compute_trace_latency_ms(t) for t in traces]
        avg_latency_ms = sum(latencies_ms) / len(latencies_ms) if latencies_ms else 0.0

        # Calculate total cost from all spans
        total_cost = sum(span.cost or 0.0 for span in all_spans)

        results.append(
            ConversationSummary(
                id=c.id,
                userId=c.user_id,
                startTime=c.created_at,
                totalTurns=len(traces),
                passCount=pass_count,
                failCount=fail_count,
                overallStatus=(
                    "fail" if fail_count > 0 else "pass" if pass_count > 0 else "review"
                ),
                models=models,
                avgScore=avg_score,
                avgLatencyMs=avg_latency_ms,
                totalCost=total_cost,
                objective=c.objective,
            )
        )
    return results


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
@router.get("/v1/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation_detail(conversation_id: str, db: Session = Depends(get_db)):
    """Get detailed view of a conversation including all turns and spans."""
    c = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Conversation not found")

    traces = list(c.traces)
    # Sort traces by start time
    traces.sort(key=lambda t: t.start_time)

    # Build turns
    turns = [build_conversation_turn(trace) for trace in traces]

    # Extract unique models
    all_spans = []
    for trace in traces:
        all_spans.extend(trace.spans)
    models = extract_models_from_spans(all_spans)

    # Calculate average score
    scores = [t.score for t in traces if t.score is not None]
    avg_score = sum(scores) / len(scores) if scores else 0.0

    return ConversationDetail(
        id=c.id,
        userId=c.user_id,
        startTime=c.created_at,
        updatedAt=c.updated_at,
        objective=c.objective,
        turns=turns,
        models=models,
        avgScore=avg_score,
    )
