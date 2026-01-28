"""
API router for evaluators.
"""

import uuid
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models.evaluator import Evaluator, EvaluatorSetupState
from ..models.llm_connection import LLMConnection
from ..schemas.evaluator import (
    EvaluatorCreate,
    EvaluatorUpdate,
    EvaluatorResponse,
    ManagedEvaluator,
    SetupStateResponse,
    SetupStateUpdate,
    AutoEvalConfigResponse,
)

router = APIRouter(
    prefix="/evaluators",
    tags=["evaluators"],
)

# Built-in managed evaluators
MANAGED_EVALUATORS = [
    ManagedEvaluator(
        id="conciseness",
        name="Conciseness",
        description="Evaluates response brevity and clarity",
    ),
    ManagedEvaluator(
        id="correctness",
        name="Correctness",
        description="Checks factual accuracy of responses",
    ),
    ManagedEvaluator(
        id="hallucination",
        name="Hallucination",
        description="Detects fabricated or unsupported claims",
    ),
    ManagedEvaluator(
        id="relevance",
        name="Relevance",
        description="Measures relevance to the input query",
    ),
    ManagedEvaluator(
        id="sql-semantic",
        name="SQL Semantic Equivalence",
        description="Compares SQL query semantics",
    ),
    ManagedEvaluator(
        id="toxicity",
        name="Toxicity",
        description="Detects harmful or inappropriate content",
    ),
    ManagedEvaluator(
        id="helpfulness",
        name="Helpfulness",
        description="Evaluates how helpful the response is",
    ),
]


@router.get("/managed", response_model=List[ManagedEvaluator])
def list_managed_evaluators():
    """List all managed (built-in) evaluators."""
    return MANAGED_EVALUATORS


@router.get("", response_model=List[EvaluatorResponse])
def list_evaluators(db: Session = Depends(get_db)):
    """List all custom evaluators."""
    evaluators = (
        db.query(Evaluator)
        .filter(Evaluator.evaluator_type == "custom")
        .order_by(Evaluator.created_at.desc())
        .all()
    )
    return evaluators


@router.post("", response_model=EvaluatorResponse)
def create_evaluator(data: EvaluatorCreate, db: Session = Depends(get_db)):
    """Create a new custom evaluator."""
    evaluator = Evaluator(
        id=str(uuid.uuid4()),
        name=data.name,
        description=data.description,
        evaluator_type="custom",
        use_default_model=data.use_default_model,
        connection_id=data.connection_id,
        model_name=data.model_name,
        span_eval_prompt=data.span_eval_prompt,
        trace_eval_prompt=data.trace_eval_prompt,
        simple_eval_prompt=data.simple_eval_prompt,
        prompt=data.prompt,
        score_reasoning_prompt=data.score_reasoning_prompt,
    )
    db.add(evaluator)
    db.commit()
    db.refresh(evaluator)
    return evaluator


@router.get("/{evaluator_id}", response_model=EvaluatorResponse)
def get_evaluator(evaluator_id: str, db: Session = Depends(get_db)):
    """Get a specific evaluator."""
    evaluator = db.query(Evaluator).filter(Evaluator.id == evaluator_id).first()
    if not evaluator:
        raise HTTPException(status_code=404, detail="Evaluator not found")
    return evaluator


