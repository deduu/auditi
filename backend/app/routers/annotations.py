# Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
"""
API router for Human Annotation feature.

Provides endpoints for:
- Score Configurations (CRUD)
- Annotation Queues (CRUD + item management)
- Annotations (CRUD + bulk operations)
"""

import uuid
import io
import json
import csv
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Optional

logger = logging.getLogger(__name__)

from ..database import get_db
from ..models.score_config import ScoreConfig
from ..models.annotation_queue import AnnotationQueue, AnnotationQueueItem
from ..models.annotation import Annotation
from ..models.trace import Trace
from ..models.span import Span
from ..schemas.annotation import (
    # Score Config schemas
    ScoreConfigCreate,
    ScoreConfigUpdate,
    ScoreConfigResponse,
    # Queue schemas
    AnnotationQueueCreate,
    AnnotationQueueUpdate,
    AnnotationQueueResponse,
    AnnotationQueueWithStats,
    # Queue Item schemas
    QueueItemAdd,
    QueueItemResponse,
    QueueItemWithData,
    NextQueueItemResponse,
    CompleteQueueItemRequest,
    # Annotation schemas
    AnnotationCreate,
    AnnotationUpdate,
    AnnotationResponse,
    AnnotationWithConfig,
    BulkAnnotationCreate,
    AnnotationSummary,
)

router = APIRouter(
    prefix="/annotations",
    tags=["annotations"],
)


# =============================================================================
# Score Configuration Endpoints
# =============================================================================


@router.get("/score-configs", response_model=List[ScoreConfigResponse])
def list_score_configs(
    include_archived: bool = Query(False, description="Include archived configs"),
    db: Session = Depends(get_db),
):
    """List all score configurations."""
    query = db.query(ScoreConfig)
    if not include_archived:
        query = query.filter(ScoreConfig.is_archived == False)
    return query.order_by(ScoreConfig.created_at.desc()).all()


@router.post("/score-configs", response_model=ScoreConfigResponse, status_code=201)
def create_score_config(
    config: ScoreConfigCreate,
    db: Session = Depends(get_db),
):
    """Create a new score configuration."""
    # Validate data type specific fields
    if config.data_type == "categorical" and not config.categories:
        raise HTTPException(
            status_code=400, detail="Categories are required for categorical score type"
        )

    db_config = ScoreConfig(
        id=str(uuid.uuid4()),
        name=config.name,
        description=config.description,
        data_type=config.data_type,
        categories=(
            [c.model_dump() for c in config.categories] if config.categories else None
        ),
        min_value=config.min_value,
        max_value=config.max_value,
        binary_labels=(
            config.binary_labels.model_dump() if config.binary_labels else None
        ),
        annotation_level=config.annotation_level,
    )
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    return db_config


