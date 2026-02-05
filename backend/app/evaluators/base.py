"""
Abstract base class for backend evaluators.
"""
from abc import ABC, abstractmethod
from typing import TypedDict, Optional, List, Dict, Any
from pydantic import BaseModel, Field

class SpanEvaluation(BaseModel):
    """Evaluation result for a single span."""
    span_id: str
    step_number: int
    step_type: str
    step_name: str
    relevant: bool = True
    quality_score: float = Field(ge=0.0, le=1.0)
    issues: List[str] = Field(default_factory=list)
    reasoning: str = ""


class EvalResult(BaseModel):
    """
    Comprehensive evaluation result for a trace.

    Includes both overall trace evaluation AND individual span evaluations.
    Supports flexible custom schemas through metadata field.
    """

    # Core evaluation fields (always extracted)
    status: str  # "pass", "fail", or "review"
    score: float = Field(ge=0.0, le=1.0)
    failure_mode: Optional[str] = None
    reason: str = ""
    recommended_action: Optional[str] = None

    # Span-level evaluations
    span_evaluations: List[SpanEvaluation] = Field(default_factory=list)

    # Flexible metadata for custom schema support
    # Structure:
    # {
    #   "custom_fields": {...},      # Any extra fields from custom schema
    #   "schema_warnings": [...],    # Validation warnings encountered
    #   "evaluated_at": "...",       # ISO timestamp
    #   "evaluator_id": "...",       # ID of evaluator used
    # }
    metadata: Dict[str, Any] = Field(default_factory=dict)
    
    def model_dump(self, **kwargs) -> Dict[str, Any]:
        """Override to ensure proper serialization."""
        data = super().model_dump(**kwargs)
        # Convert SpanEvaluation objects to dicts
        if "span_evaluations" in data:
            data["span_evaluations"] = [
                se if isinstance(se, dict) else se.model_dump()
                for se in data["span_evaluations"]
            ]
        return data


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
