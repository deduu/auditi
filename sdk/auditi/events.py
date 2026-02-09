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

"""
Standardized event types for streaming agent responses.

This module provides a clear contract for all event types used in the tracing system.
"""

from enum import Enum
from typing import Any, Dict, Optional, List
from dataclasses import dataclass, field


class EventType(str, Enum):
    """Standardized event types for agent streaming."""

    # Content events
    TOKEN = "token"  # Streaming text token
    COMPLETE = "complete"  # Final complete response

    # Phase events (agent lifecycle)
    PHASE_START = "phase_start"  # Agent phase starting
    PHASE_END = "phase_end"  # Agent phase ending

    # Tool execution events
    TOOL_EXEC_START = "tool_exec_start"  # Tool execution starting
    TOOL_EXEC_END = "tool_exec_end"  # Tool execution ending

    # Metadata events
    TURN_METADATA = "turn_metadata"  # Turn-level metadata (usage, tool_calls, etc.)
    USAGE = "usage"  # Usage statistics (standalone)

    # Error events
    ERROR = "error"  # Error occurred


# Events that should NOT be accumulated in span outputs
INTERNAL_EVENTS = frozenset(
    {
        EventType.PHASE_START,
        EventType.PHASE_END,
        EventType.TOOL_EXEC_START,
        EventType.TOOL_EXEC_END,
        EventType.TURN_METADATA,
        EventType.USAGE,
    }
)

# Events that contain content to accumulate
CONTENT_EVENTS = frozenset(
    {
        EventType.TOKEN,
        EventType.COMPLETE,
    }
)


@dataclass
class StreamEvent:
    """
    Standardized streaming event structure.

    Provides a consistent interface for all events yielded during agent streaming.
    Supports backward compatibility with raw dictionaries.
    """

    type: EventType
    content: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    usage: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    tool_calls: Optional[List[Any]] = field(default=None)
    # Additional fields for specific events
    phase: Optional[str] = None  # For PHASE_START/PHASE_END
    tool: Optional[str] = None  # For TOOL_EXEC_START/TOOL_EXEC_END
    history: Optional[List[Any]] = field(default=None)  # For COMPLETE
    messages: Optional[List[Any]] = field(default=None)  # For COMPLETE

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for backward compatibility."""
        result = {"type": self.type.value}
        if self.content is not None:
            result["content"] = self.content
        if self.metadata is not None:
            result["metadata"] = self.metadata
        if self.usage is not None:
            result["usage"] = self.usage
        if self.error is not None:
            result["error"] = self.error
        if self.tool_calls is not None:
            result["tool_calls"] = self.tool_calls
        if self.phase is not None:
            result["phase"] = self.phase
        if self.tool is not None:
            result["tool"] = self.tool
        if self.history is not None:
            result["history"] = self.history
        if self.messages is not None:
            result["messages"] = self.messages
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "StreamEvent":
        """
        Create StreamEvent from dictionary (for backward compatibility).

        Args:
            data: Dictionary with at least a 'type' key

        Returns:
            StreamEvent instance
        """
        event_type_raw = data.get("type", "token")

        # Handle both string and EventType enum
        if isinstance(event_type_raw, EventType):
            event_type = event_type_raw
        elif isinstance(event_type_raw, str):
            try:
                event_type = EventType(event_type_raw)
            except ValueError:
                # Unknown event type, default to token
                event_type = EventType.TOKEN
        else:
            event_type = EventType.TOKEN

        return cls(
            type=event_type,
            content=data.get("content"),
            metadata=data.get("metadata"),
            usage=data.get("usage"),
            error=data.get("error"),
            tool_calls=data.get("tool_calls"),
            phase=data.get("phase"),
            tool=data.get("tool"),
            history=data.get("history"),
            messages=data.get("messages"),
        )

    def is_internal(self) -> bool:
        """Check if this event should be filtered from outputs."""
        return self.type in INTERNAL_EVENTS

    def is_content(self) -> bool:
        """Check if this event contains content to accumulate."""
        return self.type in CONTENT_EVENTS


# Helper factory functions for common events
def token_event(content: str) -> Dict[str, Any]:
    """Create a token event dictionary."""
    return {"type": EventType.TOKEN.value, "content": content}


def complete_event(
    content: str,
    history: Optional[List[Any]] = None,
    messages: Optional[List[Any]] = None,
) -> Dict[str, Any]:
    """Create a complete event dictionary."""
    result = {"type": EventType.COMPLETE.value, "content": content}
    if history is not None:
        result["history"] = history
    if messages is not None:
        result["messages"] = messages
    return result


def turn_metadata_event(
    tool_calls: Optional[List[Any]] = None,
    usage: Optional[Dict[str, Any]] = None,
    perplexity: Optional[float] = None,
    confidence_level: Optional[str] = None,
    total_tokens: Optional[int] = None,
) -> Dict[str, Any]:
    """Create a turn_metadata event dictionary."""
    return {
        "type": EventType.TURN_METADATA.value,
        "tool_calls": tool_calls or [],
        "usage": usage,
        "perplexity": perplexity,
        "confidence_level": confidence_level,
        "total_tokens": total_tokens,
    }


def phase_event(phase: str, start: bool = True) -> Dict[str, Any]:
    """Create a phase start/end event dictionary."""
    event_type = EventType.PHASE_START if start else EventType.PHASE_END
    return {"type": event_type.value, "phase": phase}


def tool_exec_event(tool: str, start: bool = True) -> Dict[str, Any]:
    """Create a tool execution start/end event dictionary."""
    event_type = EventType.TOOL_EXEC_START if start else EventType.TOOL_EXEC_END
    return {"type": event_type.value, "tool": tool}
