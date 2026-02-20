"""Tests for the ChatGPT export parser service."""

import json
import zipfile
import io
import uuid

import pytest

from app.services.chatgpt_parser import (
    extract_conversations_json,
    parse_conversations,
    ChatGPTImportConfig,
    _linearize_conversation,
    _extract_text_from_content,
    _get_model_slug,
)


# ---------------------------------------------------------------------------
# Helpers to build ChatGPT conversation fixtures
# ---------------------------------------------------------------------------


def make_message(role, text, model_slug=None, create_time=None):
    """Build a ChatGPT message node."""
    msg_id = str(uuid.uuid4())
    metadata = {}
    if model_slug:
        metadata["model_slug"] = model_slug
    return {
        "id": msg_id,
        "author": {"role": role, "name": None, "metadata": {}},
        "create_time": create_time,
        "content": {"content_type": "text", "parts": [text] if text else []},
        "status": "finished_successfully",
        "metadata": metadata,
    }


def build_linear_conversation(turns, conv_id=None, title="Test Convo", create_time=1700000000.0):
    """
    Build a linear conversation from a list of (role, text, model_slug) tuples.
    Returns a full conversation dict with mapping.
    """
    conv_id = conv_id or str(uuid.uuid4())
    mapping = {}
    prev_id = None

    for role, text, model_slug in turns:
        node_id = str(uuid.uuid4())
        msg = make_message(role, text, model_slug=model_slug)
        mapping[node_id] = {
            "id": node_id,
            "message": msg,
            "parent": prev_id,
            "children": [],
        }
        if prev_id and prev_id in mapping:
            mapping[prev_id]["children"].append(node_id)
        prev_id = node_id

    return {
        "id": conv_id,
        "title": title,
        "create_time": create_time,
        "update_time": create_time + 100,
        "mapping": mapping,
    }


# ---------------------------------------------------------------------------
# Tests for extract_conversations_json
# ---------------------------------------------------------------------------


class TestExtractConversationsJson:
    def test_raw_json(self):
        """Parses raw JSON bytes."""
        data = [{"id": "1", "title": "test", "mapping": {}}]
        result = extract_conversations_json(json.dumps(data).encode())
        assert result == data

    def test_zip_file(self):
        """Extracts conversations.json from a ZIP."""
        data = [{"id": "1", "title": "test", "mapping": {}}]
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("conversations.json", json.dumps(data))
        result = extract_conversations_json(buf.getvalue())
        assert result == data

    def test_zip_without_conversations_json(self):
        """Raises ValueError when ZIP has no conversations.json."""
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("other.json", "{}")
        with pytest.raises(ValueError, match="does not contain conversations.json"):
            extract_conversations_json(buf.getvalue())

    def test_invalid_file(self):
        """Raises ValueError for random bytes."""
        with pytest.raises(ValueError, match="neither a valid ZIP nor valid JSON"):
            extract_conversations_json(b"this is not json or zip")

    def test_json_not_array(self):
        """Raises ValueError when JSON is not a list."""
        with pytest.raises(ValueError, match="must contain an array"):
            extract_conversations_json(json.dumps({"not": "a list"}).encode())


# ---------------------------------------------------------------------------
# Tests for helper functions
# ---------------------------------------------------------------------------


class TestExtractTextFromContent:
    def test_text_parts(self):
        content = {"content_type": "text", "parts": ["Hello", "World"]}
        assert _extract_text_from_content(content) == "Hello\nWorld"

    def test_empty_parts(self):
        content = {"content_type": "text", "parts": []}
        assert _extract_text_from_content(content) == ""

    def test_none_content(self):
        assert _extract_text_from_content(None) == ""

    def test_mixed_parts_skips_dicts(self):
        """Dicts (images, attachments) in parts should be skipped."""
        content = {
            "content_type": "multimodal_text",
            "parts": [
                "Here is the image:",
                {"content_type": "image_asset_pointer", "asset_pointer": "file-xxx"},
            ],
        }
        assert _extract_text_from_content(content) == "Here is the image:"


class TestGetModelSlug:
    def test_with_model(self):
        msg = {"metadata": {"model_slug": "gpt-4"}}
        assert _get_model_slug(msg) == "gpt-4"

    def test_without_model(self):
        msg = {"metadata": {}}
        assert _get_model_slug(msg) is None

    def test_none_message(self):
        assert _get_model_slug(None) is None


# ---------------------------------------------------------------------------
# Tests for _linearize_conversation
# ---------------------------------------------------------------------------


