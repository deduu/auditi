"""
Dataset models for managing reusable test/evaluation datasets.

Similar to Langfuse's Datasets feature, this provides:
- Named, versioned collections of input/output pairs
- Support for creating datasets from annotation queues
- Linking items back to source traces/spans
"""

from sqlalchemy import Column, String, DateTime, Text, Integer, JSON, Boolean, ForeignKey, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import uuid


class Dataset(Base):
    """
    Represents a named dataset for evaluation and fine-tuning.

    Datasets can be created:
    - From completed annotation queues (published)
    - Manually via API
    - Via CSV/JSONL import
    """
    __tablename__ = "datasets"

    # Primary Key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Basic Info
    name = Column(String(200), nullable=False, unique=True)
    description = Column(Text, nullable=True)

    # Metadata (flexible JSON for additional info) - named 'meta' to avoid SQLAlchemy reserved name
    meta = Column(JSON, nullable=True)

    # Source tracking
    source_type = Column(String(50), nullable=False, default="manual")  # manual, annotation_queue, import
    source_id = Column(String(36), nullable=True)  # e.g., annotation_queue_id

    # Optional JSON Schema validation
    input_schema = Column(JSON, nullable=True)  # JSON Schema for input validation
    expected_output_schema = Column(JSON, nullable=True)  # JSON Schema for expected_output validation

    # Versioning (increments on any item change)
    version = Column(Integer, nullable=False, default=1)

    # Statistics (denormalized for performance)
    item_count = Column(Integer, nullable=False, default=0)

    # Status
    is_archived = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    items = relationship("DatasetItem", back_populates="dataset", lazy="dynamic")

    def __repr__(self):
        return f"<Dataset(id={self.id}, name={self.name}, version={self.version})>"


class DatasetItem(Base):
    """
    Represents a single item in a dataset.

    Each item contains:
    - input: The test input (e.g., user message, prompt)
    - expected_output: The expected/ideal output (ground truth)
    - metadata: Additional context about the item
    - Optional links to source traces/spans
    """
    __tablename__ = "dataset_items"

    # Primary Key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Dataset relationship
    dataset_id = Column(String(36), ForeignKey("datasets.id"), nullable=False)

    # Core data (following Langfuse's structure)
    input = Column(JSON, nullable=False)  # The test input
    expected_output = Column(JSON, nullable=True)  # Expected/ideal output (ground truth)
    meta = Column(JSON, nullable=True)  # Additional item metadata (named 'meta' to avoid SQLAlchemy reserved name)

    # Source linking (optional - tracks where this item came from)
    source_trace_id = Column(String(36), nullable=True)
    source_span_id = Column(String(36), nullable=True)

    # Annotation data (if created from annotation queue)
    annotations = Column(JSON, nullable=True)  # Scores and comments from annotation

    # Version tracking
    version_added = Column(Integer, nullable=False, default=1)  # Dataset version when item was added

    # Status
    status = Column(String(20), nullable=False, default="active")  # active, archived

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    dataset = relationship("Dataset", back_populates="items")

    def __repr__(self):
        return f"<DatasetItem(id={self.id}, dataset_id={self.dataset_id}, status={self.status})>"
