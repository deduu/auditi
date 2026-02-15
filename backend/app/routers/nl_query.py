"""Natural language query router — Ask Auditi endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.nl_query import (
    NLQueryMessage,
    NLQueryRequest,
    NLQueryResponse,
    NLQuerySessionResponse,
    NLQuerySuggestion,
    NLQuerySuggestionsResponse,
)
from app.services.nl_query_engine import NLQueryEngine, session_store

router = APIRouter(
    prefix="/nl-query",
    tags=["nl-query"],
    dependencies=[Depends(get_current_user)],
)


@router.post("/ask", response_model=NLQueryResponse)
async def ask_query(body: NLQueryRequest, db: Session = Depends(get_db)):
    """Process a natural language query against observability data."""
    engine = NLQueryEngine(db)
    answer, data, visualization, session_id, token_usage = await engine.ask(
        body.query, body.session_id, regenerate=body.regenerate,
    )
    return NLQueryResponse(
        session_id=session_id,
        answer=answer,
        data=data,
        visualization=visualization,
        token_usage=token_usage,
    )


@router.get("/suggestions", response_model=NLQuerySuggestionsResponse)
async def get_suggestions():
    """Return suggested queries for the empty-state UI."""
    suggestions = [
        NLQuerySuggestion(text="Show me all failed traces from the last 24 hours", category="Traces"),
        NLQuerySuggestion(text="Which model has the highest error rate?", category="Models"),
        NLQuerySuggestion(text="What are the most common failure modes this week?", category="Failures"),
        NLQuerySuggestion(text="Show me the cost breakdown by model", category="Costs"),
        NLQuerySuggestion(text="What are the latency percentiles for the last 7 days?", category="Latency"),
        NLQuerySuggestion(text="How are scores trending over time?", category="Scores"),
        NLQuerySuggestion(text="Who are the most active users?", category="Users"),
        NLQuerySuggestion(text="Compare model performance this week", category="Models"),
        NLQuerySuggestion(text="Show me evaluator pass/fail rates", category="Evaluators"),
        NLQuerySuggestion(text="What are the pending action items?", category="Actions"),
    ]
    return NLQuerySuggestionsResponse(suggestions=suggestions)


@router.get("/session/{session_id}", response_model=NLQuerySessionResponse)
async def get_session(session_id: str):
    """Get conversation history for a session."""
    session = session_store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found or expired")
    messages = [
        NLQueryMessage(
            role=m["role"],
            content=m["content"],
            data=m.get("data"),
            visualization=m.get("visualization"),
        )
        for m in session["messages"]
    ]
    return NLQuerySessionResponse(session_id=session_id, messages=messages)


@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Clear a conversation session."""
    session_store.delete(session_id)
    return {"message": "Session cleared"}
