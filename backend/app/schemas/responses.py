from .base import APIModel


class FailureModeStat(APIModel):
    id: int
    name: str
    count: int
    percentage: float


class ActionResponse(APIModel):
    id: int
    title: str
    description: str
    priority: str  # high | medium | low
    status: str  # pending | in_progress | completed
    category: str


class ModelStat(APIModel):
    id: int
    name: str
    status: str  # active | inactive
    accuracy: float
    latency_ms: float
    cost_per_1k: float
    requests: int