@router.get("/score-configs/{config_id}", response_model=ScoreConfigResponse)
def get_score_config(config_id: str, db: Session = Depends(get_db)):
    """Get a specific score configuration."""
    config = db.query(ScoreConfig).filter(ScoreConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Score config not found")
    return config


@router.put("/score-configs/{config_id}", response_model=ScoreConfigResponse)
def update_score_config(
    config_id: str,
    update: ScoreConfigUpdate,
    db: Session = Depends(get_db),
):
    """Update a score configuration."""
    config = db.query(ScoreConfig).filter(ScoreConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Score config not found")

    update_data = update.model_dump(exclude_unset=True)

    # Handle nested models
    if "categories" in update_data and update_data["categories"]:
        update_data["categories"] = [
            c.model_dump() if hasattr(c, "model_dump") else c
            for c in update_data["categories"]
        ]
    if "binary_labels" in update_data and update_data["binary_labels"]:
        update_data["binary_labels"] = (
            update_data["binary_labels"].model_dump()
            if hasattr(update_data["binary_labels"], "model_dump")
            else update_data["binary_labels"]
        )

    for key, value in update_data.items():
        setattr(config, key, value)

    db.commit()
    db.refresh(config)
    return config


@router.delete("/score-configs/{config_id}")
def delete_score_config(config_id: str, db: Session = Depends(get_db)):
    """Archive a score configuration (soft delete)."""
    config = db.query(ScoreConfig).filter(ScoreConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Score config not found")

    config.is_archived = True
    db.commit()
    return {"message": "Score config archived"}


# =============================================================================
# Annotation Queue Endpoints
# =============================================================================


@router.get("/queues", response_model=List[AnnotationQueueWithStats])
def list_annotation_queues(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
):
    """List all annotation queues with statistics."""
    query = db.query(AnnotationQueue)
    if not include_inactive:
        query = query.filter(AnnotationQueue.is_active == True)

    queues = query.order_by(AnnotationQueue.created_at.desc()).all()

    result = []
    for queue in queues:
        # Get item counts by status
        status_counts = (
            db.query(AnnotationQueueItem.status, func.count(AnnotationQueueItem.id))
            .filter(AnnotationQueueItem.queue_id == queue.id)
            .group_by(AnnotationQueueItem.status)
            .all()
        )
        counts = {status: count for status, count in status_counts}

        pending = counts.get("pending", 0)
        in_progress = counts.get("in_progress", 0)
        completed = counts.get("completed", 0)
        total = pending + in_progress + completed

        result.append(
            AnnotationQueueWithStats(
                **{c.name: getattr(queue, c.name) for c in queue.__table__.columns},
                pending_items=pending,
                in_progress_items=in_progress,
                progress_percentage=(completed / total * 100) if total > 0 else 0,
            )
        )

    return result


@router.post("/queues", response_model=AnnotationQueueResponse, status_code=201)
def create_annotation_queue(
    queue: AnnotationQueueCreate,
    db: Session = Depends(get_db),
):
    """Create a new annotation queue."""
    # Validate score configs exist
    if queue.score_config_ids:
        existing_ids = [
            c.id
            for c in db.query(ScoreConfig.id)
            .filter(ScoreConfig.id.in_(queue.score_config_ids))
            .all()
        ]
        missing = set(queue.score_config_ids) - set(existing_ids)
        if missing:
            raise HTTPException(
                status_code=400, detail=f"Score configs not found: {missing}"
            )

    db_queue = AnnotationQueue(
        id=str(uuid.uuid4()),
        name=queue.name,
        description=queue.description,
        score_config_ids=queue.score_config_ids,
        assigned_user_ids=queue.assigned_user_ids,
    )
    db.add(db_queue)
    db.commit()
    db.refresh(db_queue)
    return db_queue


@router.get("/queues/{queue_id}", response_model=AnnotationQueueWithStats)
def get_annotation_queue(queue_id: str, db: Session = Depends(get_db)):
    """Get a specific annotation queue with stats."""
    queue = db.query(AnnotationQueue).filter(AnnotationQueue.id == queue_id).first()
    if not queue:
        raise HTTPException(status_code=404, detail="Queue not found")

    # Get item counts
    status_counts = (
        db.query(AnnotationQueueItem.status, func.count(AnnotationQueueItem.id))
        .filter(AnnotationQueueItem.queue_id == queue_id)
        .group_by(AnnotationQueueItem.status)
        .all()
    )
    counts = {status: count for status, count in status_counts}

    pending = counts.get("pending", 0)
    in_progress = counts.get("in_progress", 0)
    completed = counts.get("completed", 0)
    total = pending + in_progress + completed

    return AnnotationQueueWithStats(
        **{c.name: getattr(queue, c.name) for c in queue.__table__.columns},
        pending_items=pending,
        in_progress_items=in_progress,
        progress_percentage=(completed / total * 100) if total > 0 else 0,
    )


@router.put("/queues/{queue_id}", response_model=AnnotationQueueResponse)
def update_annotation_queue(
    queue_id: str,
    update: AnnotationQueueUpdate,
    db: Session = Depends(get_db),
):
    """Update an annotation queue."""
    queue = db.query(AnnotationQueue).filter(AnnotationQueue.id == queue_id).first()
    if not queue:
        raise HTTPException(status_code=404, detail="Queue not found")

    update_data = update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(queue, key, value)

    db.commit()
    db.refresh(queue)
    return queue


@router.delete("/queues/{queue_id}")
def delete_annotation_queue(queue_id: str, db: Session = Depends(get_db)):
    """Deactivate an annotation queue (soft delete) and delete associated annotations."""
    logger.info(f"[DELETE QUEUE] Starting deletion for queue_id: {queue_id}")

    queue = db.query(AnnotationQueue).filter(AnnotationQueue.id == queue_id).first()
    if not queue:
        raise HTTPException(status_code=404, detail="Queue not found")

    logger.info(f"[DELETE QUEUE] Found queue: {queue.name}")

    # Get all queue item IDs for this queue
    queue_item_ids = [
        item.id
        for item in db.query(AnnotationQueueItem.id)
        .filter(AnnotationQueueItem.queue_id == queue_id)
        .all()
    ]
    logger.info(
        f"[DELETE QUEUE] Found {len(queue_item_ids)} queue items: {queue_item_ids}"
    )

    # Delete all annotations linked to these queue items
    if queue_item_ids:
        # First, count how many annotations will be deleted
        annotation_count = (
            db.query(Annotation)
            .filter(Annotation.queue_item_id.in_(queue_item_ids))
            .count()
        )
        logger.info(f"[DELETE QUEUE] Found {annotation_count} annotations to delete")

        deleted_annotations = (
            db.query(Annotation)
            .filter(Annotation.queue_item_id.in_(queue_item_ids))
            .delete(synchronize_session=False)
        )
        logger.info(f"[DELETE QUEUE] Deleted {deleted_annotations} annotations")
    else:
        logger.info("[DELETE QUEUE] No queue items found, skipping annotation deletion")

    # Delete all queue items
    deleted_items = (
        db.query(AnnotationQueueItem)
        .filter(AnnotationQueueItem.queue_id == queue_id)
        .delete(synchronize_session=False)
    )
    logger.info(f"[DELETE QUEUE] Deleted {deleted_items} queue items")

    queue.is_active = False
    db.commit()
    logger.info(f"[DELETE QUEUE] Queue {queue_id} deactivated successfully")
    return {
        "message": "Queue deactivated and annotations deleted",
        "deleted_annotations": deleted_annotations if queue_item_ids else 0,
        "deleted_items": deleted_items,
    }


# =============================================================================
# Queue Item Management Endpoints
# =============================================================================


@router.post("/queues/{queue_id}/items", response_model=List[QueueItemResponse])
def add_items_to_queue(
    queue_id: str,
    items: QueueItemAdd,
    db: Session = Depends(get_db),
):
    """Add items (traces/spans) to an annotation queue."""
    queue = db.query(AnnotationQueue).filter(AnnotationQueue.id == queue_id).first()
    if not queue:
        raise HTTPException(status_code=404, detail="Queue not found")

    # Get current max position
    max_position = (
        db.query(func.max(AnnotationQueueItem.position))
        .filter(AnnotationQueueItem.queue_id == queue_id)
        .scalar()
        or 0
    )

    created_items = []
    for i, item in enumerate(items.items):
        # Validate object exists
        if item.object_type == "trace":
            obj = db.query(Trace).filter(Trace.id == item.object_id).first()
        elif item.object_type == "span":
            obj = db.query(Span).filter(Span.id == item.object_id).first()
        else:
            raise HTTPException(
                status_code=400, detail=f"Invalid object_type: {item.object_type}"
            )

        if not obj:
            raise HTTPException(
                status_code=404,
                detail=f"{item.object_type} not found: {item.object_id}",
            )

        # Check for duplicates
        existing = (
            db.query(AnnotationQueueItem)
            .filter(
                AnnotationQueueItem.queue_id == queue_id,
                AnnotationQueueItem.object_type == item.object_type,
                AnnotationQueueItem.object_id == item.object_id,
            )
            .first()
        )
        if existing:
            continue  # Skip duplicates silently

        queue_item = AnnotationQueueItem(
            id=str(uuid.uuid4()),
            queue_id=queue_id,
            object_type=item.object_type,
            object_id=item.object_id,
            position=max_position + i + 1,
        )
        db.add(queue_item)
        created_items.append(queue_item)

    # Update queue totals
    queue.total_items = (
        db.query(func.count(AnnotationQueueItem.id))
        .filter(AnnotationQueueItem.queue_id == queue_id)
        .scalar()
    ) + len(created_items)

    db.commit()
    for item in created_items:
        db.refresh(item)

    return created_items


@router.get("/queues/{queue_id}/items", response_model=List[QueueItemResponse])
def list_queue_items(
    queue_id: str,
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List items in an annotation queue."""
    query = db.query(AnnotationQueueItem).filter(
        AnnotationQueueItem.queue_id == queue_id
    )

    if status:
        query = query.filter(AnnotationQueueItem.status == status)

    return (
        query.order_by(AnnotationQueueItem.position).offset(offset).limit(limit).all()
    )


@router.get("/queues/{queue_id}/next", response_model=NextQueueItemResponse)
def get_next_queue_item(
    queue_id: str,
    user_id: Optional[str] = Query(None, description="Current user ID for locking"),
    db: Session = Depends(get_db),
):
    """
    Get the next item in queue for annotation.
    Automatically locks the item for the user.
    Priority: 1) Items already in_progress (resume), 2) Pending items, 3) Stale in_progress items
    """
    queue = db.query(AnnotationQueue).filter(AnnotationQueue.id == queue_id).first()
    if not queue:
        raise HTTPException(status_code=404, detail="Queue not found")

    item = None

    # First, check for any in_progress items (to resume work)
    # This handles both: items locked by current user, or items with no lock/anonymous
    item = (
        db.query(AnnotationQueueItem)
        .filter(
            AnnotationQueueItem.queue_id == queue_id,
            AnnotationQueueItem.status == "in_progress",
        )
        .order_by(AnnotationQueueItem.position)
        .first()
    )

    # If no in_progress items, find next pending item (FIFO)
    if not item:
        item = (
            db.query(AnnotationQueueItem)
            .filter(
                AnnotationQueueItem.queue_id == queue_id,
                AnnotationQueueItem.status == "pending",
            )
            .order_by(AnnotationQueueItem.position)
            .first()
        )

    if not item:
        return NextQueueItemResponse(
            item=None,
            score_configs=[],
            existing_annotations=[],
            queue_progress={
                "total": queue.total_items,
                "completed": queue.completed_items,
                "remaining": 0,
            },
        )

    # Lock the item (update lock info)
    item.status = "in_progress"
    item.locked_by = user_id
    item.locked_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(item)

    # Get the object data
    object_data = None
    if item.object_type == "trace":
        trace = db.query(Trace).filter(Trace.id == item.object_id).first()
        if trace:
            # Get spans for this trace
            spans_data = []
            for span in sorted(
                trace.spans,
                key=lambda s: (
                    s.start_time or datetime.min,
                    s.end_time or datetime.min,
                ),
            ):
                span_duration_ms = 0.0
                if span.end_time and span.start_time:
                    span_duration_ms = (
                        span.end_time - span.start_time
                    ).total_seconds() * 1000
                elif span.processing_time:
                    span_duration_ms = span.processing_time * 1000

                span_data = {
                    "id": span.id,
                    "name": span.name,
                    "spanType": span.span_type,
                    "model": span.model,
                    "startTime": (
                        span.start_time.isoformat() if span.start_time else None
                    ),
                    "endTime": span.end_time.isoformat() if span.end_time else None,
                    "durationMs": span_duration_ms,
                    "inputs": span.inputs,
                    "outputs": span.outputs,
                    "inputTokens": span.input_tokens or 0,
                    "outputTokens": span.output_tokens or 0,
                    "tokens": span.tokens or 0,
                    "cost": span.cost or 0.0,
                    "status": span.status or "ok",
                    "error": span.error,
                }

                # Include LLM-as-a-judge evaluation data if available
                if (
                    span.eval_quality_score is not None
                    or span.eval_relevant is not None
                ):
                    span_data["evaluation"] = {
                        "evalQualityScore": span.eval_quality_score,
                        "evalRelevant": span.eval_relevant,
                        "evalReasoning": span.eval_reasoning,
                        "evalIssues": span.eval_issues,
                    }

                spans_data.append(span_data)

            object_data = {
                "id": trace.id,
                "name": trace.name,
                "user_input": trace.user_input,
                "assistant_output": trace.assistant_output,
                "model_name": trace.model_name,
                "latency": trace.latency,
                "status": trace.status,
                "score": trace.score,
                "start_time": (
                    trace.start_time.isoformat() if trace.start_time else None
                ),
                "spans": spans_data,
            }
    elif item.object_type == "span":
        span = db.query(Span).filter(Span.id == item.object_id).first()
        if span:
            object_data = {
                "id": span.id,
                "name": span.name,
                "span_type": span.span_type,
                "inputs": span.inputs,
                "outputs": span.outputs,
                "model": span.model,
                "processing_time": span.processing_time,
            }

    # Get score configs for this queue
    score_configs = (
        db.query(ScoreConfig)
        .filter(ScoreConfig.id.in_(queue.score_config_ids or []))
        .all()
    )

    # Get existing annotations for this object
    existing_annotations = (
        db.query(Annotation)
        .filter(
            Annotation.object_type == item.object_type,
            Annotation.object_id == item.object_id,
        )
        .all()
    )

    # Calculate progress
    completed = (
        db.query(func.count(AnnotationQueueItem.id))
        .filter(
            AnnotationQueueItem.queue_id == queue_id,
            AnnotationQueueItem.status == "completed",
        )
        .scalar()
    )
    total = (
        db.query(func.count(AnnotationQueueItem.id))
        .filter(AnnotationQueueItem.queue_id == queue_id)
        .scalar()
    )

    return NextQueueItemResponse(
        item=QueueItemWithData(
            **{c.name: getattr(item, c.name) for c in item.__table__.columns},
            object_data=object_data,
        ),
        score_configs=[ScoreConfigResponse.model_validate(c) for c in score_configs],
        existing_annotations=[
            AnnotationResponse.model_validate(a) for a in existing_annotations
        ],
        queue_progress={
            "total": total,
            "completed": completed,
            "remaining": total - completed,
        },
    )


@router.post("/queues/{queue_id}/items/{item_id}/complete")
def complete_queue_item(
    queue_id: str,
    item_id: str,
    request: CompleteQueueItemRequest,
    user_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Complete a queue item with annotations."""
    item = (
        db.query(AnnotationQueueItem)
        .filter(
            AnnotationQueueItem.id == item_id,
            AnnotationQueueItem.queue_id == queue_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")

    # Save annotations
    if request.annotations:
        for ann in request.annotations:
            db_ann = Annotation(
                id=str(uuid.uuid4()),
                object_type=ann.object_type or item.object_type,
                object_id=ann.object_id or item.object_id,
                score_config_id=ann.score_config_id,
                value=ann.value,
                string_value=ann.string_value,
                comment=ann.comment,
                annotator_id=user_id,
                queue_item_id=item_id,
                source="queue",
            )
            db.add(db_ann)

    # Update item status
    item.status = "skipped" if request.skip else "completed"
    item.completed_by = user_id
    item.completed_at = datetime.now(timezone.utc)
    item.locked_by = None
    item.locked_at = None

    # Update queue completed count
    queue = db.query(AnnotationQueue).filter(AnnotationQueue.id == queue_id).first()
    if queue and not request.skip:
        queue.completed_items = (
            db.query(func.count(AnnotationQueueItem.id))
            .filter(
                AnnotationQueueItem.queue_id == queue_id,
                AnnotationQueueItem.status == "completed",
            )
            .scalar()
        ) + 1

    db.commit()
    return {"message": "Item completed", "skipped": request.skip}


@router.delete("/queues/{queue_id}/items/{item_id}")
def remove_queue_item(
    queue_id: str,
    item_id: str,
    db: Session = Depends(get_db),
):
    """Remove an item from the queue."""
    item = (
        db.query(AnnotationQueueItem)
        .filter(
            AnnotationQueueItem.id == item_id,
            AnnotationQueueItem.queue_id == queue_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")

    db.delete(item)
    db.commit()
    return {"message": "Item removed from queue"}


# =============================================================================
# Direct Annotation Endpoints (without queue)
# =============================================================================


@router.post("/", response_model=AnnotationResponse, status_code=201)
def create_annotation(
    annotation: AnnotationCreate,
    user_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Create a new annotation directly (not through queue)."""
    # Validate score config exists
    config = (
        db.query(ScoreConfig)
        .filter(ScoreConfig.id == annotation.score_config_id)
        .first()
    )
    if not config:
        raise HTTPException(status_code=404, detail="Score config not found")

    # Validate value based on type
    if config.data_type == "binary":
        if annotation.value not in [0.0, 1.0]:
            raise HTTPException(status_code=400, detail="Binary value must be 0 or 1")
    elif config.data_type == "numerical":
        if annotation.value < config.min_value or annotation.value > config.max_value:
            raise HTTPException(
                status_code=400,
                detail=f"Value must be between {config.min_value} and {config.max_value}",
            )
    elif config.data_type == "categorical":
        valid_values = [c["value"] for c in (config.categories or [])]
        if annotation.value not in valid_values:
            raise HTTPException(
                status_code=400, detail=f"Value must be one of: {valid_values}"
            )

    db_annotation = Annotation(
        id=str(uuid.uuid4()),
        object_type=annotation.object_type,
        object_id=annotation.object_id,
        score_config_id=annotation.score_config_id,
        value=annotation.value,
        string_value=annotation.string_value,
        comment=annotation.comment,
        annotator_id=user_id,
        source=annotation.source,
        queue_item_id=annotation.queue_item_id,
    )
    db.add(db_annotation)
    db.commit()
    db.refresh(db_annotation)
    return db_annotation


@router.get("/object/{object_type}/{object_id}", response_model=AnnotationSummary)
def get_object_annotations(
    object_type: str,
    object_id: str,
    db: Session = Depends(get_db),
):
    """Get all annotations for a specific object (trace or span)."""
    annotations = (
        db.query(Annotation)
        .filter(
            Annotation.object_type == object_type,
            Annotation.object_id == object_id,
        )
        .all()
    )

    # Enrich with score config
    enriched = []
    total_score = 0
    numerical_count = 0

    for ann in annotations:
        config = (
            db.query(ScoreConfig).filter(ScoreConfig.id == ann.score_config_id).first()
        )
        enriched.append(
            AnnotationWithConfig(
                **{c.name: getattr(ann, c.name) for c in ann.__table__.columns},
                score_config=(
                    ScoreConfigResponse.model_validate(config) if config else None
                ),
            )
        )
        if config and config.data_type == "numerical":
            total_score += ann.value
            numerical_count += 1

    return AnnotationSummary(
        object_type=object_type,
        object_id=object_id,
        total_annotations=len(annotations),
        annotations=enriched,
        average_score=total_score / numerical_count if numerical_count > 0 else None,
    )


@router.put("/{annotation_id}", response_model=AnnotationResponse)
def update_annotation(
    annotation_id: str,
    update: AnnotationUpdate,
    db: Session = Depends(get_db),
):
    """Update an existing annotation."""
    annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")

    update_data = update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(annotation, key, value)

    db.commit()
    db.refresh(annotation)
    return annotation


@router.delete("/{annotation_id}")
def delete_annotation(annotation_id: str, db: Session = Depends(get_db)):
    """Delete an annotation."""
    annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")

    db.delete(annotation)
    db.commit()
    return {"message": "Annotation deleted"}


@router.post("/bulk", response_model=List[AnnotationResponse], status_code=201)
def create_bulk_annotations(
    bulk: BulkAnnotationCreate,
    user_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Create multiple annotations at once."""
    created = []
    for ann in bulk.annotations:
        db_annotation = Annotation(
            id=str(uuid.uuid4()),
            object_type=ann.object_type,
            object_id=ann.object_id,
            score_config_id=ann.score_config_id,
            value=ann.value,
            string_value=ann.string_value,
            comment=ann.comment,
            annotator_id=user_id,
            source=ann.source,
            queue_item_id=ann.queue_item_id,
        )
        db.add(db_annotation)
        created.append(db_annotation)

    db.commit()
    for ann in created:
        db.refresh(ann)

    return created


# =============================================================================
# Export Endpoints
# =============================================================================


@router.get("/queues/{queue_id}/export")
def export_queue_annotations(
    queue_id: str,
    format: str = Query("csv", description="Export format: csv, jsonl, or parquet"),
    include_execution_path: bool = Query(
        False, description="Include execution path (spans) data"
    ),
    include_llm_evaluation: bool = Query(
        False, description="Include LLM evaluation data for spans"
    ),
    db: Session = Depends(get_db),
):
    """
    Export completed annotations from a queue for model training.

    Supported formats:
    - csv: Standard CSV format
    - jsonl: JSON Lines format (recommended for fine-tuning)
    - parquet: Apache Parquet format (requires pyarrow)

    Options:
    - include_execution_path: Include spans/execution path data for traces
    - include_llm_evaluation: Include LLM-as-a-judge evaluation data for spans
    """
    queue = db.query(AnnotationQueue).filter(AnnotationQueue.id == queue_id).first()
    if not queue:
        raise HTTPException(status_code=404, detail="Queue not found")

    # Get completed items
    completed_items = (
        db.query(AnnotationQueueItem)
        .filter(
            AnnotationQueueItem.queue_id == queue_id,
            AnnotationQueueItem.status == "completed",
        )
        .order_by(AnnotationQueueItem.position)
        .all()
    )

    if not completed_items:
        raise HTTPException(status_code=400, detail="No completed items to export")

    # Get score configs for column names
    score_configs = (
        db.query(ScoreConfig)
        .filter(ScoreConfig.id.in_(queue.score_config_ids or []))
        .all()
    )
    config_map = {c.id: c for c in score_configs}

    # Build export data
    export_data = []
    for item in completed_items:
        row = {
            "trace_id": item.object_id,
            "object_type": item.object_type,
        }

        # Get object data (trace or span)
        if item.object_type == "trace":
            trace = db.query(Trace).filter(Trace.id == item.object_id).first()
            if trace:
                row["user_input"] = trace.user_input or ""
                row["assistant_output"] = trace.assistant_output or ""
                row["model_name"] = trace.model_name or ""
                row["latency"] = trace.latency or 0.0
                row["status"] = trace.status or ""

                # Include execution path (spans) if requested
                if include_execution_path and trace.spans:
                    spans_data = []
                    for span in sorted(
                        trace.spans,
                        key=lambda s: (
                            s.start_time or datetime.min,
                            s.end_time or datetime.min,
                        ),
                    ):
                        span_info = {
                            "id": span.id,
                            "name": span.name,
                            "type": span.span_type,
                            "model": span.model,
                            "inputs": span.inputs,
                            "outputs": span.outputs,
                            "input_tokens": span.input_tokens or 0,
                            "output_tokens": span.output_tokens or 0,
                            "tokens": span.tokens or 0,
                            "cost": span.cost or 0.0,
                            "status": span.status or "ok",
                            "error": span.error,
                        }

                        # Calculate duration
                        if span.end_time and span.start_time:
                            span_info["duration_ms"] = (
                                span.end_time - span.start_time
                            ).total_seconds() * 1000
                        elif span.processing_time:
                            span_info["duration_ms"] = span.processing_time * 1000
                        else:
                            span_info["duration_ms"] = 0.0

                        # Include LLM evaluation if requested
                        if (
                            include_llm_evaluation
                            and span.eval_quality_score is not None
                        ):
                            span_info["llm_evaluation"] = {
                                "quality_score": span.eval_quality_score,
                                "relevant": span.eval_relevant,
                                "reasoning": span.eval_reasoning,
                                "issues": span.eval_issues,
                            }

                        spans_data.append(span_info)

                    # For JSON formats, include as nested object
                    if format in ["jsonl", "parquet"]:
                        row["execution_path"] = spans_data
                    else:
                        # For CSV, flatten the execution path
                        row["execution_path_json"] = json.dumps(
                            spans_data, ensure_ascii=False
                        )
                        row["span_count"] = len(spans_data)
                        # Include summary of tool calls
                        tool_calls = [s for s in spans_data if s.get("type") == "tool"]
                        row["tool_calls_count"] = len(tool_calls)
                        row["tool_names"] = ", ".join(
                            [s.get("name", "") for s in tool_calls]
                        )

        elif item.object_type == "span":
            span = db.query(Span).filter(Span.id == item.object_id).first()
            if span:
                row["span_name"] = span.name or ""
                row["span_type"] = span.span_type or ""
                row["inputs"] = json.dumps(span.inputs) if span.inputs else ""
                row["outputs"] = json.dumps(span.outputs) if span.outputs else ""

                # Include LLM evaluation for span-level annotations if requested
                if include_llm_evaluation and span.eval_quality_score is not None:
                    row["llm_quality_score"] = span.eval_quality_score
                    row["llm_relevant"] = span.eval_relevant
                    row["llm_reasoning"] = span.eval_reasoning
                    row["llm_issues"] = (
                        json.dumps(span.eval_issues) if span.eval_issues else ""
                    )

        # Get annotations for this item
        annotations = (
            db.query(Annotation)
            .filter(
                Annotation.object_type == item.object_type,
                Annotation.object_id == item.object_id,
            )
            .all()
        )

        # Add annotation scores as columns
        for ann in annotations:
            config = config_map.get(ann.score_config_id)
            if config:
                col_name = f"score_{config.name.lower().replace(' ', '_')}"
                row[col_name] = ann.value
                if ann.string_value:
                    row[f"{col_name}_label"] = ann.string_value
                if ann.comment:
                    row[f"comment_{config.name.lower().replace(' ', '_')}"] = (
                        ann.comment
                    )

        row["completed_at"] = item.completed_at.isoformat() if item.completed_at else ""
        row["completed_by"] = item.completed_by or ""

        export_data.append(row)

    # Sanitize queue name for filename
    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in queue.name)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Generate response based on format
    if format == "jsonl":
        output = io.StringIO()
        for row in export_data:
            output.write(json.dumps(row, ensure_ascii=False) + "\n")
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="application/x-ndjson",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_name}_{timestamp}.jsonl"'
            },
        )

    elif format == "csv":
        output = io.StringIO()
        if export_data:
            # Collect all possible fieldnames from all rows
            all_fields = set()
            for row in export_data:
                all_fields.update(row.keys())
            fieldnames = sorted(all_fields)

            writer = csv.DictWriter(
                output, fieldnames=fieldnames, extrasaction="ignore"
            )
            writer.writeheader()
            writer.writerows(export_data)
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_name}_{timestamp}.csv"'
            },
        )

    elif format == "parquet":
        try:
            import pandas as pd
        except ImportError:
            raise HTTPException(
                status_code=400,
                detail="Parquet export requires pandas. Install with: pip install pandas pyarrow",
            )

        df = pd.DataFrame(export_data)
        output = io.BytesIO()
        df.to_parquet(output, index=False)
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_name}_{timestamp}.parquet"'
            },
        )

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format: {format}. Use csv, jsonl, or parquet.",
        )
