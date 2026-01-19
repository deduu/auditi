"""
Async background worker for processing trace evaluations.

Uses an in-memory queue for simplicity. For production scale,
consider replacing with Redis/Celery or a proper task queue.
"""
import asyncio
import logging
from queue import Queue, Empty
from typing import Callable, Optional
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.evaluators import LLMEvaluator

logger = logging.getLogger("auditi.eval_worker")


@dataclass
class EvalJob:
    """Represents an evaluation job in the queue."""
    trace_id: str
    api_key: Optional[str] = None  # Per-tenant API key if available


# In-memory evaluation queue
# For production, replace with Redis Queue, Celery, or similar
eval_queue: Queue[EvalJob] = Queue()


def enqueue_evaluation(trace_id: str, api_key: Optional[str] = None) -> None:
    """
    Add a trace to the evaluation queue.
    
    Args:
        trace_id: ID of the trace to evaluate
        api_key: Optional per-tenant API key for LLM calls
    """
    job = EvalJob(trace_id=trace_id, api_key=api_key)
    eval_queue.put(job)
    logger.debug(f"Enqueued trace {trace_id} for evaluation")


async def process_evaluation(
    job: EvalJob, 
    db_session_factory: Callable[[], Session],
    evaluator: LLMEvaluator
) -> None:
    """
    Process a single trace evaluation.
    
    Args:
        job: The evaluation job containing trace_id and optional api_key
        db_session_factory: Factory function to create DB sessions
        evaluator: The LLM evaluator instance
    """
    db: Session = db_session_factory()
    try:
        # Import here to avoid circular imports
        from app.models import Trace
        
        trace = db.query(Trace).filter(Trace.id == job.trace_id).first()
        
        if not trace:
            logger.warning(f"Trace {job.trace_id} not found, skipping evaluation")
            return
        
        # Skip if already evaluated (not pending)
        if trace.status not in ("pending", "review", None):
            logger.debug(f"Trace {job.trace_id} already evaluated (status={trace.status})")
            return
        
        logger.info(f"Evaluating trace {job.trace_id}")
        
        # Prepare context with optional tenant API key
        context = {"api_key": job.api_key} if job.api_key else None
        
        # Run LLM evaluation
        result = await evaluator.evaluate(
            user_input=trace.user_input or "",
            assistant_output=trace.assistant_output or "",
            context=context
        )
        
        # Update trace with evaluation results
        trace.status = result["status"]
        trace.score = result["score"]
        trace.failure_mode = result.get("failure_mode")
        trace.eval_reason = result.get("reason")
        
        db.commit()
        logger.info(f"Trace {job.trace_id} evaluated: status={result['status']}, score={result['score']:.2f}")
        
    except Exception as e:
        logger.error(f"Evaluation failed for trace {job.trace_id}: {e}")
        db.rollback()
        
        # Mark as review on error so it can be manually reviewed
        try:
            trace = db.query(Trace).filter(Trace.id == job.trace_id).first()
            if trace:
                trace.status = "review"
                trace.eval_reason = f"Auto-evaluation failed: {str(e)[:200]}"
                db.commit()
        except Exception:
            pass
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
                # Process batch concurrently
                tasks = [
                    process_evaluation(job, db_session_factory, evaluator)
                    for job in jobs_to_process
                ]
                await asyncio.gather(*tasks, return_exceptions=True)
            else:
                # Queue is empty, wait before polling again
                await asyncio.sleep(poll_interval)
                
        except asyncio.CancelledError:
            logger.info("[Auditi] Evaluation worker shutting down")
            break
        except Exception as e:
            logger.error(f"[Auditi] Worker error: {e}")
            await asyncio.sleep(1)  # Back off on error
