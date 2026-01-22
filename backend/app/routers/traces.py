"""Trace ingestion API routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

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
        conversation = db.query(Conversation).filter(
            Conversation.id == str(trace_data.conversation_id)
        ).first()
        if not conversation:
            conversation = Conversation(
                id=str(trace_data.conversation_id), 
                user_id=trace_data.user_id
            )
            db.add(conversation)
    
    # 2. Determine initial status
    # If SDK provides evaluation, use it. Otherwise, mark as 'pending' for async eval.
    has_evaluation = trace_data.evaluation is not None
    initial_status = trace_data.evaluation.status if has_evaluation else "pending"
    initial_score = trace_data.evaluation.score if has_evaluation else None
    initial_failure_mode = trace_data.evaluation.failure_mode if has_evaluation else None
    initial_eval_reason = trace_data.evaluation.reason if has_evaluation else None
    
    # 3. Create Trace
    db_trace = Trace(
        id=str(trace_data.id),
        conversation_id=str(trace_data.conversation_id) if trace_data.conversation_id else None,
        user_id=trace_data.user_id,
        start_time=trace_data.start_time,
        end_time=trace_data.end_time,
        user_input=trace_data.user_input,
        assistant_output=trace_data.assistant_output,
        latency=(trace_data.end_time - trace_data.start_time).total_seconds() 
            if trace_data.end_time and trace_data.start_time else 0,
        status=initial_status,
        score=initial_score,
        failure_mode=initial_failure_mode,
        eval_reason=initial_eval_reason,
    )
    db.add(db_trace)

    # 4. Create Spans
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
            error=span.error
        )
        db.add(db_span)
    
    db.commit()
    
    # 5. Enqueue for async evaluation if no pre-computed evaluation was provided
    if not has_evaluation:
        # TODO: In future, extract tenant API key from request headers or DB
        enqueue_evaluation(str(trace_data.id), api_key=None)
    
    return {"status": "success", "id": str(trace_data.id), "evaluation_pending": not has_evaluation}

