"""
Async background worker for processing trace evaluations.

FIXED: Now properly evaluates traces with multiple spans (tools + LLMs)
ENHANCED: Comprehensive logging to debug evaluation context
"""
import asyncio
import logging
from queue import Queue, Empty
from typing import Callable, Optional
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.evaluators import LLMEvaluator
from app.evaluators.base import EvalResult

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
    print(f"[EVAL WORKER] Enqueued trace {trace_id} for evaluation")


async def process_evaluation(
    job: EvalJob, 
    db_session_factory: Callable[[], Session],
    evaluator: LLMEvaluator
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
            print(f"[EVAL WORKER] ⚠️ Trace {job.trace_id} not found in database")
            return
        
        if trace.status not in ("pending", "review", None):
            logger.debug(f"Trace {job.trace_id} already evaluated (status={trace.status})")
            print(f"[EVAL WORKER] ℹ️ Trace {job.trace_id} already evaluated (status={trace.status})")
            return
        
        print(f"\n{'='*80}")
        print(f"[EVAL WORKER] Processing trace {job.trace_id}")
        print(f"{'='*80}")
        
        # ============================================
        # Step 2: Build complete conversation context
        # ============================================
        user_input = trace.user_input or ""
        print(f"[EVAL WORKER] User input: {user_input[:100]}...")
        
        # Get final assistant output from trace OR last LLM span
        assistant_output = trace.assistant_output or ""
        print(f"[EVAL WORKER] Trace assistant_output: {assistant_output[:100] if assistant_output else '(empty)'}...")
        
        # If trace doesn't have assistant_output, reconstruct from spans
        if not assistant_output:
            print(f"[EVAL WORKER] No assistant_output on trace, looking for LLM spans...")
            
            # Get all spans ordered by time
            all_spans = (
                db.query(Span)
                .filter(Span.trace_id == job.trace_id)
                .order_by(Span.start_time.asc())
                .all()
            )
            
            print(f"[EVAL WORKER] Found {len(all_spans)} total spans")
            
            # Find the FINAL LLM output (last LLM span)
            llm_spans = [s for s in all_spans if s.span_type == "llm" and s.outputs]
            print(f"[EVAL WORKER] Found {len(llm_spans)} LLM spans with outputs")
            
            if llm_spans:
                assistant_output = llm_spans[-1].outputs
                print(f"[EVAL WORKER] Using final LLM span output: {assistant_output[:100]}...")
            else:
                print(f"[EVAL WORKER] ⚠️ No LLM spans found with outputs!")
        
        # ============================================
        # Step 3: Fetch and process ALL spans
        # ============================================
        print(f"\n[EVAL WORKER] Fetching all spans for trace {job.trace_id}...")
        
        all_spans = (
            db.query(Span)
            .filter(Span.trace_id == job.trace_id)
            .order_by(Span.start_time.asc())
            .all()
        )
        
        print(f"[EVAL WORKER] Retrieved {len(all_spans)} spans from database")
        
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
                "error": span.error
            }
            execution_steps.append(step)
            
            # Detailed logging of each span
            print(f"\n[EVAL WORKER] Span {i}/{len(all_spans)}:")
            print(f"  - Type: {span.span_type}")
            print(f"  - Name: {span.name}")
            print(f"  - Model: {span.model or 'N/A'}")
            print(f"  - Tokens: {span.tokens or 0}")
            print(f"  - Has inputs: {bool(span.inputs)}")
            print(f"  - Has outputs: {bool(span.outputs)}")
            print(f"  - Processing time: {span.processing_time}s")
            if span.outputs:
                print(f"  - Output preview: {str(span.outputs)[:80]}...")
            if span.error:
                print(f"  - ERROR: {span.error}")
        
        # ============================================
        # Step 4: Prepare evaluation context
        # ============================================
        print(f"\n[EVAL WORKER] Building evaluation context...")
        
        context = {
            "execution_steps": execution_steps,  # Full agentic flow
            "total_tokens": trace.total_tokens or 0,
            "total_cost": trace.cost or 0.0,
            "span_count": len(all_spans),
        }
        
        # Add tenant API key if available
        if job.api_key:
            context["api_key"] = job.api_key
            print(f"[EVAL WORKER] Using tenant-specific API key")
        
        print(f"[EVAL WORKER] Context summary:")
        print(f"  - Execution steps: {len(execution_steps)}")
        print(f"  - Total tokens: {context['total_tokens']}")
        print(f"  - Total cost: ${context['total_cost']:.4f}")
        print(f"  - Span count: {context['span_count']}")
        
        # ============================================
        # Step 5: Perform evaluation
        # ============================================
        print(f"\n[EVAL WORKER] Calling LLM evaluator...")
        
        result: EvalResult = await evaluator.evaluate(
            user_input=user_input,
            assistant_output=assistant_output,
            context=context
        )
        
        
        # ============================================
        # Step 6: Update trace with results
        # ============================================
        if result.span_evaluations:
            print(f"\n[EVAL WORKER] Saving {len(result.span_evaluations)} span evaluations...")
            
            for span_eval in result.span_evaluations:
                span_id = span_eval.span_id
                
                # Find the span in database
                span = db.query(Span).filter(Span.id == span_id).first()
                if not span:
                    print(f"[EVAL WORKER] ⚠️ Span {span_id} not found, skipping")
                    continue
                
                # Update span with evaluation results
                span.eval_relevant = span_eval.relevant
                span.eval_quality_score = span_eval.quality_score
                span.eval_issues = span_eval.issues
                span.eval_reasoning = span_eval.reasoning
                
                print(f"[EVAL WORKER] ✅ Saved eval for span {span.name}: "
                      f"relevant={span.eval_relevant}, quality={span.eval_quality_score:.2f}")
        
         # Update trace with overall evaluation
        print(f"\n[EVAL WORKER] Overall evaluation result:")
        print(f"  - Status: {result.status}")
        print(f"  - Score: {result.score:.2f}")
        print(f"  - Failure mode: {result.failure_mode or 'None'}")
        
        
        trace.status = result.status
        trace.score = result.score
        trace.failure_mode = result.failure_mode
        trace.eval_reason = result.reason
        
        db.commit()
        
        logger.info(
            f"Trace {job.trace_id} evaluated: "
            f"status={result.status}, "
            f"score={result.score:.2f}, "
            f"spans={len(all_spans)}"
        )
        
        print(f"[EVAL WORKER] ✅ Trace {job.trace_id} evaluation saved to database")
        print(f"{'='*80}\n")
        
    except Exception as e:
        logger.error(f"Evaluation failed for trace {job.trace_id}: {e}")
        print(f"\n[EVAL WORKER] ❌ ERROR during evaluation: {e}")
        print(f"{'='*80}\n")
        
        db.rollback()
        
        # Mark as review on error so it can be manually reviewed
        try:
            trace = db.query(Trace).filter(Trace.id == job.trace_id).first()
            if trace:
                trace.status = "review"
                trace.eval_reason = f"Auto-evaluation failed: {str(e)[:200]}"
                db.commit()
                print(f"[EVAL WORKER] Marked trace {job.trace_id} as 'review' due to error")
        except Exception as inner_e:
            print(f"[EVAL WORKER] Failed to mark trace as review: {inner_e}")
    finally:
        db.close()


