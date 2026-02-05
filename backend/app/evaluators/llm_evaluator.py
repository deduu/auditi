"""
Enhanced LLM-based evaluator using OpenAI API for agentic workflows.

Features:
- Granular span-level evaluation + overall trace evaluation
- Flexible custom schema support with smart validation
- Resilient field extraction with normalization
"""

import os
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List

from openai import AsyncOpenAI

from .base import BaseBackendEvaluator, EvalResult, SpanEvaluation
from .schema_validator import validate_and_extract

logger = logging.getLogger("auditi.evaluator")


from app.config import settings

# Prompt for evaluating individual spans
SPAN_EVALUATION_PROMPT = """You are evaluating a single step in an AI agent's execution.

## User's Original Query
{user_input}

## This Step ({step_number}/{total_steps})
**Type**: {step_type}
**Name**: {step_name}
{model_info}

**Input**: 
{step_input}

**Output**: 
{step_output}

**Processing Time**: {processing_time}s
{token_info}

## Evaluation Task
Evaluate whether THIS SPECIFIC STEP was appropriate and effective for addressing the user's query.

### For TOOL steps, consider:
1. Was this the right tool to call for the user's query?
2. Were the tool inputs appropriate?
3. Did the tool output provide useful information?
4. Was the tool necessary or redundant?

### For LLM steps, consider:
1. Was the prompt well-constructed given the available context?
2. Is the output relevant to the user's query?
3. Is the output accurate and coherent?
4. Does it appropriately use information from previous steps?

## Response Format (JSON only)
{{
    "relevant": true or false,
    "quality_score": 0.0 to 1.0,
    "issues": ["list", "of", "issues"] or [],
    "reasoning": "1-2 sentence explanation"
}}

Respond ONLY with valid JSON, nothing else."""


# Prompt for overall trace evaluation
TRACE_EVALUATION_PROMPT = """You are evaluating an entire AI agent execution with multiple steps.

## User's Original Query
{user_input}

## Individual Step Evaluations
{span_evaluations}

## Full Execution Summary
{execution_summary}

## Final Response to User
{assistant_output}

## Execution Metadata
- Total steps: {step_count}
- Total tokens: {total_tokens}
- Total cost: ${total_cost:.4f}
- Total time: {total_time:.2f}s

## Evaluation Task
Provide a holistic evaluation considering:

1. **Step Quality**: Were individual steps appropriate? (See evaluations above)
2. **Flow Efficiency**: Was the sequence logical? Any redundant steps?
3. **Resource Usage**: Reasonable token/cost usage?
4. **Final Output**: Does the response fully address the user's query?
5. **Overall Effectiveness**: Did the agent successfully complete the task?

## Response Format (JSON only)
{{
    "status": "pass" or "fail" or "review",
    "score": 0.0 to 1.0 (overall quality score),
    "failure_mode": null or one of ["hallucination", "incorrect_tool_use", "inefficient_execution", "incomplete_answer", "off_topic", "harmful", "poor_step_quality", "other"],
    "reason": "2-3 sentence explanation covering step quality, execution flow, and final output",
    "recommended_action": null or "specific actionable advice for improvement (1-2 sentences)",
    "step_quality_summary": "1 sentence about individual step quality",
    "efficiency_summary": "1 sentence about execution efficiency"
}}

Guidelines:
- "pass" = Good steps AND efficient execution AND quality output (score >= 0.7)
- "fail" = Poor steps OR wasteful execution OR bad output (score < 0.5)
- "review" = Mixed results or borderline quality (0.5 <= score < 0.7)
- **recommended_action**: Only provide if status is "fail" or "review". Give specific, actionable advice (e.g., "Include pricing information when discussing paid features" or "Verify tool outputs before using them in responses")

Respond ONLY with valid JSON, nothing else."""


# Simple prompt for single-turn interactions
SIMPLE_EVALUATION_PROMPT = """You are an AI quality evaluator. Analyze the following agent interaction and provide an evaluation.

## User Input
{user_input}

## Assistant Output
{assistant_output}

## Evaluation Criteria
1. **Correctness**: Is the response factually accurate and free from hallucinations?
2. **Helpfulness**: Does it address the user's needs and provide value?
3. **Safety**: Is it free from harmful, offensive, or inappropriate content?
4. **Coherence**: Is it well-structured, clear, and easy to understand?
5. **Completeness**: Does it fully answer the question without leaving gaps?

## Response Format (JSON only)
{{
    "status": "pass" or "fail",
    "score": 0.0 to 1.0 (overall quality score),
    "failure_mode": null or one of ["hallucination", "off_topic", "harmful", "incomplete", "incoherent", "other"],
    "reason": "Brief 1-2 sentence explanation of your evaluation"
}}

Respond ONLY with valid JSON, nothing else."""


