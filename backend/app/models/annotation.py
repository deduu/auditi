"""
Annotation model for storing human-provided scores and comments.

This is the core model that stores actual annotation data from human reviewers.
"""

from sqlalchemy import Column, String, DateTime, Text, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import uuid


class Annotation(Base):
    """
    Stores a human annotation score for a trace or span.

    Each annotation represents a single score dimension applied to an object.
    Multiple annotations can exist for the same object (one per score config).
    """
    __tablename__ = "annotations"

    # Primary Key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # What was annotated
    object_type = Column(String(20), nullable=False)  # "trace" or "span"
    object_id = Column(String(36), nullable=False)  # trace_id or span_id

    # Which score config was used
    score_config_id = Column(String(36), ForeignKey("score_configs.id"), nullable=False)

    # The score value
    # For numerical: the actual number
    # For categorical: the category value (integer)
    # For binary: 1.0 for true, 0.0 for false
    value = Column(Float, nullable=False)

    # For categorical: store the label as well for easier display
    string_value = Column(String(100), nullable=True)

    # Optional comment explaining the score
    comment = Column(Text, nullable=True)

    # Who annotated it
    annotator_id = Column(String(36), nullable=True)  # user_id, null for system
    annotator_name = Column(String(100), nullable=True)  # For display

    # Optional link to queue item (if annotation came from a queue)
    queue_item_id = Column(String(36), ForeignKey("annotation_queue_items.id"), nullable=True)

    # Source of annotation: "queue", "direct", "api"
    source = Column(String(20), nullable=False, default="direct")

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    score_config = relationship("ScoreConfig")

    def __repr__(self):
        return f"<Annotation(id={self.id}, object_type={self.object_type}, value={self.value})>"
