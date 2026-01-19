"""
Abstract base class for backend evaluators.
"""
from abc import ABC, abstractmethod
from typing import TypedDict, Optional


class EvalResult(TypedDict):
    """Result of evaluating a trace."""
    status: str           # "pass", "fail", "review"
    score: float          # 0.0 - 1.0
    failure_mode: Optional[str]   # hallucination, off_topic, harmful, incomplete, other
    reason: Optional[str]         # Brief explanation


class BaseBackendEvaluator(ABC):
    """
    Abstract base class for backend trace evaluators.
    
    Subclass this to implement custom evaluation logic.
    Evaluators run asynchronously on the backend after trace ingestion.
    
    Example:
        >>> class CustomEvaluator(BaseBackendEvaluator):
        ...     async def evaluate(self, user_input, assistant_output, context=None):
        ...         score = my_scoring_function(assistant_output)
        ...         return EvalResult(
        ...             status="pass" if score > 0.7 else "fail",
        ...             score=score,
        ...             failure_mode=None,
        ...             reason="Custom evaluation"
        ...         )
    """
    
    @abstractmethod
    async def evaluate(
        self, 
        user_input: str, 
        assistant_output: str,
        context: Optional[dict] = None
    ) -> EvalResult:
        """
        Evaluate a trace and return pass/fail result with reasoning.
        
        Args:
            user_input: The user's original input/question
            assistant_output: The AI assistant's response
            context: Optional additional context (e.g., conversation history, metadata)
            
        Returns:
            EvalResult with status, score, optional failure_mode and reason
        """
        pass
