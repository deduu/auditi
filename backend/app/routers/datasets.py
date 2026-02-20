# Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
"""
API router for Datasets feature.

Provides endpoints for:
- Dataset CRUD operations
- Dataset Item CRUD operations
- Publishing from Annotation Queues
- Export functionality
"""

import uuid
import io
import json
import csv
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional

logger = logging.getLogger(__name__)

from ..database import get_db
from ..dependencies import get_current_user
from ..models.dataset import Dataset, DatasetItem
from ..models.annotation_queue import AnnotationQueue, AnnotationQueueItem
from ..models.annotation import Annotation
from ..models.score_config import ScoreConfig
from ..models.trace import Trace
from ..models.span import Span
from ..schemas.dataset import (
    DatasetCreate,
    DatasetUpdate,
    DatasetResponse,
    DatasetListResponse,
    DatasetItemCreate,
    DatasetItemUpdate,
    DatasetItemResponse,
    DatasetItemListResponse,
    BulkDatasetItemCreate,
    PublishFromQueueRequest,
    PublishFromQueueResponse,
    DatasetStats,
    ChatGPTImportFilterConfig,
    ChatGPTImportPreviewResponse,
    ChatGPTImportCommitRequest,
    ChatGPTImportCommitResponse,
)
from ..services.chatgpt_parser import (
    extract_conversations_json,
    parse_conversations,
    ChatGPTImportConfig,
)

router = APIRouter(
    prefix="/datasets",
    tags=["datasets"],
    dependencies=[Depends(get_current_user)],
)


# =============================================================================
# Dataset CRUD Endpoints
# =============================================================================


