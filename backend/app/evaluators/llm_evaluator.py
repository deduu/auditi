"""
Enhanced LLM-based evaluator using OpenAI API for agentic workflows.
Supports per-tenant API keys with environment variable fallback.
"""
import os
import json
import logging
from typing import Optional, Dict, Any, List

from openai import AsyncOpenAI

from .base import BaseBackendEvaluator, EvalResult

logger = logging.getLogger("auditi.evaluator")


# Simple evaluation prompt for single-turn interactions
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


# Enhanced prompt for agentic workflows with multiple steps
AGENTIC_EVALUATION_PROMPT = """You are an AI quality evaluator analyzing a multi-step AI agent execution. Evaluate both the process and the final output.

## User Input
{user_input}

## Agent Execution Steps
{execution_summary}

## Final Assistant Output
{assistant_output}

## Execution Metadata
- Total steps: {step_count}
- Total tokens used: {total_tokens}
- Total cost: ${total_cost:.4f}

## Evaluation Criteria

### Process Quality (40%)
1. **Tool Selection**: Did the agent choose appropriate tools for the task?
2. **Execution Flow**: Was the sequence of operations logical and efficient?
3. **Resource Usage**: Were tokens and tool calls used reasonably (not wasteful)?

### Output Quality (60%)
4. **Correctness**: Is the final response factually accurate?
5. **Completeness**: Does it fully address the user's query?
6. **Helpfulness**: Does it provide real value to the user?
7. **Coherence**: Is it well-structured and clear?

## Response Format (JSON only)
{{
    "status": "pass" or "fail" or "review",
    "score": 0.0 to 1.0 (overall quality score),
    "failure_mode": null or one of ["hallucination", "incorrect_tool_use", "inefficient_execution", "incomplete_answer", "off_topic", "harmful", "other"],
    "reason": "Brief 2-3 sentence explanation covering both process and output quality"
}}

Guidelines:
- "pass" = Good tool usage AND good output (score >= 0.7)
- "fail" = Poor tool usage OR poor output (score < 0.5)
- "review" = Borderline cases or unusual patterns (0.5 <= score < 0.7)

Respond ONLY with valid JSON, nothing else."""


