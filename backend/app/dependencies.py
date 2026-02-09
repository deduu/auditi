"""Authentication dependencies for FastAPI route protection."""

from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.api_key import APIKey
from app.utils.auth import decode_access_token, hash_api_key


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Extract and validate JWT from httpOnly cookie or Authorization header.

    Used for frontend-facing (dashboard) endpoints.
    """
    # 1. Try cookie first
    token = request.cookies.get("access_token")

    # 2. Fallback to Authorization header (for non-browser clients)
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return user


def validate_api_key(request: Request, db: Session = Depends(get_db)) -> APIKey:
    """Validate API key from Authorization: Bearer <api_key> header.

    Used for SDK-facing (programmatic) endpoints.
    Updates last_used_at on the API key.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required. Use Authorization: Bearer <api_key>",
        )

    key = auth_header[7:]
    key_hash_value = hash_api_key(key)

    api_key = (
        db.query(APIKey)
        .filter(APIKey.key_hash == key_hash_value, APIKey.is_active == True)
        .first()
    )

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked API key",
        )

    # Update last_used_at
    api_key.last_used_at = datetime.now(timezone.utc)
    db.commit()

    return api_key
