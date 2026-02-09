# Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
"""
Pydantic schemas for Dataset API.

Includes schemas for:
- Datasets (CRUD)
- Dataset Items (CRUD)
- Publishing from Annotation Queues
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# =============================================================================
# Dataset Schemas
# =============================================================================


class DatasetBase(BaseModel):
    """Base schema for dataset."""

    name: str = Field(
        ..., min_length=1, max_length=200, description="Unique dataset name"
    )
    description: Optional[str] = Field(None, description="Dataset description")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


class DatasetCreate(DatasetBase):
    """Schema for creating a new dataset."""

    input_schema: Optional[Dict[str, Any]] = Field(
        None, description="JSON Schema for input validation"
    )
    expected_output_schema: Optional[Dict[str, Any]] = Field(
        None, description="JSON Schema for expected_output validation"
    )


class DatasetUpdate(BaseModel):
    """Schema for updating a dataset."""

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    input_schema: Optional[Dict[str, Any]] = None
    expected_output_schema: Optional[Dict[str, Any]] = None
    is_archived: Optional[bool] = None


class DatasetResponse(BaseModel):
    """Schema for dataset response."""

    id: str
    name: str
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = Field(None, validation_alias="meta")
    source_type: str
    source_id: Optional[str] = None
    input_schema: Optional[Dict[str, Any]] = None
    expected_output_schema: Optional[Dict[str, Any]] = None
    version: int
    item_count: int
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True


class DatasetListResponse(BaseModel):
    """Schema for listing datasets with pagination."""

    datasets: List[DatasetResponse]
    total: int
    page: int
    page_size: int


# =============================================================================
# Dataset Item Schemas
# =============================================================================


class DatasetItemBase(BaseModel):
    """Base schema for dataset item."""

    input: Dict[str, Any] = Field(..., description="The test input data")
    expected_output: Optional[Dict[str, Any]] = Field(
        None, description="Expected/ideal output (ground truth)"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        None, description="Additional item metadata"
    )


class DatasetItemCreate(DatasetItemBase):
    """Schema for creating a new dataset item."""

    source_trace_id: Optional[str] = Field(
        None, description="Source trace ID if linked"
    )
    source_span_id: Optional[str] = Field(None, description="Source span ID if linked")


class DatasetItemUpdate(BaseModel):
    """Schema for updating a dataset item."""

    input: Optional[Dict[str, Any]] = None
    expected_output: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None
    status: Optional[str] = Field(None, description="active or archived")


class DatasetItemResponse(BaseModel):
    """Schema for dataset item response."""

    id: str
    dataset_id: str
    input: Dict[str, Any]
    expected_output: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = Field(None, validation_alias="meta")
    source_trace_id: Optional[str] = None
    source_span_id: Optional[str] = None
    annotations: Optional[Dict[str, Any]] = None
    version_added: int
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True


class DatasetItemListResponse(BaseModel):
    """Schema for listing dataset items with pagination."""

    items: List[DatasetItemResponse]
    total: int
    page: int
    page_size: int


class BulkDatasetItemCreate(BaseModel):
    """Schema for creating multiple dataset items at once."""

    items: List[DatasetItemCreate] = Field(..., min_length=1)


# =============================================================================
# Publish from Annotation Queue Schemas
# =============================================================================


class PublishFromQueueRequest(BaseModel):
    """Schema for publishing annotation queue to dataset."""

    dataset_name: str = Field(
        ..., min_length=1, max_length=200, description="Name for the new dataset"
    )
    description: Optional[str] = Field(None, description="Dataset description")
    include_execution_path: bool = Field(
        False, description="Include spans/execution path in metadata"
    )
    include_llm_evaluation: bool = Field(
        False, description="Include LLM evaluation data"
    )
    only_completed: bool = Field(
        True, description="Only include completed items (not skipped)"
    )


class PublishFromQueueResponse(BaseModel):
    """Response after publishing annotation queue to dataset."""

    dataset_id: str
    dataset_name: str
    items_created: int
    version: int
    message: str


# =============================================================================
# Dataset Version History
# =============================================================================


class DatasetVersionInfo(BaseModel):
    """Information about a dataset version."""

    version: int
    item_count: int
    timestamp: datetime
    change_type: str  # created, item_added, item_updated, item_archived


# =============================================================================
# Dataset Statistics
# =============================================================================


class DatasetStats(BaseModel):
    """Statistics for a dataset."""

    total_items: int
    active_items: int
    archived_items: int
    items_with_expected_output: int
    items_from_traces: int
    items_from_spans: int
    avg_input_length: Optional[float] = None
    created_at: datetime
    last_updated: datetime
