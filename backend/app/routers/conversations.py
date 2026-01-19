"""Conversations API routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List

from app.database import get_db
from app.models import Conversation
from app.schemas import ConversationSummary

router = APIRouter(tags=["conversations"])


@router.get("/conversations", response_model=List[ConversationSummary])
@router.get("/v1/conversations", response_model=List[ConversationSummary])
def get_conversations(
    skip: int = 0, 
    limit: int = 20, 
    db: Session = Depends(get_db)
):
    """Get paginated list of conversations with aggregated stats."""
    convs = db.query(Conversation).order_by(
        desc(Conversation.updated_at)
    ).offset(skip).limit(limit).all()
    
    results = []
    for c in convs:
        # Aggregate stats per conversation
        traces = list(c.traces)
        pass_count = sum(1 for t in traces if t.status == "pass")
        fail_count = sum(1 for t in traces if t.status == "fail")
        scores = [t.score for t in traces if t.score is not None]
        avg_score = sum(scores) / len(scores) if scores else 0
        
        results.append(ConversationSummary(
            id=c.id,
            userId=c.user_id,
            startTime=c.created_at,
            totalTurns=len(traces),
            passCount=pass_count,
            failCount=fail_count,
            overallStatus="fail" if fail_count > 0 else "pass" if pass_count > 0 else "review",
            models=["GPT-4"],  # TODO: Extract from spans
            avgScore=avg_score,
            latency=sum(t.latency for t in traces if t.latency) / len(traces) if traces else 0
        ))
    return results


@router.get("/conversations/{conversation_id}")
@router.get("/v1/conversations/{conversation_id}")
def get_conversation_detail(conversation_id: str, db: Session = Depends(get_db)):
    """Get detailed view of a conversation including all turns and spans."""
    c = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    traces = list(c.traces)
    # Sort traces by start time
    traces.sort(key=lambda t: t.start_time)
    
    return {
        "id": c.id,
        "userId": c.user_id,
        "startTime": c.created_at,
        "turns": [
            {
                "id": str(t.id),
                "user": {"content": t.user_input},
                "assistant": {
                    "content": t.assistant_output,
                    "model": "GPT-4",
                    "latency": f"{t.latency:.1f}s",
                    "evaluation": {
                        "status": t.status,
                        "score": t.score,
                        "failureMode": t.failure_mode,
                        "reason": t.eval_reason,
                        "recommendedAction": "None"
                    }
                },
                "spans": [
                    {
                        "id": str(s.id),
                        "name": s.name,
                        "type": s.span_type,
                        "start_time": s.start_time,
                        "end_time": s.end_time,
                        "inputs": s.inputs,
                        "outputs": s.outputs,
                        "status": s.status,
                        "error": s.error,
                        "duration": f"{(s.end_time - s.start_time).total_seconds():.1f}s" 
                            if s.end_time and s.start_time else "0s"
                    } for s in t.spans
                ]
            } for t in traces
        ]
    }
