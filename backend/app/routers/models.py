# Copyright (c) 2026 Auditibl Inc.
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

"""Models API routes."""

from fastapi import APIRouter
from typing import List

from app.schemas import ModelStat

router = APIRouter(tags=["models"])


from app.database import get_db
from app.models import Span
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from fastapi import Depends


@router.get("/models", response_model=List[ModelStat])
@router.get("/v1/models", response_model=List[ModelStat])
def get_models(db: Session = Depends(get_db)):
    """
    Get aggregated model statistics from Spans.
    """
    try:
        # Aggregate data from Spans where type='llm' and model is set
        results = (
            db.query(
                Span.model,
                func.count(Span.id).label("requests"),
                # Database agnostic way to get seconds (for Postgres use extract epoch)
                func.avg(
                    func.extract("epoch", Span.end_time)
                    - func.extract("epoch", Span.start_time)
                ).label("avg_latency_seconds"),
                func.sum(Span.cost).label("total_cost"),
                func.sum(Span.input_tokens + Span.output_tokens).label("total_tokens"),
                func.avg(Span.eval_quality_score).label("avg_quality"),
            )
            .filter(Span.span_type == "llm", Span.model != None)
            .group_by(Span.model)
            .all()
        )

        stats = []
        raw_data = []

        # First pass: Collect raw data to enable cross-model comparison
        for row in results:
            model_name = row.model
            req_count = row.requests or 0
            avg_latency_sec = row.avg_latency_seconds or 0
            total_cost = row.total_cost or 0.0
            total_tokens = row.total_tokens or 0
            avg_quality = row.avg_quality or 0.0

            # Calculate metrics
            cost_per_1k = (
                (total_cost / (total_tokens / 1000)) if total_tokens > 0 else 0.0
            )

            # Simple ROI metric: Quality / Cost (Avoiding div by zero)
            # Normalize cost to avoid huge numbers. Let's say cost per 1k is usually 0.001 to 0.03
            # If cost is 0, we can't really calc ROI based on cost, maybe set to high value or 0
            roi = (avg_quality / cost_per_1k) if cost_per_1k > 0.000001 else 0.0

            raw_data.append(
                {
                    "name": model_name,
                    "requests": req_count,
                    "latency_ms": avg_latency_sec * 1000,
                    "cost_per_1k": cost_per_1k,
                    "accuracy": avg_quality * 100,  # Convert 0-1 to percentage
                    "roi": roi,
                    "avg_quality": avg_quality,
                }
            )

        # Second pass: Generate suggestions and build response
        # Simple strategy: If model A has similar quality to model B but is more expensive, suggest B.

        # Sort by quality desc to find high perf models
        sorted_by_quality = sorted(
            raw_data, key=lambda x: x["avg_quality"], reverse=True
        )

        for model in raw_data:
            suggestions = []

            # Check for cheaper alternatives with similar quality (within 5% margin)
            for other in raw_data:
                if other["name"] == model["name"]:
                    continue

                # If other model is cheaper
                if other["cost_per_1k"] < model["cost_per_1k"]:
                    # And quality is decent (at least 95% of this model's quality)
                    quality_ratio = (
                        other["avg_quality"] / model["avg_quality"]
                        if model["avg_quality"] > 0
                        else 1.0
                    )

                    if quality_ratio >= 0.95:
                        savings = (
                            (model["cost_per_1k"] - other["cost_per_1k"])
                            / model["cost_per_1k"]
                        ) * 100
                        suggestions.append(
                            f"Switch to {other['name']} to save {savings:.0f}% with similar quality."
                        )

            # Sort suggestions by savings?
            # For now just pick top one

            stats.append(
                ModelStat(
                    id=0,  # ID is generated in frontend or DB, here we're aggregating.
                    name=model["name"],
                    status="active",
                    accuracy=model["accuracy"],
                    latency_ms=model["latency_ms"],
                    cost_per_1k=model["cost_per_1k"],
                    requests=model["requests"],
                    roi=model["roi"],
                    suggestions=suggestions,
                    task_performance={},  # Placeholder for now
                )
            )

        # Assign fake IDs for stable keying if needed, though name is unique
        for i, stat in enumerate(stats):
            stat.id = i + 1

        return stats
    except Exception as e:
        import traceback

        traceback.print_exc()
        raise e
