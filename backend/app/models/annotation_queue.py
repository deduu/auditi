"""
Annotation Queue models for managing human review workflows.

Similar to Langfuse's Annotation Queues, this provides:
- Queue management for organizing annotation tasks
- FIFO processing with concurrency safety
- Assignment of annotators to queues
"""

from sqlalchemy import Column, String, DateTime, Text, Integer, JSON, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import uuid


class AnnotationQueue(Base):
    """
    Represents an annotation queue for organizing review tasks.

    Queues allow teams to:
    - Organize traces/spans for review by category
    - Assign specific score configs to use
    - Assign annotators to specific queues
    """
    __tablename__ = "annotation_queues"

    # Primary Key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Basic Info
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)

    # Configuration
    # List of score_config_ids to use for this queue
    score_config_ids = Column(JSON, nullable=False, default=list)

    # List of user_ids who can annotate this queue (empty = all users)
    assigned_user_ids = Column(JSON, nullable=True)

    # Queue statistics (denormalized for performance)
    total_items = Column(Integer, default=0)
    completed_items = Column(Integer, default=0)

    # Status
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    items = relationship("AnnotationQueueItem", back_populates="queue", lazy="dynamic")

    def __repr__(self):
        return f"<AnnotationQueue(id={self.id}, name={self.name})>"


class AnnotationQueueItem(Base):
    """
    Represents an item in an annotation queue.

    Items can be traces or spans that need human review.
    Supports:
    - FIFO ordering
    - Locking for concurrency safety
    - Status tracking (pending -> in_progress -> completed)
    """
    __tablename__ = "annotation_queue_items"

    # Primary Key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Queue relationship
    queue_id = Column(String(36), ForeignKey("annotation_queues.id"), nullable=False)

    # What to annotate
    object_type = Column(String(20), nullable=False)  # "trace" or "span"
    object_id = Column(String(36), nullable=False)  # trace_id or span_id

    # Queue position (for FIFO ordering)
    position = Column(Integer, nullable=False, default=0)

    # Status: pending, in_progress, completed, skipped
    status = Column(String(20), nullable=False, default="pending")

    # Concurrency control: who has locked this item
    locked_by = Column(String(36), nullable=True)  # user_id
    locked_at = Column(DateTime(timezone=True), nullable=True)

    # Completion tracking
    completed_by = Column(String(36), nullable=True)  # user_id
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    queue = relationship("AnnotationQueue", back_populates="items")

    def __repr__(self):
        return f"<AnnotationQueueItem(id={self.id}, queue_id={self.queue_id}, status={self.status})>"
