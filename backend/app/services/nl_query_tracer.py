"""
Self-tracing for Ask Auditi queries.

Writes Trace + Span records directly to DB, tagged with "ask_auditi".
Bypasses the HTTP ingest endpoint to avoid needing an API key and to
prevent auto-evaluation (which would create infinite loops).
"""

import json
import uuid
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Trace, Span, Conversation

logger = logging.getLogger("auditi.nl_query_tracer")

ASK_AUDITI_TAG = "ask_auditi"
ASK_AUDITI_USER_ID = "__auditi_system__"


def ensure_conversation(db: Session, session_id: str, objective: Optional[str] = None) -> str:
    """Ensure a Conversation record exists for this NL query session."""
    conversation_id = f"ask_auditi_{session_id}"
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        try:
            conv = Conversation(id=conversation_id, user_id=ASK_AUDITI_USER_ID)
            db.add(conv)
            db.flush()
        except IntegrityError:
            db.rollback()
            conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()

    if conv and objective and not conv.objective:
        conv.objective = objective[:200]
        db.flush()

    return conversation_id


def _build_llm_output_summary(llm_call: Dict[str, Any]) -> str:
    """Build a human-readable output summary for an LLM call span."""
    tool_calls = llm_call.get("tool_calls_requested", [])
    if tool_calls:
        parts = []
        for tc in tool_calls:
            try:
                args = json.loads(tc.get("arguments", "{}"))
                args_str = ", ".join(f"{k}={v!r}" for k, v in args.items())
            except (json.JSONDecodeError, AttributeError):
                args_str = tc.get("arguments", "")[:100]
            parts.append(f"{tc['name']}({args_str})")
        return "Tool calls: " + ", ".join(parts)

    response_content = llm_call.get("response_content")
    if response_content:
        return response_content

    return llm_call.get("finish_reason", "unknown")


def record_ask_auditi_trace(
    db: Session,
    *,
    session_id: str,
    user_query: str,
    assistant_answer: str,
    model: str,
    total_tokens: int,
    llm_calls: List[Dict[str, Any]],
    function_calls: List[Dict[str, Any]],
    start_time: datetime,
    end_time: datetime,
) -> Optional[str]:
    """
    Record a single Ask Auditi query turn as a Trace with child Spans.

    Creates a hierarchy:
      Root "agent" span (Ask Auditi Query)
        ├── LLM Call #1 (llm)
        ├── function_name (tool)
        ├── LLM Call #2 (llm)
        └── ...

    Returns the trace_id on success, None on failure.
    This function is fire-and-forget — errors are logged but never propagated.
    """
    try:
        conversation_id = ensure_conversation(db, session_id, objective=user_query)

        trace_id = str(uuid.uuid4())
        root_span_id = str(uuid.uuid4())
        latency = (end_time - start_time).total_seconds()

        db_trace = Trace(
            id=trace_id,
            conversation_id=conversation_id,
            user_id=ASK_AUDITI_USER_ID,
            start_time=start_time,
            end_time=end_time,
            user_input=user_query,
            assistant_output=assistant_answer,
            latency=latency,
            name="Ask Auditi",
            model_name=model,
            total_tokens=total_tokens,
            cost=0.0,
            tags=[ASK_AUDITI_TAG],
            status="pass",
            eval_reason="Self-observation trace (not evaluated)",
        )
        db.add(db_trace)

        # Root agent span — wraps the entire execution
        db.add(Span(
            id=root_span_id,
            trace_id=trace_id,
            name="Ask Auditi Query",
            span_type="agent",
            start_time=start_time,
            end_time=end_time,
            processing_time=latency,
            inputs={"query": user_query},
            outputs=assistant_answer[:500],
            tokens=total_tokens,
            status="ok",
        ))

        # LLM call spans — show what the LLM received and decided
        for i, llm_call in enumerate(llm_calls):
            is_first = i == 0
            db.add(Span(
                id=str(uuid.uuid4()),
                trace_id=trace_id,
                parent_id=root_span_id,
                name=f"LLM Call #{i + 1}" if len(llm_calls) > 1 else "LLM Call",
                span_type="llm",
                model=model,
                start_time=llm_call.get("start_time", start_time),
                end_time=llm_call.get("end_time", end_time),
                processing_time=llm_call.get("processing_time"),
                inputs={
                    "query": (llm_call.get("user_query", "") or "")[:200],
                    "messages_count": llm_call.get("messages_count", 0),
                    **({"context": "Processing user query"} if is_first
                       else {"context": "Synthesizing from function results"}),
                },
                outputs=_build_llm_output_summary(llm_call),
                input_tokens=llm_call.get("input_tokens", 0),
                output_tokens=llm_call.get("output_tokens", 0),
                tokens=llm_call.get("total_tokens", 0),
                cost=0.0,
                status="ok",
            ))

        # Function call spans — show arguments and data returned
        for fc in function_calls:
            db.add(Span(
                id=str(uuid.uuid4()),
                trace_id=trace_id,
                parent_id=root_span_id,
                name=fc.get("name", "unknown_function"),
                span_type="tool",
                start_time=fc.get("start_time", start_time),
                end_time=fc.get("end_time", end_time),
                processing_time=fc.get("processing_time"),
                inputs=fc.get("arguments"),
                outputs=str(fc.get("result_preview", ""))[:1000],
                status="ok" if not fc.get("error") else "error",
                error=fc.get("error"),
            ))

        db.commit()
        logger.info(
            "Recorded Ask Auditi trace %s (session=%s, tokens=%d, latency=%.2fs)",
            trace_id, session_id, total_tokens, latency,
        )
        return trace_id

    except Exception:
        logger.exception("Failed to record Ask Auditi trace")
        db.rollback()
        return None
