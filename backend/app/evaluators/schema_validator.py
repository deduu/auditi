"""
Schema validation utility for LLM evaluator responses.

Provides resilient extraction of core fields while supporting flexible custom schemas.
"""

import logging
from typing import Dict, Any, Tuple, List, Optional

logger = logging.getLogger("auditi.schema")

# Core fields that MUST exist for the system to function
CORE_SCHEMA = {
    "required": ["status", "score"],
    "properties": {
        "status": {"type": "string", "enum": ["pass", "fail", "review"]},
        "score": {"type": "number", "minimum": 0, "maximum": 1},
        "failure_mode": {"type": "string", "nullable": True},
        "reason": {"type": "string"},
        "recommended_action": {"type": "string", "nullable": True},
        "step_quality_summary": {"type": "string", "nullable": True},
        "efficiency_summary": {"type": "string", "nullable": True},
    },
}

# Valid failure modes
VALID_FAILURE_MODES = {
    "hallucination",
    "off_topic",
    "harmful",
    "incomplete",
    "incoherent",
    "incorrect_tool_use",
    "inefficient_execution",
    "poor_step_quality",
    "incomplete_answer",
    "other",
}


def validate_and_extract(
    response: Dict[str, Any],
    custom_schema: Optional[Dict[str, Any]] = None,
    mode: str = "flexible",
) -> Tuple[Dict[str, Any], Dict[str, Any], List[str]]:
    """
    Validate LLM response and extract core + custom fields.

    This function is designed to be resilient - it will always return usable
    core fields even if the response doesn't match expected schema.

    Args:
        response: The parsed JSON response from the LLM evaluator
        custom_schema: Optional JSON Schema defining additional expected fields
        mode: Validation mode - "strict", "flexible", or "none"

    Returns:
        Tuple of (core_fields, custom_fields, warnings)
        - core_fields: Dict with status, score, failure_mode, reason, recommended_action
        - custom_fields: Dict with any additional fields from response
        - warnings: List of validation warnings/errors encountered
    """
    warnings: List[str] = []

    # 1. Extract and validate CORE fields (always required for system to function)
    core_fields = _extract_core_fields(response, warnings)

    # 2. Extract CUSTOM fields (everything not in core schema)
    core_keys = set(CORE_SCHEMA["properties"].keys())
    custom_fields = {k: v for k, v in response.items() if k not in core_keys}

    # 3. Validate against custom schema if provided
    if custom_schema and mode in ("strict", "flexible"):
        schema_warnings = _validate_custom_schema(custom_fields, custom_schema, mode)
        warnings.extend(schema_warnings)

    # Log warnings
    if warnings:
        for w in warnings:
            logger.warning(f"Schema validation: {w}")

    return core_fields, custom_fields, warnings


def _extract_core_fields(
    response: Dict[str, Any], warnings: List[str]
) -> Dict[str, Any]:
    """Extract and validate core evaluation fields with smart defaults."""
    core_fields = {}

    # === STATUS (required) ===
    status = response.get("status")
    if status is None:
        # Try common alternatives
        status = response.get("verdict") or response.get("result") or response.get("outcome")
        if status:
            warnings.append(f"Using '{status}' from alternative field as 'status'")

    # Normalize status value
    if status is not None:
        status_lower = str(status).lower().strip()
        status_map = {
            "pass": "pass",
            "passed": "pass",
            "success": "pass",
            "ok": "pass",
            "approved": "pass",
            "fail": "fail",
            "failed": "fail",
            "failure": "fail",
            "rejected": "fail",
            "review": "review",
            "needs_review": "review",
            "pending": "review",
            "uncertain": "review",
            "maybe": "review",
        }
        normalized = status_map.get(status_lower)
        if normalized:
            if normalized != status_lower:
                warnings.append(f"Normalized status '{status}' to '{normalized}'")
            status = normalized
        else:
            warnings.append(
                f"Invalid status '{status}', defaulting to 'review'. "
                f"Expected: pass, fail, or review"
            )
            status = "review"
    else:
        warnings.append("Missing 'status' field, defaulting to 'review'")
        status = "review"

    core_fields["status"] = status

    # === SCORE (required) ===
    score = response.get("score")
    if score is None:
        # Try common alternatives
        score = (
            response.get("quality_score")
            or response.get("rating")
            or response.get("confidence")
        )
        if score is not None:
            warnings.append(f"Using value from alternative field as 'score'")

    if score is None:
        warnings.append("Missing 'score' field, defaulting to 0.5")
        score = 0.5
    else:
        try:
            score = float(score)
            original_score = score

            # Smart normalization for different scales
            if score < 0:
                warnings.append(f"Negative score {score}, clamping to 0")
                score = 0.0
            elif 1 < score <= 10:
                # Likely 0-10 scale
                warnings.append(
                    f"Score {original_score} appears to be 0-10 scale, normalizing to 0-1"
                )
                score = score / 10
            elif 10 < score <= 100:
                # Likely 0-100 scale (percentage)
                warnings.append(
                    f"Score {original_score} appears to be 0-100 scale, normalizing to 0-1"
                )
                score = score / 100
            elif score > 100:
                warnings.append(f"Score {score} too large, clamping to 1.0")
                score = 1.0

            # Final clamp
            score = max(0.0, min(1.0, score))

        except (TypeError, ValueError) as e:
            warnings.append(f"Invalid score value '{score}': {e}, defaulting to 0.5")
            score = 0.5

    core_fields["score"] = score

    # === FAILURE_MODE (optional) ===
    failure_mode = response.get("failure_mode")
    if failure_mode is not None:
        failure_mode_lower = str(failure_mode).lower().strip().replace(" ", "_")
        if failure_mode_lower not in VALID_FAILURE_MODES:
            warnings.append(
                f"Unknown failure_mode '{failure_mode}', mapping to 'other'. "
                f"Valid modes: {', '.join(sorted(VALID_FAILURE_MODES))}"
            )
            failure_mode = "other"
        else:
            failure_mode = failure_mode_lower

    core_fields["failure_mode"] = failure_mode

    # === REASON (optional but important) ===
    reason = response.get("reason")
    if reason is None:
        # Try common alternatives
        reason = (
            response.get("reasoning")
            or response.get("explanation")
            or response.get("rationale")
            or response.get("justification")
            or ""
        )
        if reason:
            warnings.append("Using alternative field for 'reason'")

    core_fields["reason"] = str(reason) if reason else ""

    # === RECOMMENDED_ACTION (optional) ===
    recommended_action = response.get("recommended_action")
    if recommended_action is None:
        recommended_action = (
            response.get("recommendation")
            or response.get("suggestion")
            or response.get("action")
        )

    core_fields["recommended_action"] = (
        str(recommended_action) if recommended_action else None
    )

    # === Enforce status-score consistency ===
    # The LLM may return contradictory status/score pairs (e.g. score=0.75 with status="fail").
    # Override using the same thresholds documented in the evaluation prompt:
    #   pass:   score >= 0.7
    #   review: 0.5 <= score < 0.7
    #   fail:   score < 0.5
    score = core_fields["score"]
    expected_status = "pass" if score >= 0.7 else "fail" if score < 0.5 else "review"
    if core_fields["status"] != expected_status:
        warnings.append(
            f"Status-score inconsistency: LLM returned status='{core_fields['status']}' "
            f"with score={score:.2f}. Overriding status to '{expected_status}' "
            f"per threshold rules (pass>=0.7, fail<0.5, review otherwise)."
        )
        core_fields["status"] = expected_status

        # Clear failure_mode when status is overridden to pass
        if expected_status == "pass" and core_fields.get("failure_mode"):
            core_fields["failure_mode"] = None

    # === Additional trace evaluation fields ===
    core_fields["step_quality_summary"] = response.get("step_quality_summary")
    core_fields["efficiency_summary"] = response.get("efficiency_summary")

    return core_fields


