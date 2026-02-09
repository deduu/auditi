# Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
"""
Human-based evaluator for manual review workflows.

Returns traces with "review" status for human evaluation.
"""

from typing import Optional, Dict, Any

from .base import BaseBackendEvaluator, EvalResult


class HumanEvaluator(BaseBackendEvaluator):
    """
    Human-based evaluator that marks traces for manual review.

    This evaluator does not perform automatic evaluation. Instead, it marks
    all traces as "review" status, allowing human reviewers to evaluate them
    through the UI.
    """

    async def evaluate(
        self,
        user_input: str,
        assistant_output: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> EvalResult:
        """
        Mark trace for human review.

        Args:
            user_input: The user's original input/question
            assistant_output: The AI assistant's response
            context: Optional additional context

        Returns:
            EvalResult with status="review" for human evaluation
        """
        print("[HUMAN EVALUATOR] Trace marked for human review")

        return EvalResult(
            status="review",
            score=0.0,  # No score until human reviews
            failure_mode=None,
            reason="Pending human review. This trace requires manual evaluation.",
            recommended_action=None,
            span_evaluations=[],
            metadata={"evaluator": "human", "pending_review": True},
        )
