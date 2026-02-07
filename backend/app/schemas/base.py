from datetime import datetime, timezone
from typing import Annotated, Optional

from pydantic import BaseModel, ConfigDict, PlainSerializer


def _serialize_utc_datetime(v: Optional[datetime]) -> Optional[str]:
    """Serialize datetime to ISO format, treating naive datetimes as UTC."""
    if v is None:
        return None
    if v.tzinfo is None:
        v = v.replace(tzinfo=timezone.utc)
    return v.isoformat()


UTCDatetime = Annotated[datetime, PlainSerializer(_serialize_utc_datetime, return_type=Optional[str])]


class APIModel(BaseModel):
    """Base model for API schemas."""

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)