class TestLinearizeConversation:
    def test_linear_path(self):
        """Simple linear path A -> B -> C."""
        mapping = {
            "a": {"id": "a", "message": {"id": "m1"}, "parent": None, "children": ["b"]},
            "b": {"id": "b", "message": {"id": "m2"}, "parent": "a", "children": ["c"]},
            "c": {"id": "c", "message": {"id": "m3"}, "parent": "b", "children": []},
        }
        result = _linearize_conversation(mapping)
        assert [n["id"] for n in result] == ["a", "b", "c"]

    def test_branched_takes_longest(self):
        """
        Branched tree:
            A -> B -> C -> D (length 4)
            A -> E (length 2)
        Should pick the longer branch.
        """
        mapping = {
            "a": {"id": "a", "parent": None, "children": ["b", "e"], "message": {}},
            "b": {"id": "b", "parent": "a", "children": ["c"], "message": {}},
            "c": {"id": "c", "parent": "b", "children": ["d"], "message": {}},
            "d": {"id": "d", "parent": "c", "children": [], "message": {}},
            "e": {"id": "e", "parent": "a", "children": [], "message": {}},
        }
        result = _linearize_conversation(mapping)
        assert [n["id"] for n in result] == ["a", "b", "c", "d"]

    def test_empty_mapping(self):
        assert _linearize_conversation({}) == []


# ---------------------------------------------------------------------------
# Tests for parse_conversations
# ---------------------------------------------------------------------------


