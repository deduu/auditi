"""
Query functions for the natural language query engine.

Each function takes a SQLAlchemy Session and keyword arguments,
executes a database query, and returns (data_list, visualization_hint).
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import String, case, cast, desc, func, or_
from sqlalchemy.orm import Session

from app.models import (
    Action,
    Annotation,
    Conversation,
    Evaluator,
    ScoreConfig,
    Span,
    Trace,
)

logger = logging.getLogger("auditi.nl_query_functions")


# ── helpers ──────────────────────────────────────────────────────────


def _exclude_system_traces(query):
    """Exclude Ask Auditi self-traces from query results."""
    return query.filter(~cast(Trace.tags, String).like('%"ask_auditi"%'))


def _parse_time_range(time_range: Optional[str]) -> datetime:
    """Return a start-date from a human-friendly time range string."""
    now = datetime.now(timezone.utc)
    mapping = {
        "1h": timedelta(hours=1),
        "6h": timedelta(hours=6),
        "24h": timedelta(hours=24),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
        "90d": timedelta(days=90),
    }
    delta = mapping.get(time_range or "7d", timedelta(days=7))
    return now - delta


def _row_to_dict(row, keys: List[str]) -> Dict[str, Any]:
    """Convert a SQLAlchemy row to a dict with the given keys."""
    return {k: getattr(row, k, None) for k in keys}


def _serialize(val: Any) -> Any:
    """Make a value JSON-serializable."""
    if isinstance(val, datetime):
        return val.isoformat()
    return val


def _trace_row(t: Trace) -> Dict[str, Any]:
    return {
        "id": t.id,
        "name": t.name,
        "status": t.status,
        "score": round(t.score * 100, 1) if t.score is not None else None,
        "latency": round(t.latency, 3) if t.latency else None,
        "cost": round(t.cost, 6) if t.cost else None,
        "model": t.model_name,
        "user_id": t.user_id,
        "failure_mode": t.failure_mode,
        "start_time": _serialize(t.start_time),
    }


# ── 13 query functions ──────────────────────────────────────────────


QueryResult = Tuple[List[Dict[str, Any]], str]


def search_traces(
    db: Session,
    *,
    status: Optional[str] = None,
    model: Optional[str] = None,
    min_score: Optional[float] = None,
    max_score: Optional[float] = None,
    min_latency: Optional[float] = None,
    max_latency: Optional[float] = None,
    time_range: Optional[str] = None,
    text_search: Optional[str] = None,
    sort_by: Optional[str] = "start_time",
    sort_order: Optional[str] = "desc",
    limit: int = 20,
    **_: Any,
) -> QueryResult:
    """Search and filter traces."""
    q = _exclude_system_traces(db.query(Trace))
    if time_range:
        q = q.filter(Trace.start_time >= _parse_time_range(time_range))
    if status:
        q = q.filter(Trace.status == status)
    if model:
        q = q.filter(Trace.model_name.ilike(f"%{model}%"))
    if min_score is not None:
        q = q.filter(Trace.score >= min_score / 100.0)
    if max_score is not None:
        q = q.filter(Trace.score <= max_score / 100.0)
    if min_latency is not None:
        q = q.filter(Trace.latency >= min_latency)
    if max_latency is not None:
        q = q.filter(Trace.latency <= max_latency)
    if text_search:
        pattern = f"%{text_search}%"
        q = q.filter(
            or_(
                Trace.user_input.ilike(pattern),
                Trace.assistant_output.ilike(pattern),
                Trace.name.ilike(pattern),
            )
        )

    sort_col = getattr(Trace, sort_by, Trace.start_time)
    q = q.order_by(desc(sort_col) if sort_order == "desc" else sort_col.asc())
    traces = q.limit(min(limit, 50)).all()
    return [_trace_row(t) for t in traces], "table"


def get_trace_detail(
    db: Session,
    *,
    trace_id: str,
    **_: Any,
) -> QueryResult:
    """Get full detail of a single trace including its spans."""
    trace = _exclude_system_traces(db.query(Trace)).filter(Trace.id == trace_id).first()
    if not trace:
        return [{"error": f"Trace {trace_id} not found"}], "table"

    spans = db.query(Span).filter(Span.trace_id == trace_id).order_by(Span.start_time).all()
    span_list = [
        {
            "id": s.id,
            "name": s.name,
            "type": s.span_type,
            "model": s.model,
            "status": s.status,
            "latency": round(s.processing_time, 3) if s.processing_time else None,
            "tokens": s.tokens,
            "cost": round(s.cost, 6) if s.cost else None,
        }
        for s in spans
    ]
    return [
        {
            **_trace_row(trace),
            "user_input": (trace.user_input or "")[:500],
            "assistant_output": (trace.assistant_output or "")[:500],
            "eval_reason": trace.eval_reason,
            "spans": span_list,
        }
    ], "table"


def get_trace_statistics(
    db: Session,
    *,
    time_range: Optional[str] = "7d",
    group_by: Optional[str] = "status",
    **_: Any,
) -> QueryResult:
    """Aggregate trace statistics grouped by a dimension."""
    start = _parse_time_range(time_range)
    col_map = {
        "status": Trace.status,
        "model": Trace.model_name,
        "name": Trace.name,
        "failure_mode": Trace.failure_mode,
    }
    group_col = col_map.get(group_by, Trace.status)

    q = _exclude_system_traces(
        db.query(
            group_col.label("group"),
            func.count(Trace.id).label("count"),
            func.avg(Trace.score).label("avg_score"),
            func.avg(Trace.latency).label("avg_latency"),
            func.sum(Trace.cost).label("total_cost"),
        )
    )
    rows = (
        q.filter(Trace.start_time >= start, group_col.isnot(None))
        .group_by(group_col)
        .order_by(desc("count"))
        .all()
    )
    data = [
        {
            "group": r.group,
            "count": r.count,
            "avg_score": round(r.avg_score * 100, 1) if r.avg_score else None,
            "avg_latency": round(r.avg_latency, 3) if r.avg_latency else None,
            "total_cost": round(r.total_cost, 4) if r.total_cost else 0,
        }
        for r in rows
    ]
    return data, "bar_chart"


def get_score_trends(
    db: Session,
    *,
    time_range: Optional[str] = "7d",
    metric: Optional[str] = "score",
    **_: Any,
) -> QueryResult:
    """Time-series trends for a chosen metric."""
    start = _parse_time_range(time_range)

    date_trunc = func.date_trunc("day", Trace.start_time)
    date_label = func.to_char(date_trunc, "YYYY-MM-DD")

    metric_map = {
        "score": func.avg(Trace.score) * 100,
        "latency": func.avg(Trace.latency),
        "cost": func.sum(Trace.cost),
        "volume": func.count(Trace.id),
        "error_rate": (
            func.sum(case((Trace.status == "fail", 1), else_=0))
            * 100.0
            / func.count(Trace.id)
        ),
    }
    agg = metric_map.get(metric, metric_map["score"])

    rows = (
        _exclude_system_traces(db.query(date_label.label("date"), agg.label("value")))
        .filter(Trace.start_time >= start)
        .group_by(date_trunc)
        .order_by(date_trunc)
        .all()
    )
    data = [
        {"date": r.date, "value": round(float(r.value or 0), 2)}
        for r in rows
    ]
    return data, "line_chart"


def get_model_comparison(
    db: Session,
    *,
    time_range: Optional[str] = "7d",
    models: Optional[List[str]] = None,
    **_: Any,
) -> QueryResult:
    """Compare models on key metrics."""
    start = _parse_time_range(time_range)
    q = _exclude_system_traces(db.query(
        Trace.model_name.label("model"),
        func.count(Trace.id).label("volume"),
        func.avg(Trace.score).label("avg_score"),
        func.avg(Trace.latency).label("avg_latency"),
        func.sum(Trace.cost).label("total_cost"),
        func.sum(case((Trace.status == "fail", 1), else_=0)).label("errors"),
    )).filter(Trace.start_time >= start, Trace.model_name.isnot(None))

    if models:
        q = q.filter(Trace.model_name.in_(models))

    rows = q.group_by(Trace.model_name).order_by(desc("volume")).all()
    data = [
        {
            "model": r.model,
            "volume": r.volume,
            "avg_score": round(r.avg_score * 100, 1) if r.avg_score else None,
            "avg_latency": round(r.avg_latency, 3) if r.avg_latency else None,
            "total_cost": round(r.total_cost, 4) if r.total_cost else 0,
            "error_rate": round(r.errors / r.volume * 100, 1) if r.volume else 0,
        }
        for r in rows
    ]
    return data, "bar_chart"


def get_failure_analysis(
    db: Session,
    *,
    time_range: Optional[str] = "7d",
    limit: int = 10,
    **_: Any,
) -> QueryResult:
    """Failure mode breakdown."""
    start = _parse_time_range(time_range)
    rows = (
        _exclude_system_traces(db.query(
            Trace.failure_mode.label("failure_mode"),
            func.count(Trace.id).label("count"),
            func.avg(Trace.score).label("avg_score"),
        ))
        .filter(
            Trace.start_time >= start,
            Trace.failure_mode.isnot(None),
            Trace.failure_mode != "",
        )
        .group_by(Trace.failure_mode)
        .order_by(desc("count"))
        .limit(limit)
        .all()
    )
    data = [
        {
            "failure_mode": r.failure_mode,
            "count": r.count,
            "avg_score": round(r.avg_score * 100, 1) if r.avg_score else None,
        }
        for r in rows
    ]
    return data, "bar_chart"


def get_cost_analysis(
    db: Session,
    *,
    time_range: Optional[str] = "7d",
    group_by: Optional[str] = "model",
    **_: Any,
) -> QueryResult:
    """Cost breakdown by model, day, or user."""
    start = _parse_time_range(time_range)
    col_map = {
        "model": Trace.model_name,
        "user": func.coalesce(Trace.user_id, "Anonymous"),
    }
    if group_by == "day":
        date_trunc = func.date_trunc("day", Trace.start_time)
        date_label = func.to_char(date_trunc, "YYYY-MM-DD")
        rows = (
            _exclude_system_traces(db.query(
                date_label.label("group"),
                func.sum(Trace.cost).label("total_cost"),
                func.count(Trace.id).label("trace_count"),
            ))
            .filter(Trace.start_time >= start)
            .group_by(date_trunc)
            .order_by(date_trunc)
            .all()
        )
    else:
        group_col = col_map.get(group_by, Trace.model_name)
        rows = (
            _exclude_system_traces(db.query(
                group_col.label("group"),
                func.sum(Trace.cost).label("total_cost"),
                func.count(Trace.id).label("trace_count"),
            ))
            .filter(Trace.start_time >= start, group_col.isnot(None))
            .group_by(group_col)
            .order_by(desc("total_cost"))
            .all()
        )
    data = [
        {
            "group": r.group,
            "total_cost": round(float(r.total_cost or 0), 4),
            "trace_count": r.trace_count,
        }
        for r in rows
    ]
    viz = "line_chart" if group_by == "day" else "bar_chart"
    return data, viz


def get_conversations_summary(
    db: Session,
    *,
    user_id: Optional[str] = None,
    min_trace_count: Optional[int] = None,
    time_range: Optional[str] = "7d",
    limit: int = 20,
    **_: Any,
) -> QueryResult:
    """Conversation overview with trace counts."""
    start = _parse_time_range(time_range)
    q = (
        db.query(
            Conversation.id,
            Conversation.user_id,
            Conversation.objective,
            Conversation.created_at,
            func.count(Trace.id).label("trace_count"),
            func.avg(Trace.score).label("avg_score"),
        )
        .outerjoin(Trace, Trace.conversation_id == Conversation.id)
        .filter(Conversation.created_at >= start, ~Conversation.id.like("ask_auditi_%"))
        .group_by(Conversation.id)
    )
    if user_id:
        q = q.filter(Conversation.user_id == user_id)
    if min_trace_count:
        q = q.having(func.count(Trace.id) >= min_trace_count)

    rows = q.order_by(desc(Conversation.created_at)).limit(min(limit, 50)).all()
    data = [
        {
            "id": r.id,
            "user_id": r.user_id,
            "objective": r.objective,
            "created_at": _serialize(r.created_at),
            "trace_count": r.trace_count,
            "avg_score": round(r.avg_score * 100, 1) if r.avg_score else None,
        }
        for r in rows
    ]
    return data, "table"


def get_annotations_summary(
    db: Session,
    *,
    score_config_name: Optional[str] = None,
    min_value: Optional[float] = None,
    max_value: Optional[float] = None,
    source: Optional[str] = None,
    time_range: Optional[str] = "7d",
    **_: Any,
) -> QueryResult:
    """Annotation and score data summary."""
    start = _parse_time_range(time_range)
    q = (
        db.query(
            ScoreConfig.name.label("score_name"),
            func.count(Annotation.id).label("count"),
            func.avg(Annotation.value).label("avg_value"),
            func.min(Annotation.value).label("min_value"),
            func.max(Annotation.value).label("max_value"),
        )
        .join(ScoreConfig, Annotation.score_config_id == ScoreConfig.id)
        .filter(Annotation.created_at >= start)
    )
    if score_config_name:
        q = q.filter(ScoreConfig.name.ilike(f"%{score_config_name}%"))
    if source:
        q = q.filter(Annotation.source == source)

    rows = q.group_by(ScoreConfig.name).order_by(desc("count")).all()
    data = [
        {
            "score_name": r.score_name,
            "count": r.count,
            "avg_value": round(float(r.avg_value or 0) * 100, 1),
            "min_value": round(float(r.min_value or 0) * 100, 1),
            "max_value": round(float(r.max_value or 0) * 100, 1),
        }
        for r in rows
    ]
    return data, "bar_chart"


def get_latency_analysis(
    db: Session,
    *,
    time_range: Optional[str] = "7d",
    model: Optional[str] = None,
    threshold_seconds: Optional[float] = None,
    **_: Any,
) -> QueryResult:
    """Latency percentiles and slow-trace detection."""
    start = _parse_time_range(time_range)
    q = _exclude_system_traces(db.query(Trace.latency)).filter(
        Trace.start_time >= start, Trace.latency.isnot(None)
    )
    if model:
        q = q.filter(Trace.model_name.ilike(f"%{model}%"))

    latencies = sorted([r[0] for r in q.all() if r[0] is not None])
    if not latencies:
        return [{"message": "No latency data found"}], "number"

    n = len(latencies)
    stats = {
        "count": n,
        "p50": round(latencies[n // 2], 3),
        "p90": round(latencies[int(n * 0.9)], 3) if n > 1 else round(latencies[0], 3),
        "p95": round(latencies[int(n * 0.95)], 3) if n > 1 else round(latencies[0], 3),
        "p99": round(latencies[int(n * 0.99)], 3) if n > 1 else round(latencies[0], 3),
        "avg": round(sum(latencies) / n, 3),
        "max": round(latencies[-1], 3),
    }
    if threshold_seconds:
        slow = [l for l in latencies if l > threshold_seconds]
        stats["slow_count"] = len(slow)
        stats["slow_percentage"] = round(len(slow) / n * 100, 1)
    return [stats], "number"


def get_user_activity(
    db: Session,
    *,
    time_range: Optional[str] = "7d",
    user_id: Optional[str] = None,
    limit: int = 20,
    **_: Any,
) -> QueryResult:
    """Per-user activity metrics."""
    start = _parse_time_range(time_range)
    user_col = func.coalesce(Trace.user_id, "Anonymous")
    q = (
        _exclude_system_traces(db.query(
            user_col.label("user_id"),
            func.count(Trace.id).label("trace_count"),
            func.avg(Trace.score).label("avg_score"),
            func.sum(Trace.cost).label("total_cost"),
            func.avg(Trace.latency).label("avg_latency"),
        ))
        .filter(Trace.start_time >= start)
        .group_by(user_col)
    )
    if user_id:
        q = q.filter(user_col == user_id)

    rows = q.order_by(desc("trace_count")).limit(limit).all()
    data = [
        {
            "user_id": r.user_id,
            "trace_count": r.trace_count,
            "avg_score": round(r.avg_score * 100, 1) if r.avg_score else None,
            "total_cost": round(float(r.total_cost or 0), 4),
            "avg_latency": round(r.avg_latency, 3) if r.avg_latency else None,
        }
        for r in rows
    ]
    return data, "table"


def get_evaluator_performance(
    db: Session,
    *,
    time_range: Optional[str] = "7d",
    **_: Any,
) -> QueryResult:
    """Evaluator stats: how each evaluator scores."""
    start = _parse_time_range(time_range)
    rows = (
        db.query(
            ScoreConfig.name.label("evaluator"),
            func.count(Annotation.id).label("annotations"),
            func.avg(Annotation.value).label("avg_score"),
            func.sum(case((Annotation.value >= 0.5, 1), else_=0)).label("pass_count"),
            func.sum(case((Annotation.value < 0.5, 1), else_=0)).label("fail_count"),
        )
        .join(ScoreConfig, Annotation.score_config_id == ScoreConfig.id)
        .filter(Annotation.created_at >= start)
        .group_by(ScoreConfig.name)
        .order_by(desc("annotations"))
        .all()
    )
    data = [
        {
            "evaluator": r.evaluator,
            "annotations": r.annotations,
            "avg_score": round(float(r.avg_score or 0) * 100, 1),
            "pass_count": r.pass_count or 0,
            "fail_count": r.fail_count or 0,
            "pass_rate": round(
                (r.pass_count or 0) / r.annotations * 100, 1
            ) if r.annotations else 0,
        }
        for r in rows
    ]
    return data, "bar_chart"


def get_actions_list(
    db: Session,
    *,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    limit: int = 20,
    **_: Any,
) -> QueryResult:
    """List action items / recommendations."""
    q = db.query(Action)
    if status:
        q = q.filter(Action.status == status)
    if priority:
        q = q.filter(Action.priority == priority)
    rows = q.order_by(desc(Action.id)).limit(limit).all()
    data = [
        {
            "id": a.id,
            "title": a.title,
            "description": (a.description or "")[:200],
            "priority": a.priority,
            "status": a.status,
            "category": a.category,
        }
        for a in rows
    ]
    return data, "table"


# ── function registry ────────────────────────────────────────────────

FUNCTION_REGISTRY = {
    "search_traces": search_traces,
    "get_trace_detail": get_trace_detail,
    "get_trace_statistics": get_trace_statistics,
    "get_score_trends": get_score_trends,
    "get_model_comparison": get_model_comparison,
    "get_failure_analysis": get_failure_analysis,
    "get_cost_analysis": get_cost_analysis,
    "get_conversations_summary": get_conversations_summary,
    "get_annotations_summary": get_annotations_summary,
    "get_latency_analysis": get_latency_analysis,
    "get_user_activity": get_user_activity,
    "get_evaluator_performance": get_evaluator_performance,
    "get_actions_list": get_actions_list,
}


# ── OpenAI-format tool definitions ──────────────────────────────────

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "search_traces",
            "description": "Search and filter traces by status, model, score, latency, time range, or text content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["pass", "fail", "review"], "description": "Filter by evaluation status"},
                    "model": {"type": "string", "description": "Filter by model name (partial match)"},
                    "min_score": {"type": "number", "description": "Minimum score (0-100)"},
                    "max_score": {"type": "number", "description": "Maximum score (0-100)"},
                    "min_latency": {"type": "number", "description": "Minimum latency in seconds"},
                    "max_latency": {"type": "number", "description": "Maximum latency in seconds"},
                    "time_range": {"type": "string", "enum": ["1h", "6h", "24h", "7d", "30d", "90d"], "description": "Time range to search"},
                    "text_search": {"type": "string", "description": "Search text in user input, assistant output, or trace name"},
                    "sort_by": {"type": "string", "enum": ["start_time", "score", "latency", "cost"], "description": "Sort field"},
                    "sort_order": {"type": "string", "enum": ["asc", "desc"]},
                    "limit": {"type": "integer", "description": "Max results (1-50)"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_trace_detail",
            "description": "Get full detail of a single trace including all its spans.",
            "parameters": {
                "type": "object",
                "properties": {
                    "trace_id": {"type": "string", "description": "The trace ID to look up"},
                },
                "required": ["trace_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_trace_statistics",
            "description": "Get aggregate statistics for traces, grouped by status, model, name, or failure mode.",
            "parameters": {
                "type": "object",
                "properties": {
                    "time_range": {"type": "string", "enum": ["1h", "6h", "24h", "7d", "30d", "90d"]},
                    "group_by": {"type": "string", "enum": ["status", "model", "name", "failure_mode"], "description": "Dimension to group by"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_score_trends",
            "description": "Get time-series trends for a metric (score, latency, cost, volume, or error_rate) over a time range.",
            "parameters": {
                "type": "object",
                "properties": {
                    "time_range": {"type": "string", "enum": ["1h", "6h", "24h", "7d", "30d", "90d"]},
                    "metric": {"type": "string", "enum": ["score", "latency", "cost", "volume", "error_rate"], "description": "Metric to trend"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_model_comparison",
            "description": "Compare multiple models on score, latency, cost, volume, and error rate.",
            "parameters": {
                "type": "object",
                "properties": {
                    "time_range": {"type": "string", "enum": ["1h", "6h", "24h", "7d", "30d", "90d"]},
                    "models": {"type": "array", "items": {"type": "string"}, "description": "Specific models to compare (optional, compares all if omitted)"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_failure_analysis",
            "description": "Get breakdown of failure modes, showing the most common failure types and their frequency.",
            "parameters": {
                "type": "object",
                "properties": {
                    "time_range": {"type": "string", "enum": ["1h", "6h", "24h", "7d", "30d", "90d"]},
                    "limit": {"type": "integer", "description": "Max failure modes to return"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_cost_analysis",
            "description": "Get cost breakdown grouped by model, day, or user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "time_range": {"type": "string", "enum": ["1h", "6h", "24h", "7d", "30d", "90d"]},
                    "group_by": {"type": "string", "enum": ["model", "day", "user"], "description": "How to group costs"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_conversations_summary",
            "description": "Get conversation overview with trace counts and average scores.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "string", "description": "Filter by user ID"},
                    "min_trace_count": {"type": "integer", "description": "Minimum number of traces per conversation"},
                    "time_range": {"type": "string", "enum": ["1h", "6h", "24h", "7d", "30d", "90d"]},
                    "limit": {"type": "integer"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_annotations_summary",
            "description": "Get annotation and score data summary, grouped by score config / evaluator name.",
            "parameters": {
                "type": "object",
                "properties": {
                    "score_config_name": {"type": "string", "description": "Filter by score config name (partial match)"},
                    "min_value": {"type": "number", "description": "Min annotation value (0-100)"},
                    "max_value": {"type": "number", "description": "Max annotation value (0-100)"},
                    "source": {"type": "string", "description": "Filter by annotation source"},
                    "time_range": {"type": "string", "enum": ["1h", "6h", "24h", "7d", "30d", "90d"]},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_latency_analysis",
            "description": "Get latency percentiles (p50, p90, p95, p99) and optionally detect slow traces above a threshold.",
            "parameters": {
                "type": "object",
                "properties": {
                    "time_range": {"type": "string", "enum": ["1h", "6h", "24h", "7d", "30d", "90d"]},
                    "model": {"type": "string", "description": "Filter by model name"},
                    "threshold_seconds": {"type": "number", "description": "Latency threshold to identify slow traces"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_user_activity",
            "description": "Get per-user activity metrics: trace count, average score, cost, and latency.",
            "parameters": {
                "type": "object",
                "properties": {
                    "time_range": {"type": "string", "enum": ["1h", "6h", "24h", "7d", "30d", "90d"]},
                    "user_id": {"type": "string", "description": "Filter by specific user ID"},
                    "limit": {"type": "integer"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_evaluator_performance",
            "description": "Get evaluator performance stats: annotation counts, average scores, and pass/fail rates.",
            "parameters": {
                "type": "object",
                "properties": {
                    "time_range": {"type": "string", "enum": ["1h", "6h", "24h", "7d", "30d", "90d"]},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_actions_list",
            "description": "List action items / recommendations with optional status and priority filters.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "enum": ["pending", "in_progress", "completed"], "description": "Filter by action status"},
                    "priority": {"type": "string", "enum": ["high", "medium", "low"], "description": "Filter by priority"},
                    "limit": {"type": "integer"},
                },
            },
        },
    },
]
