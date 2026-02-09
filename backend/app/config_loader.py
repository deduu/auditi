# Copyright (c) 2026 Auditi Contributors
#
# MIT License
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

"""
Evaluation configuration loader.

Reads eval_config.json for dynamic evaluation settings.
Supports runtime configuration changes without server restart.
"""

import json
import os
import logging
from typing import Optional, Dict, Any
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger("auditi.config_loader")

# Default configuration
DEFAULT_CONFIG = {
    "enabled": True,
    "evaluator_type": "llm",  # "llm" or "human"
    "llm_config": {
        "provider": "openai",  # "openai", "anthropic"
        "model": "gpt-4o",
        "api_key": None,  # Falls back to env var
        "base_url": None,  # For OpenAI-compatible APIs
        "extra_headers": {},  # Additional HTTP headers
        "temperature": 0.1,
    },
    "prompts": {
        "span_eval": None,  # None = use default
        "trace_eval": None,  # None = use default
        "simple_eval": None,  # None = use default
    },
}


@dataclass
class LLMConfig:
    """LLM provider configuration."""

    provider: str = "openai"
    model: str = "gpt-4o"
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    extra_headers: Dict[str, str] = field(default_factory=dict)
    temperature: float = 0.1


@dataclass
class PromptsConfig:
    """Custom prompts configuration."""

    span_eval: Optional[str] = None
    trace_eval: Optional[str] = None
    simple_eval: Optional[str] = None


@dataclass
class EvalConfig:
    """Main evaluation configuration."""

    enabled: bool = True
    evaluator_type: str = "llm"  # "llm" or "human"
    llm_config: LLMConfig = field(default_factory=LLMConfig)
    prompts: PromptsConfig = field(default_factory=PromptsConfig)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "EvalConfig":
        """Create EvalConfig from dictionary."""
        llm_data = data.get("llm_config", {})
        prompts_data = data.get("prompts", {})

        return cls(
            enabled=data.get("enabled", True),
            evaluator_type=data.get("evaluator_type", "llm"),
            llm_config=LLMConfig(
                provider=llm_data.get("provider", "openai"),
                model=llm_data.get("model", "gpt-4o"),
                api_key=llm_data.get("api_key"),
                base_url=llm_data.get("base_url"),
                extra_headers=llm_data.get("extra_headers", {}),
                temperature=llm_data.get("temperature", 0.1),
            ),
            prompts=PromptsConfig(
                span_eval=prompts_data.get("span_eval"),
                trace_eval=prompts_data.get("trace_eval"),
                simple_eval=prompts_data.get("simple_eval"),
            ),
        )


# Config file path (relative to backend root)
CONFIG_FILE_PATH = Path(__file__).parent.parent / "eval_config.json"

# Cached config with modification time
_cached_config: Optional[EvalConfig] = None
_cached_mtime: float = 0


def load_eval_config(force_reload: bool = False) -> EvalConfig:
    """
    Load evaluation configuration from eval_config.json.

    Uses caching with file modification time check for efficiency.
    Falls back to default config if file doesn't exist.

    Args:
        force_reload: If True, reload config regardless of cache

    Returns:
        EvalConfig instance
    """
    global _cached_config, _cached_mtime

    try:
        # Check if file exists
        if not CONFIG_FILE_PATH.exists():
            logger.debug(f"Config file not found at {CONFIG_FILE_PATH}, using defaults")
            if _cached_config is None:
                _cached_config = EvalConfig.from_dict(DEFAULT_CONFIG)
            return _cached_config

        # Check modification time
        current_mtime = CONFIG_FILE_PATH.stat().st_mtime

        if (
            not force_reload
            and _cached_config is not None
            and current_mtime == _cached_mtime
        ):
            return _cached_config

        # Load and parse config
        with open(CONFIG_FILE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Merge with defaults (so missing keys get default values)
        merged = {**DEFAULT_CONFIG, **data}
        if "llm_config" in data:
            merged["llm_config"] = {
                **DEFAULT_CONFIG["llm_config"],
                **data["llm_config"],
            }
        if "prompts" in data:
            merged["prompts"] = {**DEFAULT_CONFIG["prompts"], **data["prompts"]}

        _cached_config = EvalConfig.from_dict(merged)
        _cached_mtime = current_mtime

        logger.info(
            f"Loaded eval config: enabled={_cached_config.enabled}, "
            f"type={_cached_config.evaluator_type}, "
            f"provider={_cached_config.llm_config.provider}"
        )

        return _cached_config

    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in eval_config.json: {e}")
        return EvalConfig.from_dict(DEFAULT_CONFIG)
    except Exception as e:
        logger.error(f"Error loading eval config: {e}")
        return EvalConfig.from_dict(DEFAULT_CONFIG)


def save_eval_config(config: EvalConfig) -> bool:
    """
    Save evaluation configuration to eval_config.json.

    Args:
        config: EvalConfig instance to save

    Returns:
        True if successful, False otherwise
    """
    global _cached_config, _cached_mtime

    try:
        data = {
            "enabled": config.enabled,
            "evaluator_type": config.evaluator_type,
            "llm_config": {
                "provider": config.llm_config.provider,
                "model": config.llm_config.model,
                "api_key": config.llm_config.api_key,
                "base_url": config.llm_config.base_url,
                "extra_headers": config.llm_config.extra_headers,
                "temperature": config.llm_config.temperature,
            },
            "prompts": {
                "span_eval": config.prompts.span_eval,
                "trace_eval": config.prompts.trace_eval,
                "simple_eval": config.prompts.simple_eval,
            },
        }

        with open(CONFIG_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

        # Update cache
        _cached_config = config
        _cached_mtime = CONFIG_FILE_PATH.stat().st_mtime

        logger.info("Saved eval config successfully")
        return True

    except Exception as e:
        logger.error(f"Error saving eval config: {e}")
        return False
