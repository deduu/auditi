"""
ChatGPT export data parser.

Parses the conversations.json from a ChatGPT data export ZIP/JSON
and extracts user/assistant message pairs as dataset items.
"""

import json
import zipfile
import io
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Configuration model
# ---------------------------------------------------------------------------


class ChatGPTImportConfig(BaseModel):
    """Filtering configuration for ChatGPT import."""

    skip_system_messages: bool = Field(
        True, description="Skip system/tool messages"
    )
    model_filter: Optional[str] = Field(
        None, description="Only include messages from this model slug (e.g. 'gpt-4')"
    )
    date_from: Optional[float] = Field(
        None, description="Unix timestamp: only conversations created after this time"
    )
    date_to: Optional[float] = Field(
        None, description="Unix timestamp: only conversations created before this time"
    )
    min_message_length: int = Field(
        1, ge=0, description="Minimum character length for both user and assistant messages"
    )
    max_conversations: Optional[int] = Field(
        None, ge=1, description="Limit number of conversations to process"
    )


# ---------------------------------------------------------------------------
# Parsed output models
# ---------------------------------------------------------------------------


class ParsedItem(BaseModel):
    """A single extracted user/assistant pair."""

    input: Dict[str, Any]
    expected_output: Dict[str, Any]
    metadata: Dict[str, Any]


class ParsedConversation(BaseModel):
    """A parsed conversation with its extracted items."""

    id: str
    title: str
    message_count: int
    items: List[ParsedItem]
    model_slug: Optional[str] = None
    created_at: Optional[float] = None


class ChatGPTParseResult(BaseModel):
    """Complete result of parsing a ChatGPT export."""

    total_conversations_in_file: int
    filtered_conversations: int
    total_items: int
    conversations: List[ParsedConversation]
    skipped_reasons: Dict[str, int]
    sample_items: List[ParsedItem]


# ---------------------------------------------------------------------------
# Core parsing functions
# ---------------------------------------------------------------------------