class TestParseConversations:
    def test_simple_conversation(self):
        """Basic user-assistant pair extraction."""
        conv = build_linear_conversation([
            ("system", "You are helpful.", None),
            ("user", "What is Python?", None),
            ("assistant", "Python is a programming language.", "gpt-4"),
        ])

        config = ChatGPTImportConfig()
        result = parse_conversations([conv], config)

        assert result.total_conversations_in_file == 1
        assert result.filtered_conversations == 1
        assert result.total_items == 1
        assert result.conversations[0].model_slug == "gpt-4"

        item = result.conversations[0].items[0]
        assert item.input["user_input"] == "What is Python?"
        assert item.expected_output["assistant_output"] == "Python is a programming language."
        assert item.metadata["model_slug"] == "gpt-4"
        assert item.metadata["turn_index"] == 0

    def test_multi_turn(self):
        """Multi-turn conversation produces multiple items with history."""
        conv = build_linear_conversation([
            ("user", "Hello", None),
            ("assistant", "Hi there!", "gpt-4"),
            ("user", "How are you?", None),
            ("assistant", "I'm doing well!", "gpt-4"),
        ])

        config = ChatGPTImportConfig()
        result = parse_conversations([conv], config)

        assert result.total_items == 2
        # Second item should have conversation history
        second_item = result.conversations[0].items[1]
        assert len(second_item.input["conversation_history"]) == 2
        assert second_item.input["conversation_history"][0]["role"] == "user"
        assert second_item.input["conversation_history"][0]["content"] == "Hello"

    def test_skip_system_messages(self):
        """System messages are skipped by default."""
        conv = build_linear_conversation([
            ("system", "You are helpful.", None),
            ("user", "Hi", None),
            ("assistant", "Hello!", "gpt-4"),
        ])

        config = ChatGPTImportConfig(skip_system_messages=True)
        result = parse_conversations([conv], config)

        assert result.total_items == 1

    def test_include_system_messages(self):
        """When skip_system_messages is False, system messages affect history."""
        conv = build_linear_conversation([
            ("system", "You are helpful.", None),
            ("user", "Hi", None),
            ("assistant", "Hello!", "gpt-4"),
        ])

        config = ChatGPTImportConfig(skip_system_messages=False)
        result = parse_conversations([conv], config)

        assert result.total_items == 1
        # System message should be in history
        item = result.conversations[0].items[0]
        assert len(item.input["conversation_history"]) == 1
        assert item.input["conversation_history"][0]["role"] == "system"

    def test_model_filter(self):
        """Only include items from the specified model."""
        conv = build_linear_conversation([
            ("user", "Question 1", None),
            ("assistant", "Answer from GPT-4", "gpt-4"),
            ("user", "Question 2", None),
            ("assistant", "Answer from GPT-3.5", "gpt-3.5-turbo"),
        ])

        config = ChatGPTImportConfig(model_filter="gpt-4")
        result = parse_conversations([conv], config)

        assert result.total_items == 1
        assert result.conversations[0].items[0].metadata["model_slug"] == "gpt-4"
        assert result.skipped_reasons.get("model_filter", 0) == 1

    def test_date_filter(self):
        """Filter conversations by date range."""
        old_conv = build_linear_conversation(
            [("user", "Old question", None), ("assistant", "Old answer", "gpt-4")],
            title="Old",
            create_time=1600000000.0,
        )
        new_conv = build_linear_conversation(
            [("user", "New question", None), ("assistant", "New answer", "gpt-4")],
            title="New",
            create_time=1700000000.0,
        )

        config = ChatGPTImportConfig(date_from=1650000000.0)
        result = parse_conversations([old_conv, new_conv], config)

        assert result.total_conversations_in_file == 2
        assert result.filtered_conversations == 1
        assert result.conversations[0].title == "New"
        assert result.skipped_reasons.get("date_filter", 0) == 1

    def test_min_message_length(self):
        """Short messages are filtered out."""
        conv = build_linear_conversation([
            ("user", "Hi", None),
            ("assistant", "Hello!", "gpt-4"),
            ("user", "What is the meaning of life?", None),
            ("assistant", "42 is the answer to everything.", "gpt-4"),
        ])

        config = ChatGPTImportConfig(min_message_length=10)
        result = parse_conversations([conv], config)

        assert result.total_items == 1
        assert result.conversations[0].items[0].input["user_input"] == "What is the meaning of life?"

    def test_max_conversations(self):
        """Limit the number of conversations processed."""
        convs = [
            build_linear_conversation(
                [("user", f"Q{i}", None), ("assistant", f"A{i}", "gpt-4")],
                title=f"Conv {i}",
            )
            for i in range(5)
        ]

        config = ChatGPTImportConfig(max_conversations=2)
        result = parse_conversations(convs, config)

        assert result.total_conversations_in_file == 5
        assert result.filtered_conversations == 2

    def test_empty_messages_skipped(self):
        """Messages with empty text are skipped."""
        conv = build_linear_conversation([
            ("user", "", None),
            ("assistant", "I didn't get that", "gpt-4"),
            ("user", "Real question", None),
            ("assistant", "Real answer", "gpt-4"),
        ])

        config = ChatGPTImportConfig()
        result = parse_conversations([conv], config)

        assert result.total_items == 1
        assert result.skipped_reasons.get("empty_message", 0) >= 1

    def test_no_assistant_response(self):
        """User messages without assistant responses are skipped."""
        conv = build_linear_conversation([
            ("user", "Hello?", None),
        ])

        config = ChatGPTImportConfig()
        result = parse_conversations([conv], config)

        assert result.total_items == 0
        assert result.skipped_reasons.get("no_assistant_response", 0) == 1

    def test_sample_items_limited_to_5(self):
        """sample_items in the result is capped at 5."""
        conv = build_linear_conversation(
            [(role, f"Msg {i}", "gpt-4") for i in range(20) for role in ("user", "assistant")]
        )

        config = ChatGPTImportConfig()
        result = parse_conversations([conv], config)

        assert len(result.sample_items) == 5
        assert result.total_items == 20  # 40 messages / 2 = 20 pairs

    def test_conversation_with_no_mapping(self):
        """Conversations without mapping are skipped."""
        conv = {"id": "1", "title": "Empty", "create_time": 1700000000.0, "mapping": {}}

        config = ChatGPTImportConfig()
        result = parse_conversations([conv], config)

        assert result.filtered_conversations == 0
        assert result.skipped_reasons.get("no_mapping", 0) == 1

    def test_multimodal_content_text_only(self):
        """Only text parts are extracted from multimodal messages."""
        conv_id = str(uuid.uuid4())
        node_user = str(uuid.uuid4())
        node_asst = str(uuid.uuid4())

        mapping = {
            node_user: {
                "id": node_user,
                "message": {
                    "id": str(uuid.uuid4()),
                    "author": {"role": "user"},
                    "content": {
                        "content_type": "multimodal_text",
                        "parts": [
                            "Describe this image:",
                            {"content_type": "image_asset_pointer", "asset_pointer": "file-xxx"},
                        ],
                    },
                    "metadata": {},
                },
                "parent": None,
                "children": [node_asst],
            },
            node_asst: {
                "id": node_asst,
                "message": {
                    "id": str(uuid.uuid4()),
                    "author": {"role": "assistant"},
                    "content": {"content_type": "text", "parts": ["I see a cat."]},
                    "metadata": {"model_slug": "gpt-4-vision"},
                },
                "parent": node_user,
                "children": [],
            },
        }

        conv = {
            "id": conv_id,
            "title": "Vision test",
            "create_time": 1700000000.0,
            "mapping": mapping,
        }

        config = ChatGPTImportConfig()
        result = parse_conversations([conv], config)

        assert result.total_items == 1
        assert result.conversations[0].items[0].input["user_input"] == "Describe this image:"
        assert result.conversations[0].items[0].expected_output["assistant_output"] == "I see a cat."
