# Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
"""
Async background worker for processing trace evaluations.

FIXED: Now properly evaluates traces with multiple spans (tools + LLMs)
ENHANCED: Comprehensive logging to debug evaluation context
NEW: Extracts conversation objective from first user message
UPDATED: Checks auto-eval configuration before processing
"""

import asyncio
import logging
from queue import Queue, Empty
from typing import Callable, Optional
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.evaluators import LLMEvaluator
from app.evaluators.main_factory import get_evaluator
from app.evaluators.base import BaseBackendEvaluator, EvalResult
from app.utils.encryption import decrypt_api_key
from app.config_loader import load_eval_config
from app.services.llm_provider import get_llm_provider, extract_objective

logger = logging.getLogger("auditi.eval_worker")


@dataclass
class EvalJob:
    """Represents an evaluation job in the queue."""

    trace_id: str
    api_key: Optional[str] = None


eval_queue: Queue[EvalJob] = Queue()


def enqueue_evaluation(trace_id: str, api_key: Optional[str] = None) -> None:
    """Add a trace to the evaluation queue."""
    job = EvalJob(trace_id=trace_id, api_key=api_key)
    eval_queue.put(job)
    logger.debug(f"Enqueued trace {trace_id} for evaluation")


def check_auto_eval_ready(db: Session) -> dict:
    """
    Check if auto-evaluation is ready to run.

    Returns dict with:
        - ready: bool - whether evaluation should proceed
        - evaluator: Optional[Evaluator] - the active evaluator config
        - connection: Optional[LLMConnection] - the default connection
        - reason: str - description of why not ready (if applicable)
    """
    from app.models.evaluator import EvaluatorSetupState, Evaluator
    from app.models.llm_connection import LLMConnection

    result = {"ready": False, "evaluator": None, "connection": None, "reason": ""}

    # Check setup state
    state = (
        db.query(EvaluatorSetupState)
        .filter(EvaluatorSetupState.id == "default")
        .first()
    )

    if not state:
        result["reason"] = "No setup state found"
        return result

    if not state.auto_eval_enabled:
        result["reason"] = "Auto-evaluation is disabled"
        return result

    # Check for valid default connection with API key
    connection = (
        db.query(LLMConnection)
        .filter(
            LLMConnection.is_default == True,
            LLMConnection.api_key_encrypted.isnot(None),
        )
        .first()
    )

    if not connection:
        result["reason"] = "No valid default LLM connection with API key"
        return result

    result["connection"] = connection

    # Check for active evaluator
    if not state.active_evaluator_id:
        result["reason"] = "No active evaluator selected"
        return result

    evaluator = (
        db.query(Evaluator)
        .filter(Evaluator.id == state.active_evaluator_id, Evaluator.is_active == True)
        .first()
    )

    if not evaluator:
        result["reason"] = (
            f"Active evaluator {state.active_evaluator_id} not found or inactive"
        )
        return result

    result["evaluator"] = evaluator
    result["ready"] = True
    return result


def get_evaluator_config(db: Session) -> dict:
    """
    Get evaluator config for processing (ignores auto_eval_enabled).
    Used by manual batch evaluation that explicitly triggers evaluation.

    Returns dict with:
        - ready: bool - whether we have a valid evaluator and connection
        - evaluator: Optional[Evaluator] - the active evaluator config
        - connection: Optional[LLMConnection] - the default connection
        - reason: str - description of why not ready (if applicable)
    """
    from app.models.evaluator import EvaluatorSetupState, Evaluator
    from app.models.llm_connection import LLMConnection

    result = {"ready": False, "evaluator": None, "connection": None, "reason": ""}

    # Check for valid default connection with API key
    connection = (
        db.query(LLMConnection)
        .filter(
            LLMConnection.is_default == True,
            LLMConnection.api_key_encrypted.isnot(None),
        )
        .first()
    )

    if not connection:
        result["reason"] = "No valid default LLM connection with API key"
        return result

    result["connection"] = connection

    # Check setup state for active evaluator
    state = (
        db.query(EvaluatorSetupState)
        .filter(EvaluatorSetupState.id == "default")
        .first()
    )

    if not state:
        result["reason"] = "No setup state found"
        return result

    # Use active evaluator (auto-eval) OR selected evaluator (manual/pending config)
    target_evaluator_id = state.active_evaluator_id or state.selected_evaluator_id

    if not target_evaluator_id:
        result["reason"] = "No evaluator selected"
        return result

    evaluator = (
        db.query(Evaluator)
        .filter(Evaluator.id == target_evaluator_id, Evaluator.is_active == True)
        .first()
    )

    if not evaluator:
        result["reason"] = f"Evaluator {target_evaluator_id} not found or inactive"
        return result

    result["evaluator"] = evaluator
    result["ready"] = True
    return result


