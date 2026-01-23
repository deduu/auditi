from pydantic import BaseModel

class APIModel(BaseModel):
    """Base model for API schemas."""

    class Config:
        populate_by_name = True
        from_attributes = True
