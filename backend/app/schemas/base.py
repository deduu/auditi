from pydantic import BaseModel, ConfigDict


class APIModel(BaseModel):
    """Base model for API schemas."""

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)