def create_evaluator_from_config(evaluator_config, connection) -> LLMEvaluator:
    """
    Create an LLMEvaluator instance from database configuration.

    Includes support for custom output schemas and schema validation modes.
    """
    # Build custom prompts dict
    custom_prompts = evaluator_config.get_custom_prompts() if evaluator_config else None

    # Get custom schema configuration
    custom_schema = getattr(evaluator_config, "output_schema", None)
    schema_mode = getattr(evaluator_config, "schema_mode", "flexible") or "flexible"
    evaluator_id = getattr(evaluator_config, "id", None)

    # Create evaluator with connection settings and schema config
    return LLMEvaluator(
        api_key=decrypt_api_key(connection.api_key_encrypted),
        model=connection.default_model or "gpt-4o",
        base_url=connection.base_url,
        custom_prompts=custom_prompts,
        custom_schema=custom_schema,
        schema_mode=schema_mode,
        evaluator_id=evaluator_id,
    )


async def process_evaluation(
    job: EvalJob,
    db_session_factory: Callable[[], Session],
    evaluator: BaseBackendEvaluator,
) -> None:
    """
    Process a single trace evaluation.

    FIXED: Now properly handles traces with multiple spans
    ENHANCED: Detailed logging of what context is being evaluated
    """
    db: Session = db_session_factory()
    try:
        from app.models import Trace, Span

        # ============================================
        # Step 1: Fetch trace from database
        # ============================================
        trace = db.query(Trace).filter(Trace.id == job.trace_id).first()

        if not trace:
            logger.warning(f"Trace {job.trace_id} not found, skipping evaluation")
            return

        if trace.status not in ("pending", "review", None):
            logger.debug(
                f"Trace {job.trace_id} already evaluated (status={trace.status})"
            )
            return

        logger.info(f"Processing trace {job.trace_id}")

        # ============================================
        # Step 2: Extract objective for conversation (if not set)
        # ============================================
        from app.models import Conversation

        if trace.conversation_id:
            conversation = (
                db.query(Conversation)
                .filter(Conversation.id == trace.conversation_id)
                .first()
            )

            if conversation and not conversation.objective:
                # Check if this is the first trace in the conversation
                first_trace = (
                    db.query(Trace)
                    .filter(Trace.conversation_id == trace.conversation_id)
                    .order_by(Trace.start_time.asc())
                    .first()
                )

                if first_trace and first_trace.id == trace.id and trace.user_input:
                    logger.debug(
                        f"Extracting objective for conversation {trace.conversation_id}"
                    )
                    try:
                        llm_provider = get_llm_provider(
                            "openai",
                            api_key=getattr(evaluator, "api_key", None),
                            base_url=getattr(evaluator, "base_url", None),
                            model=getattr(evaluator, "model", None) or "gpt-4o",
                        )
                        objective = await extract_objective(
                            trace.user_input, llm_provider
                        )

                        if objective:
                            conversation.objective = objective
                            db.commit()
                            logger.info(
                                f"Objective extracted: {objective[:100]}..."
                            )
                    except Exception as e:
                        logger.warning(f"Failed to extract objective: {e}")

        # ============================================
        # Step 3: Build complete conversation context
        # ============================================
        user_input = trace.user_input or ""
        logger.debug(f"User input: {user_input[:100]}...")

        # Get final assistant output from trace OR last LLM span
        assistant_output = trace.assistant_output or ""
        logger.debug(
            f"Trace assistant_output: {assistant_output[:100] if assistant_output else '(empty)'}..."
        )

        # If trace doesn't have assistant_output, reconstruct from spans
        if not assistant_output:
            logger.debug("No assistant_output on trace, looking for LLM spans")

            # Get all spans ordered by time
            all_spans = (
                db.query(Span)
                .filter(Span.trace_id == job.trace_id)
                .order_by(Span.start_time.asc())
                .all()
            )

            logger.debug(f"Found {len(all_spans)} total spans")

            # Find the FINAL LLM output (last LLM span)
            llm_spans = [s for s in all_spans if s.span_type == "llm" and s.outputs]
            logger.debug(f"Found {len(llm_spans)} LLM spans with outputs")

            if llm_spans:
                assistant_output = llm_spans[-1].outputs
                logger.debug(
                    f"Using final LLM span output: {assistant_output[:100]}..."
                )
            else:
                logger.warning("No LLM spans found with outputs")

        # ============================================
        # Step 4: Fetch and process ALL spans
        # ============================================
        logger.debug(f"Fetching all spans for trace {job.trace_id}")

        all_spans = (
            db.query(Span)
            .filter(Span.trace_id == job.trace_id)
            .order_by(Span.start_time.asc())
            .all()
        )

        logger.debug(f"Retrieved {len(all_spans)} spans from database")

        # Build execution trace for evaluation
        execution_steps = []

        for i, span in enumerate(all_spans, 1):
            step = {
                "span_id": str(span.id),
                "type": span.span_type,
                "name": span.name,
                "inputs": span.inputs,
                "outputs": span.outputs,
                "model": span.model,
                "tokens": span.tokens,
                "processing_time": span.processing_time or 0,
                "error": span.error,
            }
            execution_steps.append(step)

            # Detailed logging of each span
            logger.debug(
                f"Span {i}/{len(all_spans)}: type={span.span_type}, name={span.name}, "
                f"model={span.model or 'N/A'}, tokens={span.tokens or 0}, "
                f"has_inputs={bool(span.inputs)}, has_outputs={bool(span.outputs)}, "
                f"processing_time={span.processing_time}s"
            )
            if span.outputs:
                logger.debug(f"  Span {span.name} output preview: {str(span.outputs)[:80]}...")
            if span.error:
                logger.error(f"  Span {span.name} error: {span.error}")

        # ============================================
        # Step 5: Prepare evaluation context
        # ============================================
        logger.debug("Building evaluation context")

        context = {
            "execution_steps": execution_steps,  # Full agentic flow
            "total_tokens": trace.total_tokens or 0,
            "total_cost": trace.cost or 0.0,
            "span_count": len(all_spans),
        }

        # Add tenant API key if available
        if job.api_key:
            context["api_key"] = job.api_key
            logger.debug("Using tenant-specific API key")

        logger.debug(
            f"Context summary: execution_steps={len(execution_steps)}, "
            f"total_tokens={context['total_tokens']}, "
            f"total_cost=${context['total_cost']:.4f}, "
            f"span_count={context['span_count']}"
        )

        # ============================================
        # Step 6: Perform evaluation
        # ============================================
        logger.debug("Calling LLM evaluator")

        result: EvalResult = await evaluator.evaluate(
            user_input=user_input, assistant_output=assistant_output, context=context
        )

        # ============================================
        # Step 7: Update trace with results
        # ============================================
        if result.span_evaluations:
            logger.debug(
                f"Saving {len(result.span_evaluations)} span evaluations"
            )

            for span_eval in result.span_evaluations:
                span_id = span_eval.span_id

                # Find the span in database
                span = db.query(Span).filter(Span.id == span_id).first()
                if not span:
                    logger.warning(f"Span {span_id} not found, skipping")
                    continue

                # Update span with evaluation results
                span.eval_relevant = span_eval.relevant
                span.eval_quality_score = span_eval.quality_score
                span.eval_issues = span_eval.issues
                span.eval_reasoning = span_eval.reasoning

                logger.debug(
                    f"Saved eval for span {span.name}: "
                    f"relevant={span.eval_relevant}, quality={span.eval_quality_score:.2f}"
                )

        # Update trace with overall evaluation
        logger.debug(
            f"Overall evaluation result: status={result.status}, "
            f"score={result.score:.2f}, failure_mode={result.failure_mode or 'None'}"
        )

        trace.status = result.status
        trace.score = result.score
        trace.failure_mode = result.failure_mode
        trace.eval_reason = result.reason
        trace.recommended_action = result.recommended_action

        # Store flexible evaluation metadata (custom fields, warnings, etc.)
        if result.metadata:
            trace.eval_metadata = result.metadata
            custom_fields = result.metadata.get("custom_fields", {})
            schema_warnings = result.metadata.get("schema_warnings", [])
            if custom_fields:
                logger.debug(f"Custom fields: {list(custom_fields.keys())}")
            if schema_warnings:
                logger.debug(f"Schema warnings: {len(schema_warnings)}")

        db.commit()

        logger.info(
            f"Trace {job.trace_id} evaluated: "
            f"status={result.status}, "
            f"score={result.score:.2f}, "
            f"spans={len(all_spans)}"
        )

    except Exception as e:
        logger.exception(f"Evaluation failed for trace {job.trace_id}")

        db.rollback()

        # Mark as review on error so it can be manually reviewed
        try:
            trace = db.query(Trace).filter(Trace.id == job.trace_id).first()
            if trace:
                trace.status = "review"
                trace.eval_reason = f"Auto-evaluation failed: {str(e)[:200]}"
                db.commit()
                logger.info(
                    f"Marked trace {job.trace_id} as 'review' due to error"
                )
        except Exception as inner_e:
            logger.error(f"Failed to mark trace {job.trace_id} as review: {inner_e}")
    finally:
        db.close()


