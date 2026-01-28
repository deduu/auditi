from typing import Optional, Dict
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
