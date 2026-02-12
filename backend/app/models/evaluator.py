# Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
"""
Evaluator model for storing custom evaluator configurations.
"""

from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.sql import func
from ..database import Base


class Evaluator(Base):
    """Model for storing custom evaluator configurations."""

    __tablename__ = "evaluators"

    id = Column(String(36), primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    evaluator_type = Column(String(50), default="custom")  # managed, custom
    evaluation_scope = Column(String(20), default="auto")  # auto, simple, trace, span

    # Model configuration
    use_default_model = Column(Boolean, default=True)
    connection_id = Column(String(36), ForeignKey("llm_connections.id"), nullable=True)
    model_name = Column(String(100), nullable=True)

    # Prompts - compatible with LLMEvaluator custom_prompts dict
    # Keys: span_eval, trace_eval, simple_eval
    span_eval_prompt = Column(Text, nullable=True)  # For evaluating individual spans
    trace_eval_prompt = Column(Text, nullable=True)  # For overall trace evaluation
    simple_eval_prompt = Column(Text, nullable=True)  # For single-turn interactions

    # Legacy fields (kept for backward compatibility)
    prompt = Column(Text, nullable=True)
    score_reasoning_prompt = Column(Text, nullable=True)

    # Custom output schema definition (JSON Schema format)
    # Allows developers to define additional fields beyond core schema
    output_schema = Column(JSON, nullable=True)

    # Schema enforcement mode: "strict", "flexible", "none"
    # - strict: Warns on missing required fields, validates types
    # - flexible: Extracts what it can, logs warnings (default)
    # - none: No custom schema validation
    schema_mode = Column(String(20), default="flexible")

    # Status
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self):
        return (
            f"<Evaluator(id={self.id}, name={self.name}, type={self.evaluator_type})>"
        )

    def get_custom_prompts(self):
        """Return prompts dict compatible with LLMEvaluator."""
        prompts = {}
        if self.span_eval_prompt:
            prompts["span_eval"] = self.span_eval_prompt
        if self.trace_eval_prompt:
            prompts["trace_eval"] = self.trace_eval_prompt
        if self.simple_eval_prompt:
            prompts["simple_eval"] = self.simple_eval_prompt
        return prompts if prompts else None


class EvaluatorSetupState(Base):
    """Model for storing the current setup state (wizard progress)."""

    __tablename__ = "evaluator_setup_state"

    id = Column(String(36), primary_key=True, default="default")
    current_step = Column(String(50), default="0")  # 0, 1, 2
    selected_evaluator_id = Column(
        String(36), ForeignKey("evaluators.id"), nullable=True
    )

    # Auto-evaluation toggle
    auto_eval_enabled = Column(Boolean, default=False)

    # Active evaluator for auto-eval (single - backward compat)
    active_evaluator_id = Column(String(36), ForeignKey("evaluators.id"), nullable=True)

    # Active evaluators for auto-eval (multi-evaluator support)
    active_evaluator_ids = Column(JSON, nullable=True)

    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
