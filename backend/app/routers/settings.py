from fastapi import APIRouter, HTTPException, Depends
from dataclasses import asdict

from app.config_loader import load_eval_config, save_eval_config, EvalConfig
from app.schemas.settings import EvalConfigSchema

router = APIRouter(
    prefix="/settings",
    tags=["settings"],
    responses={404: {"description": "Not found"}},
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
