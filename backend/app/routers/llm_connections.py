"""
API router for LLM connections.
"""

import uuid
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models.llm_connection import LLMConnection
from ..schemas.llm_connection import (
    LLMConnectionCreate,
    LLMConnectionUpdate,
    LLMConnectionResponse,
    DefaultModelConfig,
    DefaultModelResponse,
)

router = APIRouter(
    prefix="/llm-connections",
    tags=["llm-connections"],
)


@router.get("", response_model=List[LLMConnectionResponse])
def list_connections(db: Session = Depends(get_db)):
    """List all LLM connections."""
    connections = (
        db.query(LLMConnection).order_by(LLMConnection.created_at.desc()).all()
    )
    return [
        LLMConnectionResponse(
            id=c.id,
            provider=c.provider,
            name=c.name,
            base_url=c.base_url,
            custom_model_name=c.custom_model_name,
            is_default=c.is_default,
            default_model=c.default_model,
            has_api_key=bool(c.api_key_encrypted),
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in connections
    ]


@router.post("", response_model=LLMConnectionResponse)
def create_connection(data: LLMConnectionCreate, db: Session = Depends(get_db)):
    """Create a new LLM connection."""
    connection = LLMConnection(
        id=str(uuid.uuid4()),
        provider=data.provider,
        name=data.name,
        api_key_encrypted=data.api_key,  # TODO: Encrypt in production
        base_url=data.base_url,
        custom_model_name=data.custom_model_name,
    )
    db.add(connection)
    db.commit()
    db.refresh(connection)

    return LLMConnectionResponse(
        id=connection.id,
        provider=connection.provider,
        name=connection.name,
        base_url=connection.base_url,
        custom_model_name=connection.custom_model_name,
        is_default=connection.is_default,
        default_model=connection.default_model,
        has_api_key=bool(connection.api_key_encrypted),
        created_at=connection.created_at,
        updated_at=connection.updated_at,
    )


@router.get("/{connection_id}", response_model=LLMConnectionResponse)
def get_connection(connection_id: str, db: Session = Depends(get_db)):
    """Get a specific LLM connection."""
    connection = (
        db.query(LLMConnection).filter(LLMConnection.id == connection_id).first()
    )
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    return LLMConnectionResponse(
        id=connection.id,
        provider=connection.provider,
        name=connection.name,
        base_url=connection.base_url,
        custom_model_name=connection.custom_model_name,
        is_default=connection.is_default,
        default_model=connection.default_model,
        has_api_key=bool(connection.api_key_encrypted),
        created_at=connection.created_at,
        updated_at=connection.updated_at,
    )


@router.delete("/{connection_id}")
def delete_connection(connection_id: str, db: Session = Depends(get_db)):
    """Delete an LLM connection."""
    connection = (
        db.query(LLMConnection).filter(LLMConnection.id == connection_id).first()
    )
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    db.delete(connection)
    db.commit()
    return {"message": "Connection deleted"}


@router.get("/default/model", response_model=DefaultModelResponse)
def get_default_model(db: Session = Depends(get_db)):
    """Get the default model configuration."""
    connection = (
        db.query(LLMConnection).filter(LLMConnection.is_default == True).first()
    )

    if not connection or not connection.default_model:
        return DefaultModelResponse(is_configured=False)

    return DefaultModelResponse(
        connection_id=connection.id,
        provider=connection.provider,
        model_name=connection.default_model,
        is_configured=True,
    )


@router.put("/default/model", response_model=DefaultModelResponse)
def set_default_model(data: DefaultModelConfig, db: Session = Depends(get_db)):
    """Set the default model configuration."""
    # Clear existing defaults
    db.query(LLMConnection).filter(LLMConnection.is_default == True).update(
        {"is_default": False, "default_model": None}
    )

    # Set new default
    connection = (
        db.query(LLMConnection).filter(LLMConnection.id == data.connection_id).first()
    )
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    connection.is_default = True
    connection.default_model = data.model_name
    db.commit()
    db.refresh(connection)

    return DefaultModelResponse(
        connection_id=connection.id,
        provider=connection.provider,
        model_name=connection.default_model,
        is_configured=True,
    )