class LLMEvaluator(BaseBackendEvaluator):
    """
    LLM-based evaluator that uses OpenAI to assess AI response quality.
    
    NOW SUPPORTS AGENTIC WORKFLOWS:
    - Evaluates multi-step executions with tools and LLM calls
    - Assesses tool selection appropriateness
    - Evaluates execution flow efficiency
    - Considers both process and final output quality
    
    Supports:
    - Per-tenant API keys (passed to constructor or via evaluate context)
    - Environment variable fallback (OPENAI_API_KEY)
    - Configurable model selection
    
    Example:
        >>> # Simple evaluation
        >>> evaluator = LLMEvaluator()
        >>> result = await evaluator.evaluate("What is 2+2?", "2+2 equals 4.")
        
        >>> # Agentic workflow evaluation with context
        >>> context = {
        >>>     "execution_steps": [...],
        >>>     "total_tokens": 523,
        >>>     "total_cost": 0.01569,
        >>>     "span_count": 3
        >>> }
        >>> result = await evaluator.evaluate("Find recent news", "Here's what I found...", context)
    """
    
    def __init__(
        self, 
        api_key: Optional[str] = None, 
        model: str = "gpt-4o-mini",
        base_url: Optional[str] = None
    ):
        """
        Initialize the LLM evaluator.
        
        Args:
            api_key: OpenAI API key. Falls back to OPENAI_API_KEY env var if not provided.
            model: Model to use for evaluation (default: gpt-4o-mini for cost efficiency)
            base_url: Optional custom base URL for OpenAI-compatible APIs
        """
        self.model = model
        self.base_url = base_url
        
        # Resolve API key: explicit > environment > None (will fail at evaluation time)
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        
        # Client will be created lazily or per-request if using tenant keys
        self._default_client: Optional[AsyncOpenAI] = None
    
    def _get_client(self, api_key: Optional[str] = None) -> AsyncOpenAI:
        """Get or create an OpenAI client with the given API key."""
        effective_key = api_key or self.api_key
        
        if not effective_key:
            raise ValueError(
                "No OpenAI API key provided. "
                "Set OPENAI_API_KEY environment variable or provide api_key parameter."
            )
        
        # Use default client if using instance key
        if effective_key == self.api_key and self._default_client is not None:
            return self._default_client
        
        # Create new client
        client = AsyncOpenAI(
            api_key=effective_key,
            base_url=self.base_url
        )
        
        # Cache if using instance key
        if effective_key == self.api_key:
            self._default_client = client
        
        return client
    
    def _build_execution_summary(self, execution_steps: List[Dict]) -> str:
        """
        Build human-readable summary of agent execution for evaluation.
        
        This is what gets shown to the LLM evaluator.
        """
        if not execution_steps:
            return "No execution steps recorded."
        
        summary_parts = []
        for i, step in enumerate(execution_steps, 1):
            step_type = step.get("type", "unknown")
            step_name = step.get("name", "unnamed")
            
            if step_type == "tool":
                inputs = step.get("inputs", {})
                outputs = step.get("outputs", "")
                
                # Format inputs nicely
                input_str = json.dumps(inputs, indent=2) if isinstance(inputs, dict) else str(inputs)
                input_preview = input_str[:200] + "..." if len(input_str) > 200 else input_str
                
                # Format outputs nicely
                output_preview = str(outputs)[:200] + "..." if len(str(outputs)) > 200 else str(outputs)
                
                summary_parts.append(
                    f"Step {i}: TOOL '{step_name}'\n"
                    f"  Input: {input_preview}\n"
                    f"  Output: {output_preview}"
                )
                
            elif step_type == "llm":
                model = step.get("model", "unknown")
                inputs = step.get("inputs", {})
                outputs = step.get("outputs", "")
                tokens = step.get("tokens", 0)
                
                # Get prompt from inputs
                prompt = inputs.get("prompt") if isinstance(inputs, dict) else str(inputs)
                prompt_preview = str(prompt)[:150] + "..." if len(str(prompt)) > 150 else str(prompt)
                
                output_preview = str(outputs)[:200] + "..." if len(str(outputs)) > 200 else str(outputs)
                
                summary_parts.append(
                    f"Step {i}: LLM '{step_name}' (model: {model}, tokens: {tokens})\n"
                    f"  Prompt: {prompt_preview}\n"
                    f"  Output: {output_preview}"
                )
            else:
                summary_parts.append(f"Step {i}: {step_type.upper()} '{step_name}'")
        
        return "\n\n".join(summary_parts)
    
    async def evaluate(
        self, 
        user_input: str, 
        assistant_output: str,
        context: Optional[Dict[str, Any]] = None
    ) -> EvalResult:
        """
        Evaluate a trace using an LLM.
        
        Args:
            user_input: The user's original input
            assistant_output: The AI's final response to evaluate
            context: Optional dict containing:
                - 'api_key': Per-tenant API key for evaluation
                - 'execution_steps': List of tool/LLM spans for agentic evaluation
                - 'total_tokens': Total tokens used
                - 'total_cost': Total cost incurred
                - 'span_count': Number of execution steps
            
        Returns:
            EvalResult with status, score, failure_mode, and reason
        """
        context = context or {}
        
        # Extract per-tenant API key from context if provided
        tenant_api_key = context.get("api_key")
        
        # Extract execution context for agentic workflows
        execution_steps = context.get("execution_steps", [])
        total_tokens = context.get("total_tokens", 0)
        total_cost = context.get("total_cost", 0.0)
        span_count = context.get("span_count", 0)
        
        # ============================================
        # LOGGING: Show what context we're evaluating
        # ============================================
        print("\n" + "="*80)
        print("[AUDITI EVALUATION] Starting evaluation")
        print("="*80)
        print(f"User Input: {user_input[:100]}...")
        print(f"Assistant Output: {assistant_output[:100]}...")
        print(f"\nExecution Context:")
        print(f"  - Execution steps: {len(execution_steps)}")
        print(f"  - Total tokens: {total_tokens}")
        print(f"  - Total cost: ${total_cost:.4f}")
        print(f"  - Span count: {span_count}")
        
        if execution_steps:
            print(f"\nDetailed Execution Steps:")
            for i, step in enumerate(execution_steps, 1):
                step_type = step.get("type", "unknown")
                step_name = step.get("name", "unnamed")
                print(f"  {i}. {step_type.upper()}: {step_name}")
                
                if step_type == "tool":
                    print(f"     Input: {str(step.get('inputs', {}))[:80]}...")
                    print(f"     Output: {str(step.get('outputs', ''))[:80]}...")
                elif step_type == "llm":
                    print(f"     Model: {step.get('model', 'unknown')}")
                    print(f"     Tokens: {step.get('tokens', 0)}")
                    print(f"     Output: {str(step.get('outputs', ''))[:80]}...")
        else:
            print("\n  No execution steps found - evaluating as simple interaction")
        
        print("="*80 + "\n")
        
        # Get OpenAI client
        try:
            client = self._get_client(tenant_api_key)
        except ValueError as e:
            logger.warning(f"API key missing: {e}")
            return EvalResult(
                status="review",
                score=0.0,
                failure_mode="other",
                reason="Evaluation skipped: No API key configured"
            )
        
        # ============================================
        # Choose evaluation strategy based on context
        # ============================================
        if execution_steps and len(execution_steps) > 0:
            # AGENTIC WORKFLOW EVALUATION
            print("[AUDITI EVALUATION] Using AGENTIC evaluation (multi-step workflow)")
            
            execution_summary = self._build_execution_summary(execution_steps)
            
            prompt = AGENTIC_EVALUATION_PROMPT.format(
                user_input=user_input[:2000],
                assistant_output=assistant_output[:4000],
                execution_summary=execution_summary,
                step_count=len(execution_steps),
                total_tokens=total_tokens,
                total_cost=total_cost
            )
            
            print(f"\n[AUDITI EVALUATION] Execution summary sent to LLM:")
            print("-" * 80)
            print(execution_summary[:500] + "..." if len(execution_summary) > 500 else execution_summary)
            print("-" * 80 + "\n")
            
        else:
            # SIMPLE EVALUATION
            print("[AUDITI EVALUATION] Using SIMPLE evaluation (single interaction)")
            
            prompt = SIMPLE_EVALUATION_PROMPT.format(
                user_input=user_input[:2000],
                assistant_output=assistant_output[:4000]
            )
        
        # ============================================
        # Call OpenAI for evaluation
        # ============================================
        try:
            print(f"[AUDITI EVALUATION] Calling OpenAI model: {self.model}")
            
            response = await client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.1,  # Low temperature for consistent evaluations
            )
            
            content = response.choices[0].message.content
            
            print(f"[AUDITI EVALUATION] Raw LLM response:")
            print("-" * 80)
            print(content)
            print("-" * 80 + "\n")
            
            result = json.loads(content)
            
            # Validate and normalize result
            status = result.get("status", "review")
            if status not in ("pass", "fail", "review"):
                status = "review"
            
            score = float(result.get("score", 0.5))
            score = max(0.0, min(1.0, score))  # Clamp to [0, 1]
            
            failure_mode = result.get("failure_mode")
            valid_modes = {
                "hallucination", "off_topic", "harmful", "incomplete", 
                "incoherent", "incorrect_tool_use", "inefficient_execution", "other"
            }
            if failure_mode and failure_mode not in valid_modes:
                failure_mode = "other"
            
            reason = result.get("reason", "")[:500]  # Truncate reason
            
            print(f"[AUDITI EVALUATION] Final result:")
            print(f"  Status: {status}")
            print(f"  Score: {score:.2f}")
            print(f"  Failure Mode: {failure_mode}")
            print(f"  Reason: {reason}")
            print("="*80 + "\n")
            
            logger.info(f"Evaluation complete: status={status}, score={score:.2f}, steps={len(execution_steps)}")
            
            return EvalResult(
                status=status,
                score=score,
                failure_mode=failure_mode if status == "fail" else None,
                reason=reason
            )
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response: {e}")
            print(f"[AUDITI EVALUATION] ERROR: Failed to parse LLM response: {e}\n")
            return EvalResult(
                status="review",
                score=0.5,
                failure_mode="other",
                reason="Evaluation failed: Could not parse LLM response"
            )
        except Exception as e:
            logger.error(f"LLM evaluation failed: {e}")
            print(f"[AUDITI EVALUATION] ERROR: {e}\n")
            return EvalResult(
                status="review",
                score=0.5,
                failure_mode="other",
                reason=f"Evaluation failed: {str(e)[:100]}"
            )