"""
Base evaluator class for implementing custom evaluation logic.
"""
from abc import ABC, abstractmethod
from .types import TraceInput, EvaluationResult


class BaseEvaluator(ABC):
    """
    Abstract base class for trace evaluators.
    
    Subclass this to implement custom evaluation logic for your AI agents.
    The evaluator is called after each trace completes and before sending
    to the Auditi platform.
    
    Example:
        >>> class QualityEvaluator(BaseEvaluator):
        ...     def evaluate(self, trace: TraceInput) -> EvaluationResult:
        ...         score = calculate_quality(trace.assistant_output)
        ...         return EvaluationResult(
        ...             status="pass" if score > 0.7 else "fail",
        ...             score=score,
        ...             reason="Quality check"
        ...         )
    """
    
    @abstractmethod
    def evaluate(self, trace: TraceInput) -> EvaluationResult:
        """
        Evaluate a trace and return a pass/fail result with a score.
        
        Args:
            trace: The complete trace data including input, output, and spans
            
        Returns:
            EvaluationResult with status, score, and optional details
        """
        pass
