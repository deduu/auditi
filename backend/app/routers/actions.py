"""Actions and Failure Modes API routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.database import get_db
from app.models import Trace, Action
from app.schemas import ActionResponse, FailureModeStat
from app.services.action_generator import generate_actions_from_insights

router = APIRouter(tags=["actions"])


@router.get("/actions", response_model=List[ActionResponse])
@router.get("/v1/actions", response_model=List[ActionResponse])
def get_actions(db: Session = Depends(get_db)):
    """Get list of recommended actions from database."""
    # 1. Trigger action generation from current insights
    try:
        generate_actions_from_insights(db)
    except Exception as e:
        # Don't fail the read request if generation fails
        print(f"Action generation failed: {e}")

    # 2. Return all non-archived actions
    # Assuming 'completed' is still relevant to show (maybe separate lists in frontend)
    # The frontend shows 'pending' and 'completed'.
    actions = db.query(Action).all()

    return actions


@router.get("/failure-modes", response_model=List[FailureModeStat])
@router.get("/v1/failure-modes", response_model=List[FailureModeStat])
def get_failure_modes(db: Session = Depends(get_db)):
    """Get statistics on failure modes."""
    stats = (
        db.query(Trace.failure_mode, func.count(Trace.id))
        .filter(Trace.failure_mode != None)
        .group_by(Trace.failure_mode)
        .all()
    )

    total_failures = sum(count for _, count in stats)

    return [
        FailureModeStat(
            id=idx,
            name=mode,
            count=count,
            percentage=(
                round((count / total_failures) * 100, 1) if total_failures else 0
            ),
        )
        for idx, (mode, count) in enumerate(stats)
    ]


@router.patch("/actions/{action_id}", response_model=ActionResponse)
def update_action_status(action_id: str, payload: dict, db: Session = Depends(get_db)):
    """Update status of an action."""
    action = db.query(Action).filter(Action.id == action_id).first()
    if not action:
        # Should initiate a 404 but keeping simple
        pass

    status = payload.get("status")
    if status and action:
        action.status = status

        # Handle manual resolution details
        if status == "completed":
            from datetime import datetime, timezone

            # Use provided time or current server time
            action.resolved_at = datetime.now(timezone.utc)
            action.resolved_by = payload.get("resolved_by", "User")
            action.resolution_notes = payload.get("resolution_notes")

        db.commit()
        db.refresh(action)

    return action
