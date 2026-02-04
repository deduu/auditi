"""Action model for tracking recommended improvements."""

from sqlalchemy import Column, String, Text, DateTime
from app.database import Base


class Action(Base):
    """
    Represents a recommended action/improvement based on analysis.
    """

    __tablename__ = "actions"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(String, default="medium")  # high, medium, low
    status = Column(String, default="pending")  # pending, in_progress, completed
    category = Column(String, nullable=True)

    # Resolution Tracking
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String, nullable=True)
    resolution_notes = Column(Text, nullable=True)