async def run_eval_worker(
    db_session_factory: Callable[[], Session],
    poll_interval: float = 0.5,
    batch_size: int = 5
) -> None:
    """
    Background worker loop that processes the evaluation queue.
    
    Args:
        db_session_factory: Factory function to create DB sessions
        poll_interval: Seconds to wait when queue is empty
        batch_size: Number of concurrent evaluations to process
    """
    evaluator = LLMEvaluator()
    logger.info("[Auditi] Evaluation worker started")
    print("[EVAL WORKER] 🚀 Evaluation worker started")
    
    while True:
        try:
            # Process up to batch_size items concurrently
            jobs_to_process = []
            for _ in range(batch_size):
                try:
                    job = eval_queue.get_nowait()
                    jobs_to_process.append(job)
                except Empty:
                    break
            
            if jobs_to_process:
                print(f"\n[EVAL WORKER] Processing batch of {len(jobs_to_process)} traces")
                
                # Process batch concurrently
                tasks = [
                    process_evaluation(job, db_session_factory, evaluator)
                    for job in jobs_to_process
                ]
                await asyncio.gather(*tasks, return_exceptions=True)
                
                print(f"[EVAL WORKER] Batch complete\n")
            else:
                # Queue is empty, wait before polling again
                await asyncio.sleep(poll_interval)
                
        except asyncio.CancelledError:
            logger.info("[Auditi] Evaluation worker shutting down")
            print("[EVAL WORKER] 🛑 Evaluation worker shutting down")
            break
        except Exception as e:
            logger.error(f"[Auditi] Worker error: {e}")
            print(f"[EVAL WORKER] ❌ Worker error: {e}")
            await asyncio.sleep(1)  # Back off on error