def _validate_custom_schema(
    fields: Dict[str, Any], schema: Dict[str, Any], mode: str
) -> List[str]:
    """
    Validate custom fields against user-defined schema.

    Args:
        fields: The custom fields extracted from response
        schema: JSON Schema definition for expected custom fields
        mode: "strict" or "flexible"

    Returns:
        List of validation warnings
    """
    warnings = []

    # Check required fields
    required = schema.get("required", [])
    for field in required:
        if field not in fields:
            prefix = "ERROR" if mode == "strict" else "WARNING"
            warnings.append(f"{prefix}: Missing required custom field '{field}'")

    # Check field types (basic validation)
    properties = schema.get("properties", {})
    for field, value in fields.items():
        if field in properties:
            expected_type = properties[field].get("type")
            if expected_type and not _check_type(value, expected_type):
                warnings.append(
                    f"Field '{field}' expected type '{expected_type}', "
                    f"got '{type(value).__name__}'"
                )

            # Check enum constraints
            enum_values = properties[field].get("enum")
            if enum_values and value not in enum_values:
                warnings.append(
                    f"Field '{field}' value '{value}' not in allowed values: {enum_values}"
                )

            # Check numeric constraints
            if expected_type in ("number", "integer"):
                try:
                    num_val = float(value)
                    min_val = properties[field].get("minimum")
                    max_val = properties[field].get("maximum")
                    if min_val is not None and num_val < min_val:
                        warnings.append(
                            f"Field '{field}' value {num_val} below minimum {min_val}"
                        )
                    if max_val is not None and num_val > max_val:
                        warnings.append(
                            f"Field '{field}' value {num_val} above maximum {max_val}"
                        )
                except (TypeError, ValueError):
                    pass

    return warnings


def _check_type(value: Any, expected: str) -> bool:
    """
    Check if value matches expected JSON Schema type.

    Args:
        value: The value to check
        expected: Expected JSON Schema type string

    Returns:
        True if type matches, False otherwise
    """
    if value is None:
        return True  # null is valid for nullable fields

    type_map = {
        "string": str,
        "number": (int, float),
        "integer": int,
        "boolean": bool,
        "array": list,
        "object": dict,
    }

    expected_types = type_map.get(expected)
    if expected_types is None:
        return True  # Unknown type, don't validate

    return isinstance(value, expected_types)


def build_schema_from_fields(fields: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Build a JSON Schema from a list of field definitions.

    Utility for frontend schema builder.

    Args:
        fields: List of dicts with 'name', 'type', 'required', 'description'

    Returns:
        JSON Schema dict
    """
    schema = {"type": "object", "properties": {}, "required": []}

    for field in fields:
        name = field.get("name")
        if not name:
            continue

        prop = {"type": field.get("type", "string")}

        if field.get("description"):
            prop["description"] = field["description"]

        if field.get("enum"):
            prop["enum"] = field["enum"]

        if field.get("minimum") is not None:
            prop["minimum"] = field["minimum"]

        if field.get("maximum") is not None:
            prop["maximum"] = field["maximum"]

        schema["properties"][name] = prop

        if field.get("required"):
            schema["required"].append(name)

    return schema
