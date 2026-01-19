from abc import ABC, abstractmethod
from typing import Optional
from .api_types import TraceInput, EvaluationResult

class BaseEvaluator(ABC):
    @abstractmethod
    def evaluate(self, trace: TraceInput) -> EvaluationResult:
        """
        Evaluate a trace and return a Pass/Fail result with a score.
        """
        pass
