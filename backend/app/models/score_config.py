"""
Score Configuration model for defining annotation scoring criteria.

Similar to Langfuse's Score Configs, this defines the scoring dimensions
that annotators use when reviewing traces/spans.
"""

from sqlalchemy import Column, String, DateTime, Text, Float, Integer, JSON, Boolean
from sqlalchemy.sql import func
from app.database import Base
import uuid


class ScoreConfig(Base):
    """
    Defines a scoring configuration for human annotation.

    Supports three data types:
    - categorical: Discrete values with labels (e.g., Poor/Fair/Good/Excellent)
    - numerical: Continuous values within a range (e.g., 0-100)
    - binary: Yes/No or True/False
    """
    __tablename__ = "score_configs"

    # Primary Key
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # Basic Info
    name = Column(String(100), nullable=False)  # e.g., "Accuracy", "Helpfulness", "Relevance"
    description = Column(Text, nullable=True)

    # Data Type Configuration
    data_type = Column(String(20), nullable=False, default="numerical")  # categorical, numerical, binary

    # For categorical type: list of {value: int, label: str}
    # e.g., [{"value": 1, "label": "Poor"}, {"value": 2, "label": "Fair"}, ...]
    categories = Column(JSON, nullable=True)

    # For numerical type: min/max range
    min_value = Column(Float, nullable=True, default=0.0)
    max_value = Column(Float, nullable=True, default=1.0)

    # For binary type: labels for true/false
    # e.g., {"true_label": "Yes", "false_label": "No"}
    binary_labels = Column(JSON, nullable=True)

    # Annotation level: what can this score be applied to?
    # Options: "trace", "span", "both"
    annotation_level = Column(String(20), nullable=False, default="both")

    # Status
    is_archived = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<ScoreConfig(id={self.id}, name={self.name}, type={self.data_type})>"
