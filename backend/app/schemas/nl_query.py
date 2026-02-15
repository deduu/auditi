"""Pydantic schemas for natural language query feature."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class NLQueryRequest(BaseModel):
    """Request body for the /nl-query/ask endpoint."""

    query: str = Field(..., min_length=1, max_length=2000)
    session_id: Optional[str] = None
    regenerate: bool = False


class NLQueryMessage(BaseModel):
    """A single message in the conversation history."""

    role: str  # "user" or "assistant"
    content: str
    data: Optional[List[Dict[str, Any]]] = None
    visualization: Optional[str] = None  # table, bar_chart, line_chart, pie_chart, number


class NLQueryResponse(BaseModel):
    """Response from the /nl-query/ask endpoint."""

    session_id: str
    answer: str
    data: Optional[List[Dict[str, Any]]] = None
    visualization: Optional[str] = None
    token_usage: Optional[int] = None
    error: Optional[str] = None


class NLQuerySessionResponse(BaseModel):
    """Response for GET /nl-query/session/{id}."""

    session_id: str
    messages: List[NLQueryMessage]


class NLQuerySuggestion(BaseModel):
    """A single query suggestion."""

    text: str
    category: str


class NLQuerySuggestionsResponse(BaseModel):
    """Response for GET /nl-query/suggestions."""

    suggestions: List[NLQuerySuggestion]
