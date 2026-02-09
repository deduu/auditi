"""API Key management router."""

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.api_key import APIKey
from app.models.user import User
from app.schemas.auth import APIKeyCreate, APIKeyCreateResponse, APIKeyResponse
from app.utils.auth import generate_api_key

router = APIRouter(prefix="/api-keys", tags=["api-keys"])


@router.get("", response_model=List[APIKeyResponse])
def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all API keys for the current user."""
    keys = (
        db.query(APIKey)
        .filter(APIKey.user_id == current_user.id)
        .order_by(APIKey.created_at.desc())
        .all()
    )
    return [APIKeyResponse.model_validate(k) for k in keys]


@router.post("", response_model=APIKeyCreateResponse)
def create_api_key_endpoint(
    data: APIKeyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new API key. The full key is returned ONLY in this response."""
    full_key, key_prefix, key_hash_value = generate_api_key()

    api_key = APIKey(
        id=str(uuid.uuid4()),
        name=data.name,
        key_prefix=key_prefix,
        key_hash=key_hash_value,
        user_id=current_user.id,
    )
    db.add(api_key)
    db.commit()
    db.refresh(api_key)

    return APIKeyCreateResponse(
        id=api_key.id,
        name=api_key.name,
        key=full_key,
        key_prefix=api_key.key_prefix,
        created_at=api_key.created_at,
    )


@router.delete("/{key_id}")
def revoke_api_key(
    key_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoke (deactivate) an API key."""
    api_key = (
        db.query(APIKey)
        .filter(APIKey.id == key_id, APIKey.user_id == current_user.id)
        .first()
    )
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")

    api_key.is_active = False
    db.commit()
    return {"message": "API key revoked"}
