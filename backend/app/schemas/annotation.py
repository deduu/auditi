# Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
"""
Pydantic schemas for Human Annotation API.

Includes schemas for:
- Score Configurations
- Annotation Queues
- Annotations (scores)
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# =============================================================================
# Score Configuration Schemas
# =============================================================================


class CategoryOption(BaseModel):
    """A single category option for categorical scores."""

    value: int = Field(..., description="Numeric value of the category")
    label: str = Field(..., description="Display label for the category")


class BinaryLabels(BaseModel):
    """Labels for binary score type."""

    true_label: str = Field(default="Yes", description="Label for true/positive")
    false_label: str = Field(default="No", description="Label for false/negative")


class ScoreConfigBase(BaseModel):
    """Base schema for score configuration."""

    name: str = Field(
        ..., min_length=1, max_length=100, description="Name of the score config"
    )
    description: Optional[str] = Field(
        None, description="Description of what this score measures"
    )
    data_type: str = Field(
        default="numerical",
        description="Type of score: 'categorical', 'numerical', or 'binary'",
    )
    categories: Optional[List[CategoryOption]] = Field(
        None, description="Category options for categorical type"
    )
    min_value: Optional[float] = Field(
        0.0, description="Minimum value for numerical type"
    )
    max_value: Optional[float] = Field(
        1.0, description="Maximum value for numerical type"
    )
    binary_labels: Optional[BinaryLabels] = Field(
        None, description="Labels for binary type"
    )
    annotation_level: str = Field(
        default="both", description="What can be annotated: 'trace', 'span', or 'both'"
    )


class ScoreConfigCreate(ScoreConfigBase):
    """Schema for creating a new score configuration."""

    pass


class ScoreConfigUpdate(BaseModel):
    """Schema for updating a score configuration."""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    data_type: Optional[str] = None
    categories: Optional[List[CategoryOption]] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    binary_labels: Optional[BinaryLabels] = None
    annotation_level: Optional[str] = None
    is_archived: Optional[bool] = None


class ScoreConfigResponse(BaseModel):
    """Schema for score configuration response."""

    id: str
    name: str
    description: Optional[str] = None
    data_type: str
    categories: Optional[List[Dict[str, Any]]] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    binary_labels: Optional[Dict[str, str]] = None
    annotation_level: str
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# =============================================================================
# Annotation Queue Schemas
# =============================================================================


class AnnotationQueueBase(BaseModel):
    """Base schema for annotation queue."""

    name: str = Field(..., min_length=1, max_length=100, description="Queue name")
    description: Optional[str] = Field(None, description="Queue description")
    score_config_ids: List[str] = Field(
        default_factory=list,
        description="List of score config IDs to use for this queue",
    )
    assigned_user_ids: Optional[List[str]] = Field(
        None, description="List of user IDs who can annotate (None = all users)"
    )


class AnnotationQueueCreate(AnnotationQueueBase):
    """Schema for creating a new annotation queue."""

    pass


class AnnotationQueueUpdate(BaseModel):
    """Schema for updating an annotation queue."""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    score_config_ids: Optional[List[str]] = None
    assigned_user_ids: Optional[List[str]] = None
    is_active: Optional[bool] = None


class AnnotationQueueResponse(BaseModel):
    """Schema for annotation queue response."""

    id: str
    name: str
    description: Optional[str] = None
    score_config_ids: List[str]
    assigned_user_ids: Optional[List[str]] = None
    total_items: int
    completed_items: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AnnotationQueueWithStats(AnnotationQueueResponse):
    """Queue response with additional computed stats."""

    pending_items: int = 0
    in_progress_items: int = 0
    progress_percentage: float = 0.0


# =============================================================================
# Annotation Queue Item Schemas
# =============================================================================


class QueueItemBase(BaseModel):
    """Base schema for queue item."""

    object_type: str = Field(..., description="Type of object: 'trace' or 'span'")
    object_id: str = Field(..., description="ID of the trace or span")


class QueueItemAdd(BaseModel):
    """Schema for adding items to a queue."""

    items: List[QueueItemBase] = Field(..., min_length=1, description="Items to add")


class QueueItemResponse(BaseModel):
    """Schema for queue item response."""

    id: str
    queue_id: str
    object_type: str
    object_id: str
    position: int
    status: str
    locked_by: Optional[str] = None
    locked_at: Optional[datetime] = None
    completed_by: Optional[str] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class QueueItemWithData(QueueItemResponse):
    """Queue item with the actual trace/span data."""

    object_data: Optional[Dict[str, Any]] = None


class NextQueueItemResponse(BaseModel):
    """Response when getting the next item from queue."""

    item: Optional[QueueItemWithData] = None
    score_configs: List[ScoreConfigResponse] = []
    existing_annotations: List["AnnotationResponse"] = []
    queue_progress: Dict[str, int] = {}  # total, completed, remaining


# =============================================================================
# Annotation (Score) Schemas
# =============================================================================


class AnnotationBase(BaseModel):
    """Base schema for annotation."""

    object_type: str = Field(..., description="Type of object: 'trace' or 'span'")
    object_id: str = Field(..., description="ID of the trace or span")
    score_config_id: str = Field(..., description="ID of the score config used")
    value: float = Field(..., description="Score value")
    string_value: Optional[str] = Field(
        None, description="String representation (for categorical)"
    )
    comment: Optional[str] = Field(None, description="Optional comment")


class AnnotationCreate(AnnotationBase):
    """Schema for creating a new annotation."""

    source: str = Field(
        default="direct", description="Source: 'queue', 'direct', or 'api'"
    )
    queue_item_id: Optional[str] = Field(
        None, description="Queue item ID if from queue"
    )


class AnnotationUpdate(BaseModel):
    """Schema for updating an annotation."""

    value: Optional[float] = None
    string_value: Optional[str] = None
    comment: Optional[str] = None


class AnnotationResponse(BaseModel):
    """Schema for annotation response."""

    id: str
    object_type: str
    object_id: str
    score_config_id: str
    value: float
    string_value: Optional[str] = None
    comment: Optional[str] = None
    annotator_id: Optional[str] = None
    annotator_name: Optional[str] = None
    queue_item_id: Optional[str] = None
    source: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AnnotationWithConfig(AnnotationResponse):
    """Annotation with the score config details."""

    score_config: Optional[ScoreConfigResponse] = None


class BulkAnnotationCreate(BaseModel):
    """Schema for creating multiple annotations at once."""

    annotations: List[AnnotationCreate] = Field(..., min_length=1)


class AnnotationSummary(BaseModel):
    """Summary of annotations for an object."""

    object_type: str
    object_id: str
    total_annotations: int
    annotations: List[AnnotationWithConfig]
    average_score: Optional[float] = None


# =============================================================================
# Complete Queue Item (for annotation workflow)
# =============================================================================


class CompleteQueueItemRequest(BaseModel):
    """Request to complete a queue item with annotations."""

    annotations: List[AnnotationCreate] = Field(
        default_factory=list,
        description="Annotations to save (can be empty if skipping)",
    )
    skip: bool = Field(default=False, description="Whether to skip this item")


# Update forward references
NextQueueItemResponse.model_rebuild()
