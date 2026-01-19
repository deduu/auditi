"""Conversation-related Pydantic schemas."""
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class ConversationSummary(BaseModel):
    """Schema for conversation list item."""
    id: str
    userId: Optional[str] = None
    startTime: datetime
    totalTurns: int
    passCount: int
    failCount: int
    overallStatus: str  # pass, fail, review
    models: List[str]
    avgScore: float
    latency: float
