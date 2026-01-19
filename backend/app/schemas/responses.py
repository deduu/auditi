"""General response Pydantic schemas."""
from pydantic import BaseModel


class FailureModeStat(BaseModel):
    """Schema for failure mode statistics."""
    id: int
    name: str
    count: int
    percentage: float


class ActionResponse(BaseModel):
    """Schema for recommended action response."""
    id: int
    title: str
    description: str
    priority: str  # high, medium, low
    status: str  # pending, in_progress, completed
    category: str


class ModelStat(BaseModel):
    """Schema for model statistics."""
    id: int
    name: str
    status: str  # active, inactive
    accuracy: float
    latency: str
    cost: str
    requests: str
