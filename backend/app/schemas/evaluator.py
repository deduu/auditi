"""
Pydantic schemas for Evaluator API.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class EvaluatorBase(BaseModel):
    """Base schema for evaluator."""

    name: str = Field(..., description="Evaluator name")
    description: Optional[str] = Field(None, description="Evaluator description")
    evaluation_scope: str = Field(
        "auto", description="Evaluation scope: 'auto', 'simple', 'trace', or 'span'"
    )
    use_default_model: bool = Field(
        True, description="Whether to use the default model"
    )
    connection_id: Optional[str] = Field(
        None, description="Specific connection ID if not using default"
    )
    model_name: Optional[str] = Field(None, description="Model name override")

    # LLMEvaluator-compatible prompts
    span_eval_prompt: Optional[str] = Field(
        None, description="Prompt for evaluating individual spans"
    )
    trace_eval_prompt: Optional[str] = Field(
        None, description="Prompt for overall trace evaluation (agent mode)"
    )
    simple_eval_prompt: Optional[str] = Field(
        None, description="Prompt for single-turn interactions (simple mode)"
    )

    # Legacy fields
    prompt: Optional[str] = Field(None, description="Legacy evaluation prompt template")
    score_reasoning_prompt: Optional[str] = Field(
        None, description="Legacy score reasoning prompt"
    )


class EvaluatorCreate(EvaluatorBase):
    """Schema for creating a new evaluator."""

    pass


class EvaluatorUpdate(BaseModel):
    """Schema for updating an evaluator."""

    name: Optional[str] = None
    description: Optional[str] = None
    evaluation_scope: Optional[str] = None
    use_default_model: Optional[bool] = None
    connection_id: Optional[str] = None
    model_name: Optional[str] = None
    span_eval_prompt: Optional[str] = None
    trace_eval_prompt: Optional[str] = None
    simple_eval_prompt: Optional[str] = None
    prompt: Optional[str] = None
    score_reasoning_prompt: Optional[str] = None
    is_active: Optional[bool] = None


class EvaluatorResponse(BaseModel):
    """Schema for evaluator response."""

    id: str
    name: str
    description: Optional[str] = None
    evaluator_type: str
    evaluation_scope: str = "auto"
    use_default_model: bool
    connection_id: Optional[str] = None
    model_name: Optional[str] = None
    span_eval_prompt: Optional[str] = None
    trace_eval_prompt: Optional[str] = None
    simple_eval_prompt: Optional[str] = None
    prompt: Optional[str] = None
    score_reasoning_prompt: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ManagedEvaluator(BaseModel):
    """Schema for managed (built-in) evaluator."""

    id: str
    name: str
    description: str
    evaluator_type: str = "managed"
    evaluation_scope: str = "auto"  # auto, simple, trace, span
    # Pre-defined prompts for managed evaluators
    trace_eval_prompt: Optional[str] = None  # Used when trace has spans
    simple_eval_prompt: Optional[str] = None  # Used for simple input/output traces


class SetupStateResponse(BaseModel):
    """Schema for setup wizard state."""

    current_step: int = 0
    has_default_model: bool = False
    selected_evaluator_id: Optional[str] = None
    auto_eval_enabled: bool = False
    active_evaluator_id: Optional[str] = None


class SetupStateUpdate(BaseModel):
    """Schema for updating setup state."""

    current_step: Optional[int] = None
    selected_evaluator_id: Optional[str] = None
    auto_eval_enabled: Optional[bool] = None
    active_evaluator_id: Optional[str] = None


class AutoEvalConfigResponse(BaseModel):
    """Response for auto-evaluation configuration check."""

    enabled: bool = False
    has_valid_connection: bool = False
    has_active_evaluator: bool = False
    ready: bool = False  # True only if all conditions met
    connection_provider: Optional[str] = None
    connection_model: Optional[str] = None
    evaluator_name: Optional[str] = None
