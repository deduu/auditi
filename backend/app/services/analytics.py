from sqlalchemy.orm import Session
from sqlalchemy import func, case
from app.models import Trace
from app.schemas.analytics import InsightItem
from datetime import datetime, timedelta, timezone


def get_date_range(time_range: str):
    """Parse time range string and return start/end dates."""
    now = datetime.now(timezone.utc)
    if time_range == "24h":
        start = now - timedelta(hours=24)
        prev_start = now - timedelta(hours=48)
    elif time_range == "7d":
        start = now - timedelta(days=7)
        prev_start = now - timedelta(days=14)
    elif time_range == "30d":
        start = now - timedelta(days=30)
        prev_start = now - timedelta(days=60)
    elif time_range == "90d":
        start = now - timedelta(days=90)
        prev_start = now - timedelta(days=180)
    else:
        start = now - timedelta(days=7)
        prev_start = now - timedelta(days=14)

    return start, prev_start, now


def generate_insights(db: Session, time_range: str = "7d"):
    """
    Generate insights from specific time range.
    Returns tuple: (insights_list, summary_dict)
    """
    start_date, prev_start, now = get_date_range(time_range)

    # Current period aggregates
    curr = (
        db.query(
            func.avg(Trace.score).label("avg_score"),
            func.avg(Trace.latency).label("avg_latency"),
            func.sum(Trace.cost).label("total_cost"),
            func.count(Trace.id).label("volume"),
            func.sum(case((Trace.status == "fail", 1), else_=0)).label("failures"),
        )
        .filter(Trace.start_time >= start_date)
        .first()
    )

    # Previous period aggregates
    prev = (
        db.query(
            func.avg(Trace.score).label("avg_score"),
            func.avg(Trace.latency).label("avg_latency"),
            func.sum(Trace.cost).label("total_cost"),
            func.count(Trace.id).label("volume"),
            func.sum(case((Trace.status == "fail", 1), else_=0)).label("failures"),
        )
        .filter(Trace.start_time >= prev_start, Trace.start_time < start_date)
        .first()
    )

    # Model performance
    model_stats = (
        db.query(
            Trace.model_name,
            func.avg(Trace.score).label("avg_score"),
            func.sum(Trace.cost).label("total_cost"),
            func.count(Trace.id).label("volume"),
        )
        .filter(Trace.start_time >= start_date, Trace.model_name != None)
        .group_by(Trace.model_name)
        .all()
    )

    # Failure modes
    failure_modes = (
        db.query(Trace.failure_mode, func.count(Trace.id).label("count"))
        .filter(
            Trace.start_time >= start_date,
            Trace.failure_mode != None,
            Trace.status == "fail",
        )
        .group_by(Trace.failure_mode)
        .order_by(func.count(Trace.id).desc())
        .limit(5)
        .all()
    )

    insights = []

    # Calculate metrics
    curr_score = (curr.avg_score or 0) * 100
    prev_score = (prev.avg_score or 0) * 100 if prev else 0
    curr_error_rate = (curr.failures / curr.volume * 100) if curr and curr.volume else 0

    # We calculate score change but don't strictly require prev data for all insights
    score_change = curr_score - prev_score if prev_score > 0 else 0

    # Quality insights
    if curr_score >= 80:
        insights.append(
            InsightItem(
                type="success",
                category="quality",
                title="Strong Quality Performance",
                description=f"Average score is {curr_score:.1f}%, indicating high-quality AI responses.",
                metric_value=f"{curr_score:.1f}%",
                recommendation="Maintain current quality standards and document successful patterns.",
            )
        )
    elif curr_score < 60 and curr.volume > 0:
        insights.append(
            InsightItem(
                type="danger",
                category="quality",
                title="Quality Below Target",
                description=f"Average score is {curr_score:.1f}%, below the recommended 60% threshold.",
                metric_value=f"{curr_score:.1f}%",
                recommendation="Review low-scoring traces and identify common failure patterns.",
            )
        )

    # Score trend
    if prev_score > 0:
        if score_change <= -5:
            insights.append(
                InsightItem(
                    type="warning",
                    category="quality",
                    title="Quality Declining",
                    description=f"Score dropped by {abs(score_change):.1f}% compared to previous period.",
                    metric_value=f"{score_change:+.1f}%",
                    recommendation="Investigate recent changes that may have affected quality.",
                )
            )
        elif score_change >= 5:
            insights.append(
                InsightItem(
                    type="success",
                    category="quality",
                    title="Quality Improving",
                    description=f"Score improved by {score_change:.1f}% compared to previous period.",
                    metric_value=f"+{score_change:.1f}%",
                    recommendation="Document changes that led to improvement for future reference.",
                )
            )

    # Error rate insights
    if curr_error_rate > 10:
        insights.append(
            InsightItem(
                type="danger",
                category="reliability",
                title="High Error Rate",
                description=f"Error rate is {curr_error_rate:.1f}%, significantly above acceptable levels.",
                metric_value=f"{curr_error_rate:.1f}%",
                recommendation="Prioritize error investigation and implement error handling improvements.",
            )
        )
    elif curr_error_rate > 5:
        insights.append(
            InsightItem(
                type="warning",
                category="reliability",
                title="Elevated Error Rate",
                description=f"Error rate is {curr_error_rate:.1f}%, consider investigating failures.",
                metric_value=f"{curr_error_rate:.1f}%",
                recommendation="Review failure modes and address the most common issues.",
            )
        )

    # Cost insights
    if model_stats:
        # Find cost optimization opportunities
        models_by_cost_efficiency = sorted(
            model_stats,
            key=lambda m: (
                ((m.avg_score or 0) / (m.total_cost / m.volume))
                if m.total_cost and m.volume
                else 0
            ),
            reverse=True,
        )

        if len(models_by_cost_efficiency) > 1:
            best = models_by_cost_efficiency[0]
            worst = models_by_cost_efficiency[-1]
            if (
                best.model_name != worst.model_name
                and best.volume > 5
                and worst.volume > 5
            ):
                best_efficiency = (
                    (best.avg_score or 0) * 100 / (best.total_cost / best.volume)
                    if best.total_cost and best.volume
                    else 0
                )
                worst_efficiency = (
                    (worst.avg_score or 0) * 100 / (worst.total_cost / worst.volume)
                    if worst.total_cost and worst.volume
                    else 0
                )

                # Check if efficiencies are valid numbers greater than 0
                if worst_efficiency > 0 and best_efficiency > worst_efficiency * 1.5:
                    insights.append(
                        InsightItem(
                            type="info",
                            category="cost",
                            title="Cost Optimization Opportunity",
                            description=f"{best.model_name} offers better cost efficiency than {worst.model_name}.",
                            metric_value=f"{best_efficiency:.1f} vs {worst_efficiency:.1f} score/$",
                            recommendation=f"Consider shifting more traffic to {best.model_name} for cost savings.",
                        )
                    )

    # Failure mode insights
    if failure_modes:
        top_failure = failure_modes[0]
        total_failures = sum(f.count for f in failure_modes)
        top_percentage = (
            (top_failure.count / total_failures * 100) if total_failures else 0
        )

        if top_percentage > 40:
            insights.append(
                InsightItem(
                    type="warning",
                    category="reliability",
                    title="Dominant Failure Mode",
                    description=f"'{top_failure.failure_mode}' accounts for {top_percentage:.0f}% of failures.",
                    metric_value=f"{top_failure.count} occurrences",
                    recommendation=f"Focus improvement efforts on addressing '{top_failure.failure_mode}' issues.",
                )
            )

    # Volume insights
    if curr.volume and prev and prev.volume:
        volume_change = ((curr.volume - prev.volume) / prev.volume) * 100
        if volume_change > 50:
            insights.append(
                InsightItem(
                    type="info",
                    category="performance",
                    title="Traffic Surge",
                    description=f"Request volume increased by {volume_change:.0f}% compared to previous period.",
                    metric_value=f"{curr.volume} requests",
                    recommendation="Monitor system performance and consider scaling if trend continues.",
                )
            )

    # Summary
    summary = {
        "total_insights": len(insights),
        "by_type": {
            "success": len([i for i in insights if i.type == "success"]),
            "warning": len([i for i in insights if i.type == "warning"]),
            "danger": len([i for i in insights if i.type == "danger"]),
            "info": len([i for i in insights if i.type == "info"]),
        },
        "current_score": round(curr_score, 1),
        "current_error_rate": round(curr_error_rate, 1),
        "total_cost": round(curr.total_cost or 0, 4),
        "total_volume": curr.volume or 0,
    }

    return insights, summary