@router.get("", response_model=DatasetListResponse)
def list_datasets(
    include_archived: bool = Query(False, description="Include archived datasets"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name"),
    db: Session = Depends(get_db),
):
    """List all datasets with pagination."""
    query = db.query(Dataset)

    if not include_archived:
        query = query.filter(Dataset.is_archived == False)

    if search:
        query = query.filter(Dataset.name.ilike(f"%{search}%"))

    total = query.count()
    datasets = (
        query.order_by(Dataset.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return DatasetListResponse(
        datasets=[DatasetResponse.model_validate(d) for d in datasets],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=DatasetResponse, status_code=201)
def create_dataset(
    dataset: DatasetCreate,
    db: Session = Depends(get_db),
):
    """Create a new empty dataset."""
    # Check for duplicate name (exclude archived datasets)
    existing = (
        db.query(Dataset)
        .filter(Dataset.name == dataset.name, Dataset.is_archived == False)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400, detail=f"Dataset with name '{dataset.name}' already exists"
        )

    db_dataset = Dataset(
        id=str(uuid.uuid4()),
        name=dataset.name,
        description=dataset.description,
        meta=dataset.metadata,
        source_type="manual",
        input_schema=dataset.input_schema,
        expected_output_schema=dataset.expected_output_schema,
    )
    db.add(db_dataset)
    db.commit()
    db.refresh(db_dataset)
    return db_dataset


@router.get("/{dataset_id}", response_model=DatasetResponse)
def get_dataset(dataset_id: str, db: Session = Depends(get_db)):
    """Get a specific dataset."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset


@router.put("/{dataset_id}", response_model=DatasetResponse)
def update_dataset(
    dataset_id: str,
    update: DatasetUpdate,
    db: Session = Depends(get_db),
):
    """Update a dataset."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    update_data = update.model_dump(exclude_unset=True)

    # Check name uniqueness if being changed (exclude archived datasets)
    if "name" in update_data and update_data["name"] != dataset.name:
        existing = (
            db.query(Dataset)
            .filter(Dataset.name == update_data["name"], Dataset.is_archived == False)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Dataset with name '{update_data['name']}' already exists",
            )

    # Remap metadata to meta for the model
    if "metadata" in update_data:
        update_data["meta"] = update_data.pop("metadata")

    for key, value in update_data.items():
        setattr(dataset, key, value)

    db.commit()
    db.refresh(dataset)
    return dataset


@router.delete("/{dataset_id}")
def delete_dataset(dataset_id: str, db: Session = Depends(get_db)):
    """Archive a dataset (soft delete)."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    dataset.is_archived = True
    db.commit()
    return {"message": "Dataset archived"}


@router.get("/{dataset_id}/stats", response_model=DatasetStats)
def get_dataset_stats(dataset_id: str, db: Session = Depends(get_db)):
    """Get statistics for a dataset."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    items_query = db.query(DatasetItem).filter(DatasetItem.dataset_id == dataset_id)

    total = items_query.count()
    active = items_query.filter(DatasetItem.status == "active").count()
    archived = items_query.filter(DatasetItem.status == "archived").count()
    with_output = items_query.filter(DatasetItem.expected_output != None).count()
    from_traces = items_query.filter(DatasetItem.source_trace_id != None).count()
    from_spans = items_query.filter(DatasetItem.source_span_id != None).count()

    return DatasetStats(
        total_items=total,
        active_items=active,
        archived_items=archived,
        items_with_expected_output=with_output,
        items_from_traces=from_traces,
        items_from_spans=from_spans,
        created_at=dataset.created_at,
        last_updated=dataset.updated_at,
    )


# =============================================================================
# Dataset Item Endpoints
# =============================================================================


@router.get("/{dataset_id}/items", response_model=DatasetItemListResponse)
def list_dataset_items(
    dataset_id: str,
    include_archived: bool = Query(False, description="Include archived items"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List items in a dataset with pagination."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    query = db.query(DatasetItem).filter(DatasetItem.dataset_id == dataset_id)

    if not include_archived:
        query = query.filter(DatasetItem.status == "active")

    total = query.count()
    items = (
        query.order_by(DatasetItem.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return DatasetItemListResponse(
        items=[DatasetItemResponse.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/{dataset_id}/items", response_model=DatasetItemResponse, status_code=201)
def create_dataset_item(
    dataset_id: str,
    item: DatasetItemCreate,
    db: Session = Depends(get_db),
):
    """Add a new item to a dataset."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Increment version
    dataset.version += 1
    dataset.item_count += 1

    db_item = DatasetItem(
        id=str(uuid.uuid4()),
        dataset_id=dataset_id,
        input=item.input,
        expected_output=item.expected_output,
        meta=item.metadata,
        source_trace_id=item.source_trace_id,
        source_span_id=item.source_span_id,
        version_added=dataset.version,
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


@router.post(
    "/{dataset_id}/items/bulk",
    response_model=List[DatasetItemResponse],
    status_code=201,
)
def create_bulk_dataset_items(
    dataset_id: str,
    bulk: BulkDatasetItemCreate,
    db: Session = Depends(get_db),
):
    """Add multiple items to a dataset at once."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Increment version once for the batch
    dataset.version += 1

    created_items = []
    for item in bulk.items:
        db_item = DatasetItem(
            id=str(uuid.uuid4()),
            dataset_id=dataset_id,
            input=item.input,
            expected_output=item.expected_output,
            meta=item.metadata,
            source_trace_id=item.source_trace_id,
            source_span_id=item.source_span_id,
            version_added=dataset.version,
        )
        db.add(db_item)
        created_items.append(db_item)

    dataset.item_count += len(created_items)
    db.commit()

    for item in created_items:
        db.refresh(item)

    return created_items


@router.get("/{dataset_id}/items/{item_id}", response_model=DatasetItemResponse)
def get_dataset_item(
    dataset_id: str,
    item_id: str,
    db: Session = Depends(get_db),
):
    """Get a specific dataset item."""
    item = (
        db.query(DatasetItem)
        .filter(
            DatasetItem.id == item_id,
            DatasetItem.dataset_id == dataset_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Dataset item not found")
    return item


@router.put("/{dataset_id}/items/{item_id}", response_model=DatasetItemResponse)
def update_dataset_item(
    dataset_id: str,
    item_id: str,
    update: DatasetItemUpdate,
    db: Session = Depends(get_db),
):
    """Update a dataset item."""
    item = (
        db.query(DatasetItem)
        .filter(
            DatasetItem.id == item_id,
            DatasetItem.dataset_id == dataset_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Dataset item not found")

    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()

    update_data = update.model_dump(exclude_unset=True)

    # Remap metadata to meta for the model
    if "metadata" in update_data:
        update_data["meta"] = update_data.pop("metadata")

    for key, value in update_data.items():
        setattr(item, key, value)

    # Increment dataset version on item update
    dataset.version += 1

    db.commit()
    db.refresh(item)
    return item


@router.delete("/{dataset_id}/items/{item_id}")
def delete_dataset_item(
    dataset_id: str,
    item_id: str,
    db: Session = Depends(get_db),
):
    """Archive a dataset item (soft delete)."""
    item = (
        db.query(DatasetItem)
        .filter(
            DatasetItem.id == item_id,
            DatasetItem.dataset_id == dataset_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Dataset item not found")

    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()

    item.status = "archived"
    dataset.version += 1
    dataset.item_count = max(0, dataset.item_count - 1)

    db.commit()
    return {"message": "Dataset item archived"}


# =============================================================================
# Publish from Annotation Queue
# =============================================================================


@router.post("/publish-from-queue/{queue_id}", response_model=PublishFromQueueResponse)
def publish_from_annotation_queue(
    queue_id: str,
    request: PublishFromQueueRequest,
    db: Session = Depends(get_db),
):
    """
    Publish completed annotations from a queue to a new dataset.

    This creates a persistent, versioned dataset from annotation work.
    """
    # Validate queue exists
    queue = db.query(AnnotationQueue).filter(AnnotationQueue.id == queue_id).first()
    if not queue:
        raise HTTPException(status_code=404, detail="Annotation queue not found")

    # Check for duplicate dataset name (exclude archived datasets)
    existing = (
        db.query(Dataset)
        .filter(Dataset.name == request.dataset_name, Dataset.is_archived == False)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Dataset with name '{request.dataset_name}' already exists",
        )

    # Get completed items from queue
    items_query = db.query(AnnotationQueueItem).filter(
        AnnotationQueueItem.queue_id == queue_id,
    )

    if request.only_completed:
        items_query = items_query.filter(AnnotationQueueItem.status == "completed")
    else:
        items_query = items_query.filter(
            AnnotationQueueItem.status.in_(["completed", "skipped"])
        )

    queue_items = items_query.order_by(AnnotationQueueItem.position).all()

    if not queue_items:
        raise HTTPException(
            status_code=400, detail="No completed items in queue to publish"
        )

    # Get score configs for annotation labels
    score_configs = (
        db.query(ScoreConfig)
        .filter(ScoreConfig.id.in_(queue.score_config_ids or []))
        .all()
    )
    config_map = {c.id: c for c in score_configs}

    # Create the dataset
    db_dataset = Dataset(
        id=str(uuid.uuid4()),
        name=request.dataset_name,
        description=request.description
        or f"Published from annotation queue: {queue.name}",
        source_type="annotation_queue",
        source_id=queue_id,
        meta={
            "source_queue_name": queue.name,
            "published_at": datetime.now(timezone.utc).isoformat(),
            "score_configs": [c.name for c in score_configs],
        },
    )
    db.add(db_dataset)

    # Create dataset items from queue items
    items_created = 0
    for queue_item in queue_items:
        input_data = {}
        expected_output = {}
        item_metadata = {}
        annotations_data = {}

        if queue_item.object_type == "trace":
            trace = db.query(Trace).filter(Trace.id == queue_item.object_id).first()
            if trace:
                # Build input
                input_data = {
                    "user_input": trace.user_input or "",
                    "model_name": trace.model_name or "",
                }

                # Build expected output (assistant response + annotations as ground truth)
                expected_output = {
                    "assistant_output": trace.assistant_output or "",
                }

                # Add metadata
                item_metadata = {
                    "latency": trace.latency,
                    "status": trace.status,
                    "original_score": trace.score,
                    "completed_at": (
                        queue_item.completed_at.isoformat()
                        if queue_item.completed_at
                        else None
                    ),
                }

                # Include execution path if requested
                if request.include_execution_path and trace.spans:
                    spans_data = []
                    for span in sorted(
                        trace.spans, key=lambda s: (s.start_time or datetime.min)
                    ):
                        span_info = {
                            "id": span.id,
                            "name": span.name,
                            "type": span.span_type,
                            "model": span.model,
                            "inputs": span.inputs,
                            "outputs": span.outputs,
                            "tokens": span.tokens or 0,
                            "cost": span.cost or 0.0,
                            "status": span.status or "ok",
                        }

                        if (
                            request.include_llm_evaluation
                            and span.eval_quality_score is not None
                        ):
                            span_info["llm_evaluation"] = {
                                "quality_score": span.eval_quality_score,
                                "relevant": span.eval_relevant,
                                "reasoning": span.eval_reasoning,
                                "issues": span.eval_issues,
                            }

                        spans_data.append(span_info)

                    item_metadata["execution_path"] = spans_data

        elif queue_item.object_type == "span":
            span = db.query(Span).filter(Span.id == queue_item.object_id).first()
            if span:
                input_data = {
                    "span_name": span.name or "",
                    "span_type": span.span_type or "",
                    "inputs": span.inputs,
                }
                expected_output = {
                    "outputs": span.outputs,
                }
                item_metadata = {
                    "model": span.model,
                    "tokens": span.tokens,
                    "cost": span.cost,
                }

                if (
                    request.include_llm_evaluation
                    and span.eval_quality_score is not None
                ):
                    item_metadata["llm_evaluation"] = {
                        "quality_score": span.eval_quality_score,
                        "relevant": span.eval_relevant,
                        "reasoning": span.eval_reasoning,
                        "issues": span.eval_issues,
                    }

        # Get annotations for this item
        annotations = (
            db.query(Annotation)
            .filter(
                Annotation.object_type == queue_item.object_type,
                Annotation.object_id == queue_item.object_id,
            )
            .all()
        )

        for ann in annotations:
            config = config_map.get(ann.score_config_id)
            if config:
                score_name = config.name.lower().replace(" ", "_")
                annotations_data[score_name] = {
                    "value": ann.value,
                    "label": ann.string_value,
                    "comment": ann.comment,
                    "data_type": config.data_type,
                }
                # Add annotation values to expected_output for training
                expected_output[f"score_{score_name}"] = ann.value
                if ann.string_value:
                    expected_output[f"label_{score_name}"] = ann.string_value

        # Create dataset item
        db_item = DatasetItem(
            id=str(uuid.uuid4()),
            dataset_id=db_dataset.id,
            input=input_data,
            expected_output=expected_output if expected_output else None,
            meta=item_metadata if item_metadata else None,
            source_trace_id=(
                queue_item.object_id if queue_item.object_type == "trace" else None
            ),
            source_span_id=(
                queue_item.object_id if queue_item.object_type == "span" else None
            ),
            annotations=annotations_data if annotations_data else None,
            version_added=1,
        )
        db.add(db_item)
        items_created += 1

    # Update dataset item count
    db_dataset.item_count = items_created

    db.commit()
    db.refresh(db_dataset)

    logger.info(
        f"Published {items_created} items from queue '{queue.name}' to dataset '{request.dataset_name}'"
    )

    return PublishFromQueueResponse(
        dataset_id=db_dataset.id,
        dataset_name=db_dataset.name,
        items_created=items_created,
        version=db_dataset.version,
        message=f"Successfully published {items_created} items to dataset '{request.dataset_name}'",
    )


# =============================================================================
# ChatGPT Import Endpoints
# =============================================================================


def _iso_to_timestamp(iso_str: Optional[str]) -> Optional[float]:
    """Convert an ISO date string to Unix timestamp, or return None."""
    if not iso_str:
        return None
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return dt.timestamp()
    except ValueError:
        return None


@router.post("/import/chatgpt/preview", response_model=ChatGPTImportPreviewResponse)
async def preview_chatgpt_import(
    file: UploadFile = File(
        ..., description="ChatGPT export ZIP or conversations.json"
    ),
    config: str = Form("{}", description="JSON string of filter config"),
):
    """
    Preview a ChatGPT data export before importing.

    Accepts either a ZIP file (ChatGPT data export) or a raw conversations.json file.
    Returns statistics and sample items without creating any database records.
    """
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413, detail="File too large. Maximum size is 50MB."
        )

    # Parse filter config from JSON string
    try:
        filter_dict = json.loads(config)
        filter_config = ChatGPTImportFilterConfig(**filter_dict)
    except (json.JSONDecodeError, Exception) as e:
        raise HTTPException(status_code=400, detail=f"Invalid filter config: {e}")

    # Convert ISO dates to Unix timestamps
    import_config = ChatGPTImportConfig(
        skip_system_messages=filter_config.skip_system_messages,
        model_filter=filter_config.model_filter,
        date_from=_iso_to_timestamp(filter_config.date_from),
        date_to=_iso_to_timestamp(filter_config.date_to),
        min_message_length=filter_config.min_message_length,
        max_conversations=filter_config.max_conversations,
    )

    # Extract and parse
    try:
        conversations_data = extract_conversations_json(contents)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        result = parse_conversations(conversations_data, import_config)
    except Exception as e:
        logger.error(f"Failed to parse ChatGPT export: {e}", exc_info=True)
        raise HTTPException(
            status_code=400, detail=f"Failed to parse conversations: {e}"
        )

    # Collect unique model slugs
    model_slugs = set()
    for conv in result.conversations:
        if conv.model_slug:
            model_slugs.add(conv.model_slug)

    # Determine date range
    date_range = None
    create_times = [c.created_at for c in result.conversations if c.created_at]
    if create_times:
        earliest = datetime.fromtimestamp(min(create_times), tz=timezone.utc)
        latest = datetime.fromtimestamp(max(create_times), tz=timezone.utc)
        date_range = {
            "earliest": earliest.isoformat(),
            "latest": latest.isoformat(),
        }

    return ChatGPTImportPreviewResponse(
        total_conversations_in_file=result.total_conversations_in_file,
        filtered_conversations=result.filtered_conversations,
        total_items=result.total_items,
        skipped_reasons=result.skipped_reasons,
        sample_items=[item.model_dump() for item in result.sample_items],
        model_slugs_found=sorted(model_slugs),
        date_range=date_range,
    )


@router.post("/import/chatgpt/commit", response_model=ChatGPTImportCommitResponse)
async def commit_chatgpt_import(
    file: UploadFile = File(
        ..., description="ChatGPT export ZIP or conversations.json"
    ),
    config: str = Form(..., description="JSON string of import config with dataset_name"),
    db: Session = Depends(get_db),
):
    """
    Import ChatGPT conversations and create a new dataset.

    Re-parses the file with the provided config and creates the Dataset + DatasetItems.
    """
    MAX_FILE_SIZE = 50 * 1024 * 1024
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413, detail="File too large. Maximum size is 50MB."
        )

    # Parse commit config
    try:
        config_dict = json.loads(config)
        commit_config = ChatGPTImportCommitRequest(**config_dict)
    except (json.JSONDecodeError, Exception) as e:
        raise HTTPException(status_code=400, detail=f"Invalid config: {e}")

    # Check for duplicate dataset name
    existing = (
        db.query(Dataset)
        .filter(
            Dataset.name == commit_config.dataset_name, Dataset.is_archived == False
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Dataset with name '{commit_config.dataset_name}' already exists",
        )

    # Build parser config
    import_config = ChatGPTImportConfig(
        skip_system_messages=commit_config.skip_system_messages,
        model_filter=commit_config.model_filter,
        date_from=_iso_to_timestamp(commit_config.date_from),
        date_to=_iso_to_timestamp(commit_config.date_to),
        min_message_length=commit_config.min_message_length,
        max_conversations=commit_config.max_conversations,
    )

    # Extract and parse
    try:
        conversations_data = extract_conversations_json(contents)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        result = parse_conversations(conversations_data, import_config)
    except Exception as e:
        logger.error(f"Failed to parse ChatGPT export: {e}", exc_info=True)
        raise HTTPException(
            status_code=400, detail=f"Failed to parse conversations: {e}"
        )

    if result.total_items == 0:
        raise HTTPException(
            status_code=400,
            detail="No valid conversation pairs found with the given filters.",
        )

    # Create dataset
    db_dataset = Dataset(
        id=str(uuid.uuid4()),
        name=commit_config.dataset_name,
        description=commit_config.description
        or f"Imported from ChatGPT export ({result.filtered_conversations} conversations)",
        source_type="chatgpt_import",
        meta={
            "import_source": "chatgpt_export",
            "total_conversations_in_file": result.total_conversations_in_file,
            "filtered_conversations": result.filtered_conversations,
            "skipped_reasons": result.skipped_reasons,
            "model_slugs": list(
                {c.model_slug for c in result.conversations if c.model_slug}
            ),
            "imported_at": datetime.now(timezone.utc).isoformat(),
            "filters_applied": import_config.model_dump(),
        },
    )
    db.add(db_dataset)

    # Create dataset items in batch
    items_created = 0
    for conv in result.conversations:
        for item in conv.items:
            db_item = DatasetItem(
                id=str(uuid.uuid4()),
                dataset_id=db_dataset.id,
                input=item.input,
                expected_output=item.expected_output,
                meta=item.metadata,
                version_added=1,
            )
            db.add(db_item)
            items_created += 1

    db_dataset.item_count = items_created

    db.commit()
    db.refresh(db_dataset)

    logger.info(
        f"Imported {items_created} items from ChatGPT export into dataset '{commit_config.dataset_name}'"
    )

    return ChatGPTImportCommitResponse(
        dataset_id=db_dataset.id,
        dataset_name=db_dataset.name,
        items_created=items_created,
        conversations_imported=result.filtered_conversations,
        version=db_dataset.version,
        message=f"Successfully imported {items_created} items from {result.filtered_conversations} conversations",
    )


# =============================================================================
# Export Endpoints
# =============================================================================


@router.get("/{dataset_id}/export")
def export_dataset(
    dataset_id: str,
    format: str = Query("jsonl", description="Export format: csv, jsonl, or parquet"),
    include_archived: bool = Query(False, description="Include archived items"),
    db: Session = Depends(get_db),
):
    """
    Export dataset items.

    Supported formats:
    - jsonl: JSON Lines format (recommended for fine-tuning)
    - csv: Standard CSV format
    - parquet: Apache Parquet format (requires pandas)
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    query = db.query(DatasetItem).filter(DatasetItem.dataset_id == dataset_id)

    if not include_archived:
        query = query.filter(DatasetItem.status == "active")

    items = query.order_by(DatasetItem.created_at).all()

    if not items:
        raise HTTPException(status_code=400, detail="No items to export")

    # Build export data
    export_data = []
    for item in items:
        row = {
            "id": item.id,
            "input": item.input,
            "expected_output": item.expected_output,
            "metadata": item.meta,
            "source_trace_id": item.source_trace_id,
            "source_span_id": item.source_span_id,
            "annotations": item.annotations,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
        export_data.append(row)

    # Sanitize name for filename
    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in dataset.name)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    if format == "jsonl":
        output = io.StringIO()
        for row in export_data:
            output.write(json.dumps(row, ensure_ascii=False, default=str) + "\n")
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="application/x-ndjson",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_name}_v{dataset.version}_{timestamp}.jsonl"'
            },
        )

    elif format == "csv":
        output = io.StringIO()
        # Flatten nested fields for CSV
        flat_data = []
        for row in export_data:
            flat_row = {
                "id": row["id"],
                "input_json": (
                    json.dumps(row["input"], ensure_ascii=False) if row["input"] else ""
                ),
                "expected_output_json": (
                    json.dumps(row["expected_output"], ensure_ascii=False)
                    if row["expected_output"]
                    else ""
                ),
                "metadata_json": (
                    json.dumps(row["metadata"], ensure_ascii=False)
                    if row["metadata"]
                    else ""
                ),
                "source_trace_id": row["source_trace_id"] or "",
                "source_span_id": row["source_span_id"] or "",
                "annotations_json": (
                    json.dumps(row["annotations"], ensure_ascii=False)
                    if row["annotations"]
                    else ""
                ),
                "created_at": row["created_at"] or "",
            }
            flat_data.append(flat_row)

        if flat_data:
            fieldnames = list(flat_data[0].keys())
            writer = csv.DictWriter(output, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(flat_data)

        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_name}_v{dataset.version}_{timestamp}.csv"'
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
                "Content-Disposition": f'attachment; filename="{safe_name}_v{dataset.version}_{timestamp}.parquet"'
            },
        )

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format: {format}. Use csv, jsonl, or parquet.",
        )