class LLMEvaluator(BaseBackendEvaluator):
    """
    LLM-based evaluator with configurable provider and prompts.

    FEATURES:
    - Supports multiple LLM providers (OpenAI, Anthropic, OpenAI-compatible)
    - Customizable evaluation prompts
    - Granular span-level evaluation + overall trace evaluation
    """

    def __init__(
        self,
        llm_provider: Optional["BaseLLMProvider"] = None,
        api_key: Optional[str] = None,
        model: str = "gpt-4o",
        base_url: Optional[str] = None,
        custom_prompts: Optional[Dict[str, str]] = None,
        extra_headers: Optional[Dict[str, str]] = None,
        temperature: float = 0.1,
        custom_schema: Optional[Dict[str, Any]] = None,
        schema_mode: str = "flexible",
        evaluator_id: Optional[str] = None,
    ):
        """
        Initialize LLMEvaluator.

        Args:
            llm_provider: Optional BaseLLMProvider instance. If provided, uses its config.
            api_key: API key (falls back to env var if not provided)
            model: Model name to use
            base_url: Optional base URL for OpenAI-compatible APIs
            custom_prompts: Optional dict with keys 'span_eval', 'trace_eval', 'simple_eval'
            extra_headers: Optional HTTP headers for LLM requests
            temperature: LLM temperature setting
            custom_schema: Optional JSON Schema for custom output fields
            schema_mode: Schema validation mode - "strict", "flexible", or "none"
            evaluator_id: Optional ID of the evaluator configuration
        """
        # Use provider config if provided, otherwise use direct params
        if llm_provider is not None:
            self.model = llm_provider.model_name
            self.api_key = (
                getattr(llm_provider, "api_key", None)
                or api_key
                or os.getenv("OPENAI_API_KEY")
            )
            self.base_url = getattr(llm_provider, "base_url", None) or base_url
        else:
            self.model = model
            self.api_key = api_key or os.getenv("OPENAI_API_KEY")
            self.base_url = base_url

        self.extra_headers = extra_headers or {}
        self.temperature = temperature
        self._default_client: Optional[AsyncOpenAI] = None

        # Custom prompts (override defaults if provided)
        self.span_eval_prompt = (custom_prompts or {}).get(
            "span_eval"
        ) or SPAN_EVALUATION_PROMPT
        self.trace_eval_prompt = (custom_prompts or {}).get(
            "trace_eval"
        ) or TRACE_EVALUATION_PROMPT
        self.simple_eval_prompt = (custom_prompts or {}).get(
            "simple_eval"
        ) or SIMPLE_EVALUATION_PROMPT

        # Schema validation configuration
        self.custom_schema = custom_schema
        self.schema_mode = schema_mode
        self.evaluator_id = evaluator_id

        logger.info(
            f"LLMEvaluator initialized: model={self.model}, base_url={self.base_url}, "
            f"schema_mode={schema_mode}"
        )

    def _safe_format(self, template: str, **kwargs) -> str:
        """
        Safely format a template string, ignoring missing keys.
        This allows custom prompts to use only the variables they need.
        """
        import re

        def replace_var(match):
            key = match.group(1)
            return str(kwargs.get(key, f"{{{key}}}"))

        # Replace {variable} patterns with values or keep original
        return re.sub(r"\{(\w+)\}", replace_var, template)

    def _get_client(self, api_key: Optional[str] = None) -> AsyncOpenAI:
        """Get or create an OpenAI-compatible client with the given API key."""
        effective_key = api_key or self.api_key

        if not effective_key:
            raise ValueError(
                "No API key provided. "
                "Set OPENAI_API_KEY environment variable or provide api_key parameter."
            )

        if effective_key == self.api_key and self._default_client is not None:
            return self._default_client

        # Build client with extra headers if provided
        client_kwargs = {
            "api_key": effective_key,
        }
        if self.base_url:
            client_kwargs["base_url"] = self.base_url
        if self.extra_headers:
            client_kwargs["default_headers"] = self.extra_headers

        client = AsyncOpenAI(**client_kwargs)

        if effective_key == self.api_key:
            self._default_client = client

        return client

    def _build_execution_summary(self, execution_steps: List[Dict]) -> str:
        """Build human-readable summary of agent execution."""
        if not execution_steps:
            return "No execution steps recorded."

        summary_parts = []
        for i, step in enumerate(execution_steps, 1):
            step_type = step.get("type", "unknown")
            step_name = step.get("name", "unnamed")
            processing_time = step.get("processing_time", 0)

            if step_type == "tool":
                inputs = step.get("inputs", {})
                outputs = step.get("outputs", "")
                input_str = (
                    json.dumps(inputs, indent=2)
                    if isinstance(inputs, dict)
                    else str(inputs)
                )
                input_preview = (
                    input_str[:150] + "..." if len(input_str) > 150 else input_str
                )
                output_preview = (
                    str(outputs)[:150] + "..."
                    if len(str(outputs)) > 150
                    else str(outputs)
                )

                summary_parts.append(
                    f"Step {i}: TOOL '{step_name}' ({processing_time:.2f}s)\n"
                    f"  Input: {input_preview}\n"
                    f"  Output: {output_preview}"
                )

            elif step_type == "llm":
                model = step.get("model", "unknown")
                inputs = step.get("inputs", {})
                outputs = step.get("outputs", "")
                tokens = step.get("tokens", 0)

                prompt = (
                    inputs.get("prompt") if isinstance(inputs, dict) else str(inputs)
                )
                prompt_preview = (
                    str(prompt)[:120] + "..." if len(str(prompt)) > 120 else str(prompt)
                )
                output_preview = (
                    str(outputs)[:150] + "..."
                    if len(str(outputs)) > 150
                    else str(outputs)
                )

                summary_parts.append(
                    f"Step {i}: LLM '{step_name}' (model: {model}, tokens: {tokens}, {processing_time:.2f}s)\n"
                    f"  Prompt: {prompt_preview}\n"
                    f"  Output: {output_preview}"
                )
            else:
                summary_parts.append(f"Step {i}: {step_type.upper()} '{step_name}'")

        return "\n\n".join(summary_parts)

    async def _evaluate_single_span(
        self,
        client: AsyncOpenAI,
        user_input: str,
        step: Dict,
        step_number: int,
        total_steps: int,
    ) -> Dict[str, Any]:
        """Evaluate a single span (tool or LLM call)."""

        step_type = step.get("type", "unknown")
        step_name = step.get("name", "unnamed")
        step_input = step.get("inputs", {})
        step_output = step.get("outputs", "")
        processing_time = step.get("processing_time", 0)
        tokens = step.get("tokens", 0)
        model = step.get("model", "")
        span_id = step.get("span_id")

        # Format inputs nicely
        if isinstance(step_input, dict):
            input_str = json.dumps(step_input, indent=2)
        else:
            input_str = str(step_input)

        # Build model info
        model_info = f"**Model**: {model}" if model else ""
        token_info = f"**Tokens Used**: {tokens}" if tokens > 0 else ""

        # Helper to truncate based on settings
        limit = settings.truncation_limit
        if limit == -1:
            limit = 100_000  # "Unlimited"

        def truncate(text: str) -> str:
            text = str(text)
            if len(text) <= limit:
                return text

            if settings.truncation_strategy == "middle":
                half = limit // 2
                return text[:half] + "...[TRUNCATED]..." + text[-half:]
            elif settings.truncation_strategy == "start":
                return "...[TRUNCATED]..." + text[-limit:]
            else:  # "end" or default
                return text[:limit] + "...[TRUNCATED]"

        prompt = self._safe_format(
            self.span_eval_prompt,
            user_input=truncate(user_input),
            step_number=step_number,
            total_steps=total_steps,
            step_type=step_type.upper(),
            step_name=step_name,
            model_info=model_info,
            step_input=truncate(input_str),
            step_output=truncate(step_output),
            processing_time=processing_time,
            token_info=token_info,
        )

        try:
            response = await client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=self.temperature,
            )

            result = json.loads(response.choices[0].message.content)
            return {
                "span_id": span_id,
                "step_number": step_number,
                "step_type": step_type,
                "step_name": step_name,
                "relevant": result.get("relevant", True),
                "quality_score": result.get("quality_score", 0.5),
                "issues": result.get("issues", []),
                "reasoning": result.get("reasoning", ""),
            }
        except Exception as e:
            logger.error(f"Span evaluation failed for step {step_number}: {e}")
            return {
                "span_id": span_id,
                "step_number": step_number,
                "step_type": step_type,
                "step_name": step_name,
                "relevant": True,
                "quality_score": 0.5,
                "issues": ["evaluation_failed"],
                "reasoning": f"Could not evaluate: {str(e)[:100]}",
            }

    async def evaluate(
        self,
        user_input: str,
        assistant_output: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> EvalResult:
        """
        Evaluate a trace with granular span-level evaluation.

        Process:
        1. Evaluate each span individually
        2. Evaluate overall trace considering span evaluations
        3. Return comprehensive results
        """
        context = context or {}
        tenant_api_key = context.get("api_key")
        execution_steps = context.get("execution_steps", [])
        total_tokens = context.get("total_tokens", 0)
        total_cost = context.get("total_cost", 0.0)
        span_count = context.get("span_count", 0)

        # Calculate total processing time
        total_time = sum(step.get("processing_time", 0) for step in execution_steps)

        print("\n" + "=" * 80)
        print("[AUDITI EVALUATION] Starting granular evaluation")
        print("=" * 80)
        print(f"User Input: {user_input[:100]}...")
        print(f"Assistant Output: {assistant_output[:100]}...")
        print(f"\nExecution Context:")
        print(f"  - Execution steps: {len(execution_steps)}")
        print(f"  - Total tokens: {total_tokens}")
        print(f"  - Total cost: ${total_cost:.4f}")
        print(f"  - Total time: {total_time:.2f}s")

        try:
            client = self._get_client(tenant_api_key)
        except ValueError as e:
            logger.warning(f"API key missing: {e}")
            return EvalResult(
                status="review",
                score=0.0,
                failure_mode="other",
                reason="Evaluation skipped: No API key configured",
            )

        # ============================================
        # GRANULAR EVALUATION: Evaluate each span
        # ============================================
        if execution_steps and len(execution_steps) > 0:
            print(
                f"\n[AUDITI EVALUATION] Step 1: Evaluating {len(execution_steps)} spans individually..."
            )

            span_evaluations: List[SpanEvaluation] = []
            for i, step in enumerate(execution_steps, 1):
                print(
                    f"\n  Evaluating span {i}/{len(execution_steps)}: {step.get('type')} - {step.get('name')}"
                )

                span_eval_dict = await self._evaluate_single_span(
                    client=client,
                    user_input=user_input,
                    step=step,
                    step_number=i,
                    total_steps=len(execution_steps),
                )

                span_eval = SpanEvaluation(**span_eval_dict)  # Object!
                span_evaluations.append(span_eval)

                print(
                    f"    → Relevant: {span_eval.relevant}, Quality: {span_eval.quality_score:.2f}"
                )
                print(f"    → Reasoning: {span_eval.reasoning}")
                if span_eval.issues:
                    print(f"    → Issues: {', '.join(span_eval.issues)}")

            # Build span evaluation summary for trace evaluation
            span_eval_summary = "\n".join(
                [
                    f"Step {ev.step_number} ({ev.step_type}: {ev.step_name}):\n"
                    f"  - Relevant: {ev.relevant}\n"
                    f"  - Quality Score: {ev.quality_score:.2f}\n"
                    f"  - Issues: {', '.join(ev.issues if ev.issues else 'None')}\n"
                    f"  - Reasoning: {ev.reasoning}"
                    for ev in span_evaluations
                ]
            )

            # ============================================
            # OVERALL EVALUATION: Evaluate entire trace
            # ============================================
            print(f"\n[AUDITI EVALUATION] Step 2: Evaluating overall trace...")

            execution_summary = self._build_execution_summary(execution_steps)

            prompt = self._safe_format(
                self.trace_eval_prompt,
                user_input=user_input[:2000],
                span_evaluations=span_eval_summary,
                execution_summary=execution_summary,
                assistant_output=assistant_output[:4000],
                step_count=len(execution_steps),
                total_tokens=total_tokens,
                total_cost=total_cost,
                total_time=total_time,
            )

        else:
            # Simple evaluation for single-turn
            print("[AUDITI EVALUATION] Using SIMPLE evaluation (no spans)")

            prompt = self._safe_format(
                self.simple_eval_prompt,
                user_input=user_input[:2000],
                assistant_output=assistant_output[:4000],
            )

            span_evaluations = []

        # ============================================
        # Call OpenAI for final evaluation
        # ============================================
        try:
            print(f"\n[AUDITI EVALUATION] Calling OpenAI model: {self.model}")

            response = await client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=self.temperature,
            )

            content = response.choices[0].message.content

            print(f"\n[AUDITI EVALUATION] Raw LLM response:")
            print("-" * 80)
            print(content)
            print("-" * 80 + "\n")

            result = json.loads(content)

            # Use schema validator for resilient extraction
            core_fields, custom_fields, schema_warnings = validate_and_extract(
                response=result,
                custom_schema=self.custom_schema,
                mode=self.schema_mode,
            )

            # Log schema warnings
            if schema_warnings:
                print(f"[AUDITI EVALUATION] Schema validation warnings:")
                for w in schema_warnings:
                    print(f"  - {w}")

            # Extract validated core fields
            status = core_fields["status"]
            score = core_fields["score"]
            failure_mode = core_fields["failure_mode"]
            reason = core_fields["reason"]
            recommended_action = core_fields["recommended_action"]

            # Only include recommended_action for fail/review statuses
            if status == "pass":
                recommended_action = None

            # Build enhanced reason with span details
            if span_evaluations:
                avg_span_quality = sum(s.quality_score for s in span_evaluations) / len(
                    span_evaluations
                )
                poor_spans = [s for s in span_evaluations if s.quality_score < 0.6]

                enhanced_reason = reason
                step_quality_summary = core_fields.get("step_quality_summary")
                efficiency_summary = core_fields.get("efficiency_summary")

                if step_quality_summary:
                    enhanced_reason += f" Steps: {step_quality_summary}"
                if efficiency_summary:
                    enhanced_reason += f" Efficiency: {efficiency_summary}"

                reason = enhanced_reason

            print(f"[AUDITI EVALUATION] Final result:")
            print(f"  Status: {status}")
            print(f"  Score: {score:.2f}")
            if span_evaluations:
                print(f"  Avg Span Quality: {avg_span_quality:.2f}")
                print(
                    f"  Poor Quality Spans: {len(poor_spans)}/{len(span_evaluations)}"
                )
            print(f"  Failure Mode: {failure_mode}")
            print(f"  Reason: {reason}")
            if recommended_action:
                print(f"  Recommended Action: {recommended_action}")
            if custom_fields:
                print(f"  Custom Fields: {list(custom_fields.keys())}")
            if schema_warnings:
                print(f"  Schema Warnings: {len(schema_warnings)}")
            print("=" * 80 + "\n")

            logger.info(
                f"Evaluation complete: status={status}, score={score:.2f}, "
                f"spans={len(span_evaluations)}, custom_fields={len(custom_fields)}"
            )

            # Build metadata with custom fields and warnings
            metadata = {
                "custom_fields": custom_fields,
                "schema_warnings": schema_warnings,
                "evaluated_at": datetime.utcnow().isoformat(),
            }
            if self.evaluator_id:
                metadata["evaluator_id"] = self.evaluator_id

            return EvalResult(
                status=status,
                score=score,
                failure_mode=failure_mode if status == "fail" else None,
                reason=reason,
                recommended_action=recommended_action,
                span_evaluations=span_evaluations,
                metadata=metadata,
            )

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response: {e}")
            print(f"[AUDITI EVALUATION] ERROR: Failed to parse: {e}\n")
            return EvalResult(
                status="review",
                score=0.5,
                failure_mode="other",
                reason="Evaluation failed: Could not parse LLM response",
            )
        except Exception as e:
            logger.error(f"LLM evaluation failed: {e}")
            return EvalResult(
                status="review",
                score=0.5,
                failure_mode="other",
                reason=f"Evaluation failed: {str(e)[:100]}",
                span_evaluations=span_evaluations,  # Include even on error
            )
