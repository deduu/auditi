"""
Evaluator factory for creating evaluator instances based on configuration.
"""

import logging
from typing import Optional

from app.config_loader import EvalConfig, load_eval_config
from app.services.llm_provider import get_llm_provider, BaseLLMProvider
from app.evaluators.base import BaseBackendEvaluator

logger = logging.getLogger("auditi.evaluator_factory")


def get_evaluator(config: Optional[EvalConfig] = None) -> BaseBackendEvaluator:
    """
    Factory function to create an evaluator based on configuration.

    Args:
        config: Optional EvalConfig. If None, loads from eval_config.json.

    Returns:
        Configured evaluator instance (LLMEvaluator or HumanEvaluator)
    """
    if config is None:
        config = load_eval_config()

    from app.evaluators.llm_evaluator import LLMEvaluator
    from app.evaluators.human_evaluator import HumanEvaluator

    evaluator_type = config.evaluator_type.lower()

    if evaluator_type == "human":
        logger.info("Creating HumanEvaluator")
        return HumanEvaluator()

    elif evaluator_type == "llm":
        # Get LLM provider based on config
        llm_config = config.llm_config

        logger.info(
            f"Creating LLMEvaluator with provider={llm_config.provider}, "
            f"model={llm_config.model}"
        )

        # Build LLM provider
        provider = get_llm_provider(
            provider_name=llm_config.provider,
            api_key=llm_config.api_key,
            model=llm_config.model,
            base_url=llm_config.base_url,
        )

        # Build custom prompts dict (only include non-None values)
        custom_prompts = {}
        if config.prompts.span_eval:
            custom_prompts["span_eval"] = config.prompts.span_eval
        if config.prompts.trace_eval:
            custom_prompts["trace_eval"] = config.prompts.trace_eval
        if config.prompts.simple_eval:
            custom_prompts["simple_eval"] = config.prompts.simple_eval

        return LLMEvaluator(
            llm_provider=provider,
            custom_prompts=custom_prompts if custom_prompts else None,
            extra_headers=llm_config.extra_headers,
            temperature=llm_config.temperature,
        )

    else:
        logger.warning(f"Unknown evaluator type '{evaluator_type}', defaulting to LLM")
        return LLMEvaluator()
