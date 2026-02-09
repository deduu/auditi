# Copyright (c) 2026 Auditi Contributors. Licensed under the BSL 1.1 (see LICENSES/BSL-1.1.md).
import uuid
from sqlalchemy.orm import Session
from app.models import Action
from app.services.analytics import generate_insights


def generate_actions_from_insights(db: Session):
    """
    Generate Action items based on current insights.
    Only creates new actions if open actions for the same issue don't already exist.
    Also auto-resolves actions if the underlying issue is no longer present in insights.
    """
    # 1. Get current insights (default 7d)
    insights, _ = generate_insights(db, time_range="7d")

    generated_count = 0
    active_issues = set()  # Track issues found in this run

    # 2. Map insights to potential actions
    for insight in insights:
        # We only care about negative insights for actions (warning/danger)
        # or specific optimization opportunities (info + cost)
        if insight.type == "success":
            continue

        action_title = ""
        action_desc = ""
        priority = "medium"
        category = insight.category

        # Determine Action details based on Insight
        if insight.category == "reliability":
            if "High Error Rate" in insight.title:
                action_title = "Investigate High Error Rates"
                action_desc = f"Error rate is critical ({insight.metric_value}). Analyze logs to identify root causes."
                priority = "high"
                active_issues.add("error_rate_issue")
            elif "Dominant Failure Mode" in insight.title:
                try:
                    mode_name = insight.description.split("'")[1]
                    action_title = f"Fix {mode_name} Failures"
                    active_issues.add(f"failure_mode:{mode_name}")
                except IndexError:
                    action_title = "Fix Frequent Failures"
                    active_issues.add("failure_mode:generic")
                action_desc = insight.description
                priority = "high" if insight.type == "danger" else "medium"
            else:
                action_title = f"Address {insight.title}"
                action_desc = insight.description
                active_issues.add(f"other:{insight.title}")

        elif insight.category == "quality":
            if "Quality Below Target" in insight.title:
                action_title = "Improve Model Quality"
                action_desc = f"Quality score ({insight.metric_value}) is below target. Review failing traces."
                priority = "high"
                active_issues.add("quality_issue")
            elif "Quality Declining" in insight.title:
                action_title = "Investigate Quality Regression"
                action_desc = insight.description
                priority = "medium"
                active_issues.add("quality_regression")

        elif insight.category == "cost" and "Optimization" in insight.title:
            action_title = "Optimize Model Routing"
            action_desc = insight.description
            priority = "medium"
            active_issues.add("cost_optimization")

        elif insight.category == "performance" and "Traffic Surge" in insight.title:
            action_title = "Scale Infrastructure"
            action_desc = insight.description
            priority = "medium"
            active_issues.add("traffic_surge")

        # If we didn't match a specific actionable pattern, skip
        if not action_title:
            continue

        # 3. Check for duplicates
        # We check if there is any PENDING or IN_PROGRESS action with the same title
        existing = (
            db.query(Action)
            .filter(
                Action.title == action_title,
                Action.status.in_(["pending", "in-progress"]),
            )
            .first()
        )

        if not existing:
            # 4. Create new Action
            new_action = Action(
                id=str(uuid.uuid4()),
                title=action_title,
                description=action_desc,
                priority=priority,
                status="pending",
                category=category.capitalize(),
            )
            db.add(new_action)
            generated_count += 1

    # 5. System Update: Check if issues verifyably gone
    # We DO NOT auto-resolve. We just note it in the description if it APPEARS fixed.

    # Check Error Rate actions
    if "error_rate_issue" not in active_issues:
        update_actions_as_undetected(db, "Investigate High Error Rates")

    # Check Quality actions
    if "quality_issue" not in active_issues:
        update_actions_as_undetected(db, "Improve Model Quality")

    # Check Failure Mode actions
    open_failure_actions = (
        db.query(Action)
        .filter(
            Action.title.like("Fix % Failures"),
            Action.status.in_(["pending", "in-progress"]),
        )
        .all()
    )

    for action in open_failure_actions:
        # Extract mode name: "Fix Hallucination Failures" -> "Hallucination"
        try:
            if action.title == "Fix Frequent Failures":
                if "failure_mode:generic" not in active_issues:
                    mark_undetected(action)
                continue

            parts = action.title.split(" ")
            if len(parts) >= 3:
                mode_name = " ".join(parts[1:-1])
                if f"failure_mode:{mode_name}" not in active_issues:
                    mark_undetected(action)
        except Exception:
            pass

    if generated_count > 0:
        db.commit()
    else:
        db.commit()

    return generated_count


def update_actions_as_undetected(db: Session, title: str):
    """Add note that issue is undetected, but leave open."""
    actions = (
        db.query(Action)
        .filter(Action.title == title, Action.status.in_(["pending", "in-progress"]))
        .all()
    )
    for action in actions:
        mark_undetected(action)


def mark_undetected(action: Action):
    """Update action description to note issue is gone."""
    note = "[System: Issue no longer detected]"
    if action.description and note not in action.description:
        action.description += f" {note}"
    elif not action.description:
        action.description = note