@router.put("/{evaluator_id}", response_model=EvaluatorResponse)
def update_evaluator(
    evaluator_id: str, data: EvaluatorUpdate, db: Session = Depends(get_db)
):
    """Update an evaluator."""
    evaluator = db.query(Evaluator).filter(Evaluator.id == evaluator_id).first()
    if not evaluator:
        raise HTTPException(status_code=404, detail="Evaluator not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(evaluator, key, value)

    db.commit()
    db.refresh(evaluator)
    return evaluator


@router.delete("/{evaluator_id}")
def delete_evaluator(evaluator_id: str, db: Session = Depends(get_db)):
    """Delete an evaluator."""
    evaluator = db.query(Evaluator).filter(Evaluator.id == evaluator_id).first()
    if not evaluator:
        raise HTTPException(status_code=404, detail="Evaluator not found")

    db.delete(evaluator)
    db.commit()
    return {"message": "Evaluator deleted"}


# Setup State endpoints
@router.get("/setup/state", response_model=SetupStateResponse)
def get_setup_state(db: Session = Depends(get_db)):
    """Get the current setup wizard state."""
    state = (
        db.query(EvaluatorSetupState)
        .filter(EvaluatorSetupState.id == "default")
        .first()
    )

    # Check if default model is configured
    has_default = (
        db.query(LLMConnection).filter(LLMConnection.is_default == True).first()
        is not None
    )

    if not state:
        return SetupStateResponse(
            current_step=0 if not has_default else 1,
            has_default_model=has_default,
            selected_evaluator_id=None,
            auto_eval_enabled=False,
            active_evaluator_id=None,
        )

    return SetupStateResponse(
        current_step=int(state.current_step),
        has_default_model=has_default,
        selected_evaluator_id=state.selected_evaluator_id,
        auto_eval_enabled=state.auto_eval_enabled or False,
        active_evaluator_id=state.active_evaluator_id,
    )


@router.put("/setup/state", response_model=SetupStateResponse)
def update_setup_state(data: SetupStateUpdate, db: Session = Depends(get_db)):
    """Update the setup wizard state."""
    state = (
        db.query(EvaluatorSetupState)
        .filter(EvaluatorSetupState.id == "default")
        .first()
    )

    if not state:
        state = EvaluatorSetupState(id="default")
        db.add(state)

    if data.current_step is not None:
        state.current_step = str(data.current_step)
    if data.selected_evaluator_id is not None:
        state.selected_evaluator_id = data.selected_evaluator_id
    if data.auto_eval_enabled is not None:
        state.auto_eval_enabled = data.auto_eval_enabled
    if data.active_evaluator_id is not None:
        state.active_evaluator_id = data.active_evaluator_id

    db.commit()
    db.refresh(state)

    has_default = (
        db.query(LLMConnection).filter(LLMConnection.is_default == True).first()
        is not None
    )

    return SetupStateResponse(
        current_step=int(state.current_step),
        has_default_model=has_default,
        selected_evaluator_id=state.selected_evaluator_id,
        auto_eval_enabled=state.auto_eval_enabled or False,
        active_evaluator_id=state.active_evaluator_id,
    )


@router.get("/setup/auto-eval-config", response_model=AutoEvalConfigResponse)
def get_auto_eval_config(db: Session = Depends(get_db)):
    """
    Check if auto-evaluation is ready to run.
    Returns configuration status for the eval worker.
    """
    state = (
        db.query(EvaluatorSetupState)
        .filter(EvaluatorSetupState.id == "default")
        .first()
    )

    # Check if enabled
    enabled = state.auto_eval_enabled if state else False

    # Check for valid default connection
    default_connection = (
        db.query(LLMConnection)
        .filter(
            LLMConnection.is_default == True,
            LLMConnection.api_key_encrypted.isnot(None),
        )
        .first()
    )
    has_valid_connection = default_connection is not None

    # Check for active evaluator
    active_evaluator = None
    if state and state.active_evaluator_id:
        active_evaluator = (
            db.query(Evaluator)
            .filter(
                Evaluator.id == state.active_evaluator_id, Evaluator.is_active == True
            )
            .first()
        )
    has_active_evaluator = active_evaluator is not None

    # All conditions must be met
    ready = enabled and has_valid_connection and has_active_evaluator

    return AutoEvalConfigResponse(
        enabled=enabled,
        has_valid_connection=has_valid_connection,
        has_active_evaluator=has_active_evaluator,
        ready=ready,
        connection_provider=default_connection.provider if default_connection else None,
        connection_model=(
            default_connection.default_model if default_connection else None
        ),
        evaluator_name=active_evaluator.name if active_evaluator else None,
    )
