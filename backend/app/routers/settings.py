import uuid
from fastapi import APIRouter, HTTPException, Depends
from dataclasses import asdict
from sqlalchemy.orm import Session

from app.config_loader import load_eval_config, save_eval_config, EvalConfig
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.user_settings import UserSettings
from app.schemas.settings import EvalConfigSchema, UserSettingsResponse, UserSettingsUpdate

router = APIRouter(
    prefix="/settings",
    tags=["settings"],
    responses={404: {"description": "Not found"}},
    dependencies=[Depends(get_current_user)],
)


@router.get("/eval", response_model=EvalConfigSchema)
async def get_eval_settings():
    """Get current evaluation configuration."""
    config = load_eval_config()
    return asdict(config)


@router.put("/eval", response_model=EvalConfigSchema)
async def update_eval_settings(settings: EvalConfigSchema):
    """Update evaluation configuration."""
    # Convert Pydantic model to dict, then to EvalConfig
    try:
        config_dict = settings.model_dump()
        new_config = EvalConfig.from_dict(config_dict)

        success = save_eval_config(new_config)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to save configuration")

        return asdict(new_config)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _get_or_create_user_settings(user_id: str, db: Session) -> UserSettings:
    """Get existing user settings or create with defaults."""
    settings = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    if not settings:
        settings = UserSettings(id=str(uuid.uuid4()), user_id=user_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("/user", response_model=UserSettingsResponse)
async def get_user_settings(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current user's settings. Auto-creates with defaults if none exist."""
    return _get_or_create_user_settings(user.id, db)


@router.patch("/user", response_model=UserSettingsResponse)
async def update_user_settings(
    updates: UserSettingsUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update current user's settings. Only provided fields are changed."""
    settings = _get_or_create_user_settings(user.id, db)

    update_data = updates.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)

    db.commit()
    db.refresh(settings)
    return settings
