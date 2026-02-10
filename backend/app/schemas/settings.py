from typing import Optional, Dict, Literal
from datetime import datetime
from pydantic import BaseModel, Field


class LLMConfigSchema(BaseModel):
    provider: str = "openai"
    model: str = "gpt-4o"
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    extra_headers: Dict[str, str] = Field(default_factory=dict)
    temperature: float = 0.1


class PromptsConfigSchema(BaseModel):
    span_eval: Optional[str] = None
    trace_eval: Optional[str] = None
    simple_eval: Optional[str] = None


class EvalConfigSchema(BaseModel):
    enabled: bool = True
    evaluator_type: str = "llm"  # "llm" or "human"
    llm_config: LLMConfigSchema = Field(default_factory=LLMConfigSchema)
    prompts: PromptsConfigSchema = Field(default_factory=PromptsConfigSchema)


# --- User Settings Schemas ---


class UserSettingsBase(BaseModel):
    email_notifications: bool = True
    slack_integration: bool = False
    two_factor_auth: bool = False
    audit_logging: bool = True
    data_retention_days: Literal[30, 60, 90] = 30


class UserSettingsUpdate(BaseModel):
    email_notifications: Optional[bool] = None
    slack_integration: Optional[bool] = None
    two_factor_auth: Optional[bool] = None
    audit_logging: Optional[bool] = None
    data_retention_days: Optional[Literal[30, 60, 90]] = None


class UserSettingsResponse(UserSettingsBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