async def run_eval_worker(
    db_session_factory: Callable[[], Session],
    poll_interval: float = 0.5,
    batch_size: int = 5,
) -> None:
    """
    Background worker loop that processes the evaluation queue.

    Now checks database configuration for auto-eval settings.

    Args:
        db_session_factory: Factory function to create DB sessions
        poll_interval: Seconds to wait when queue is empty
        batch_size: Number of concurrent evaluations to process
    """
    logger.info("Evaluation worker started")

    # Track when to reload config
    last_config_check = 0
    config_check_interval = 2  # Re-check config every 2 seconds

    # Cached evaluator (invalidated when evaluator OR connection changes)
    cached_evaluator = None
    cached_evaluator_id = None
    cached_connection_id = None
    cached_connection_updated = None

    while True:
        try:
            import time

            current_time = time.time()

            # Periodically check/reload evaluator configuration from database
            # This uses get_evaluator_config which ignores auto_eval_enabled
            # so manual batch evaluations work regardless of toggle state
            if current_time - last_config_check > config_check_interval:
                db = db_session_factory()
                try:
                    # Use get_evaluator_config - works for both auto and manual eval
                    eval_config = get_evaluator_config(db)

                    if not eval_config["ready"]:
                        logger.debug(
                            f"No evaluator config ready: {eval_config['reason']}"
                        )
                        cached_evaluator = None
                        cached_evaluator_id = None
                        cached_connection_id = None
                        cached_connection_updated = None
                    else:
                        # Recreate evaluator if config changed
                        evaluator_config = eval_config["evaluator"]
                        connection = eval_config["connection"]

                        connection_changed = (
                            connection.id != cached_connection_id
                            or connection.updated_at != cached_connection_updated
                        )
                        if (
                            evaluator_config.id != cached_evaluator_id
                            or connection_changed
                        ):
                            cached_evaluator = create_evaluator_from_config(
                                evaluator_config, connection
                            )
                            cached_evaluator_id = evaluator_config.id
                            cached_connection_id = connection.id
                            cached_connection_updated = connection.updated_at
                            logger.info(
                                f"Loaded evaluator: {evaluator_config.name} "
                                f"(model: {connection.default_model})"
                            )

                    last_config_check = current_time
                finally:
                    db.close()

            # Check for jobs in queue - process them if we have an evaluator
            # This works for both auto-triggered and manual batch evaluations

            # Process up to batch_size items concurrently
            jobs_to_process = []
            for _ in range(batch_size):
                try:
                    job = eval_queue.get_nowait()
                    jobs_to_process.append(job)
                except Empty:
                    break

            if jobs_to_process:
                # Check if we have an evaluator ready
                if not cached_evaluator:
                    logger.warning(
                        f"{len(jobs_to_process)} jobs in queue but no evaluator configured. "
                        "Please select an evaluator in LLM-as-a-Judge settings."
                    )
                    # Put jobs back in queue
                    for job in jobs_to_process:
                        eval_queue.put(job)
                    await asyncio.sleep(poll_interval * 4)
                    continue

                logger.info(
                    f"Processing batch of {len(jobs_to_process)} traces"
                )

                # Process batch concurrently
                tasks = [
                    process_evaluation(job, db_session_factory, cached_evaluator)
                    for job in jobs_to_process
                ]
                await asyncio.gather(*tasks, return_exceptions=True)

                logger.info("Batch complete")
            else:
                # Queue is empty, wait before polling again
                await asyncio.sleep(poll_interval)

        except asyncio.CancelledError:
            logger.info("Evaluation worker shutting down")
            break
        except Exception as e:
            logger.error(
                f"Worker error ({type(e).__name__}): {e}", exc_info=True
            )
            await asyncio.sleep(1)  # Back off on error