def extract_conversations_json(file_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Extract conversations.json from either a ZIP file or raw JSON bytes.

    Raises:
        ValueError: If file cannot be parsed.
    """
    # Try ZIP first
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
            json_files = [n for n in zf.namelist() if n.endswith("conversations.json")]
            if not json_files:
                raise ValueError(
                    "ZIP file does not contain conversations.json. "
                    "Please upload the ChatGPT export ZIP or the conversations.json file directly."
                )
            with zf.open(json_files[0]) as f:
                return json.loads(f.read())
    except zipfile.BadZipFile:
        pass

    # Try raw JSON
    try:
        data = json.loads(file_bytes)
        if not isinstance(data, list):
            raise ValueError("JSON file must contain an array of conversations.")
        return data
    except json.JSONDecodeError as e:
        raise ValueError(f"File is neither a valid ZIP nor valid JSON: {e}")


def _linearize_conversation(mapping: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Walk the message tree and return the longest linear path of messages.

    For branched conversations, follows the path with the most messages (DFS).
    """
    if not mapping:
        return []

    # Find root nodes — nodes with no parent or parent not in mapping
    roots = []
    for node_id, node in mapping.items():
        parent = node.get("parent")
        if parent is None or parent not in mapping:
            roots.append(node_id)

    if not roots:
        return []

    def find_longest_path(node_id: str) -> List[str]:
        node = mapping.get(node_id, {})
        children = node.get("children", [])
        if not children:
            return [node_id]

        best_path: List[str] = []
        for child_id in children:
            if child_id in mapping:
                child_path = find_longest_path(child_id)
                if len(child_path) > len(best_path):
                    best_path = child_path

        return [node_id] + best_path

    longest: List[str] = []
    for root_id in roots:
        path = find_longest_path(root_id)
        if len(path) > len(longest):
            longest = path

    return [mapping[nid] for nid in longest if nid in mapping]


def _extract_text_from_content(content: Optional[Dict[str, Any]]) -> str:
    """
    Extract plain text from a ChatGPT message content object.
    Handles content_type "text" (parts array of strings).
    Skips images and other multimodal content.
    """
    if not content:
        return ""

    parts = content.get("parts", [])
    text_parts = []
    for part in parts:
        if isinstance(part, str):
            text_parts.append(part)
        # Skip dicts (images, attachments, etc.)

    return "\n".join(text_parts).strip()


def _get_model_slug(message: Optional[Dict[str, Any]]) -> Optional[str]:
    """Extract model_slug from message metadata."""
    if not message:
        return None
    metadata = message.get("metadata", {})
    if isinstance(metadata, dict):
        return metadata.get("model_slug")
    return None


def parse_conversations(
    conversations_data: List[Dict[str, Any]],
    config: ChatGPTImportConfig,
) -> ChatGPTParseResult:
    """
    Parse ChatGPT conversations into dataset items.

    Each consecutive user -> assistant message pair becomes one dataset item.
    Includes conversation history up to that point for context.
    """
    total_in_file = len(conversations_data)
    skipped_reasons: Dict[str, int] = {}
    all_conversations: List[ParsedConversation] = []
    all_items: List[ParsedItem] = []

    def skip(reason: str):
        skipped_reasons[reason] = skipped_reasons.get(reason, 0) + 1

    for conv in conversations_data:
        # Apply max_conversations limit
        if config.max_conversations and len(all_conversations) >= config.max_conversations:
            break

        conv_id = conv.get("id", "unknown")
        title = conv.get("title", "Untitled")
        create_time = conv.get("create_time")

        # Date filtering
        if config.date_from and create_time and create_time < config.date_from:
            skip("date_filter")
            continue
        if config.date_to and create_time and create_time > config.date_to:
            skip("date_filter")
            continue

        mapping = conv.get("mapping", {})
        if not mapping:
            skip("no_mapping")
            continue

        # Linearize the conversation tree
        linear_nodes = _linearize_conversation(mapping)

        # Extract messages in order
        messages = []
        for node in linear_nodes:
            msg = node.get("message")
            if not msg:
                continue

            author = msg.get("author", {})
            role = author.get("role", "unknown")

            # Skip system/tool messages if configured
            if config.skip_system_messages and role in ("system", "tool"):
                continue

            text = _extract_text_from_content(msg.get("content"))
            if not text:
                skip("empty_message")
                continue

            model_slug = _get_model_slug(msg)

            # Model filter
            if config.model_filter and role == "assistant":
                if model_slug and model_slug != config.model_filter:
                    skip("model_filter")
                    continue

            messages.append(
                {
                    "role": role,
                    "text": text,
                    "model_slug": model_slug,
                    "message_id": msg.get("id"),
                    "create_time": msg.get("create_time"),
                }
            )

        # Extract user/assistant pairs
        conv_items: List[ParsedItem] = []
        conversation_history: List[Dict[str, str]] = []

        i = 0
        while i < len(messages):
            msg = messages[i]

            if msg["role"] == "user":
                user_text = msg["text"]

                # Look for the next assistant response
                assistant_text = None
                assistant_model = None
                assistant_msg_id = None
                j = i + 1
                while j < len(messages):
                    if messages[j]["role"] == "assistant":
                        assistant_text = messages[j]["text"]
                        assistant_model = messages[j]["model_slug"]
                        assistant_msg_id = messages[j]["message_id"]
                        break
                    j += 1

                if assistant_text:
                    # Apply min message length filter
                    if (
                        len(user_text) < config.min_message_length
                        or len(assistant_text) < config.min_message_length
                    ):
                        skip("min_length_filter")
                        conversation_history.append(
                            {"role": "user", "content": user_text}
                        )
                        conversation_history.append(
                            {"role": "assistant", "content": assistant_text}
                        )
                        i = j + 1
                        continue

                    item = ParsedItem(
                        input={
                            "user_input": user_text,
                            "conversation_history": list(conversation_history),
                        },
                        expected_output={
                            "assistant_output": assistant_text,
                        },
                        metadata={
                            "conversation_id": conv_id,
                            "conversation_title": title,
                            "model_slug": assistant_model,
                            "user_message_id": msg["message_id"],
                            "assistant_message_id": assistant_msg_id,
                            "turn_index": len(conv_items),
                            "conversation_created_at": create_time,
                        },
                    )
                    conv_items.append(item)
                    all_items.append(item)

                    conversation_history.append(
                        {"role": "user", "content": user_text}
                    )
                    conversation_history.append(
                        {"role": "assistant", "content": assistant_text}
                    )
                    i = j + 1
                else:
                    # No assistant response found for this user message
                    skip("no_assistant_response")
                    conversation_history.append(
                        {"role": "user", "content": user_text}
                    )
                    i += 1
            else:
                # Non-user message at start (e.g., assistant greeting)
                conversation_history.append(
                    {"role": msg["role"], "content": msg["text"]}
                )
                i += 1

        if conv_items:
            # Determine dominant model slug for the conversation
            model_slugs = [
                item.metadata.get("model_slug")
                for item in conv_items
                if item.metadata.get("model_slug")
            ]
            dominant_model = (
                max(set(model_slugs), key=model_slugs.count) if model_slugs else None
            )

            all_conversations.append(
                ParsedConversation(
                    id=conv_id,
                    title=title,
                    message_count=len(messages),
                    items=conv_items,
                    model_slug=dominant_model,
                    created_at=create_time,
                )
            )
        else:
            skip("no_valid_pairs")

    return ChatGPTParseResult(
        total_conversations_in_file=total_in_file,
        filtered_conversations=len(all_conversations),
        total_items=len(all_items),
        conversations=all_conversations,
        skipped_reasons=skipped_reasons,
        sample_items=all_items[:5],
    )
