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
Base evaluator class for implementing custom evaluation logic.
"""
from abc import ABC, abstractmethod
from .types import TraceInput, EvaluationResult


class BaseEvaluator(ABC):
    """
    Abstract base class for trace evaluators.

    Subclass this to implement custom evaluation logic for your AI agents.
    The evaluator is called after each trace completes and before sending
    to the Auditi platform.

    Example:
        >>> class QualityEvaluator(BaseEvaluator):
        ...     def evaluate(self, trace: TraceInput) -> EvaluationResult:
        ...         score = calculate_quality(trace.assistant_output)
        ...         return EvaluationResult(
        ...             status="pass" if score > 0.7 else "fail",
        ...             score=score,
        ...             reason="Quality check"
        ...         )
    """

    @abstractmethod
    def evaluate(self, trace: TraceInput) -> EvaluationResult:
        """
        Evaluate a trace and return a pass/fail result with a score.

        Args:
            trace: The complete trace data including input, output, and spans

        Returns:
            EvaluationResult with status, score, and optional details
        """
        pass
