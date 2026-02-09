"""Authentication router: login, logout, me, setup."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    SetupRequest,
    SetupStatus,
    UserResponse,
)
from app.utils.auth import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/setup-status", response_model=SetupStatus)
def get_setup_status(db: Session = Depends(get_db)):
    """Check if initial setup has been completed (any users exist)."""
    count = db.query(User).count()
    return SetupStatus(is_setup_complete=count > 0, user_count=count)


@router.post("/setup", response_model=UserResponse)
def initial_setup(
    data: SetupRequest, response: Response, db: Session = Depends(get_db)
):
    """Create the first admin user. Only works when no users exist."""
    existing_count = db.query(User).count()
    if existing_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Setup already completed. Use login instead.",
        )

    user = User(
        id=str(uuid.uuid4()),
        email=data.email.lower().strip(),
        name=data.name.strip(),
        hashed_password=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Auto-login after setup
    token = create_access_token(user.id, user.email)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=not settings.debug,
        max_age=settings.access_token_expire_minutes * 60,
    )

    return UserResponse.model_validate(user)


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """Authenticate user and set JWT cookie."""
    user = (
        db.query(User).filter(User.email == data.email.lower().strip()).first()
    )
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    token = create_access_token(user.id, user.email)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=not settings.debug,
        max_age=settings.access_token_expire_minutes * 60,
    )

    return LoginResponse(user=UserResponse.model_validate(user))


@router.post("/logout")
def logout(response: Response):
    """Clear the JWT cookie."""
    response.delete_cookie(key="access_token")
    return {"message": "Logged out"}


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get the currently authenticated user's info."""
    return UserResponse.model_validate(current_user)
