"""
NL Query Engine — orchestrates LLM function-calling for natural language queries.

Uses the same pattern as eval_worker: gets default LLMConnection from DB,
decrypts API key, creates an OpenAI-compatible client, and calls with tools.
"""

import json
import logging
import time
import uuid
from collections import OrderedDict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.llm_connection import LLMConnection
from app.services.nl_query_functions import FUNCTION_REGISTRY, TOOL_DEFINITIONS
from app.services.nl_query_tracer import record_ask_auditi_trace
from app.utils.encryption import decrypt_api_key

logger = logging.getLogger("auditi.nl_query_engine")

MAX_SESSIONS = 200
SESSION_TTL_SECONDS = 3600  # 1 hour
MAX_MESSAGES_PER_SESSION = 50

SYSTEM_PROMPT = """You are Auditi's AI assistant. You help users explore their AI/LLM observability data — traces, evaluations, scores, costs, latency, failure modes, and more.

You have access to query functions that search and aggregate data from the user's Auditi instance. Use them to answer questions accurately.

Guidelines:
- Call the appropriate query function(s) to get data before answering.
- When the user's question is ambiguous about time range, default to 7 days.
- Present numbers clearly: format costs as dollars, scores as percentages, latency in seconds.
- Keep answers concise but informative. Highlight key findings.
- If the data is empty, say so clearly and suggest what the user might check.
- For follow-up questions, use context from earlier in the conversation to resolve references like "those", "the same model", etc.
- Never make up data. Only report what the query functions return."""


class SessionStore:
    """In-memory LRU session store with TTL eviction."""

    def __init__(self) -> None:
        self._sessions: OrderedDict[str, Dict[str, Any]] = OrderedDict()

    def get(self, session_id: str) -> Optional[Dict[str, Any]]:
        session = self._sessions.get(session_id)
        if session is None:
            return None
        if time.time() - session["created_at"] > SESSION_TTL_SECONDS:
            self._sessions.pop(session_id, None)
            return None
        self._sessions.move_to_end(session_id)
        return session

    def create(self) -> str:
        self._evict()
        session_id = str(uuid.uuid4())
        self._sessions[session_id] = {
            "messages": [],
            "created_at": time.time(),
        }
        return session_id

    def add_message(self, session_id: str, role: str, content: str,
                    data: Optional[List] = None, visualization: Optional[str] = None) -> None:
        session = self.get(session_id)
        if session is None:
            return
        if len(session["messages"]) >= MAX_MESSAGES_PER_SESSION:
            # Drop oldest pair to make room
            session["messages"] = session["messages"][2:]
        session["messages"].append({
            "role": role,
            "content": content,
            "data": data,
            "visualization": visualization,
        })

    def pop_last_pair(self, session_id: str) -> None:
        """Remove the last user+assistant message pair (for regeneration)."""
        session = self.get(session_id)
        if session is None:
            return
        msgs = session["messages"]
        # Remove trailing assistant then user message
        if msgs and msgs[-1]["role"] == "assistant":
            msgs.pop()
        if msgs and msgs[-1]["role"] == "user":
            msgs.pop()

    def delete(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)

    def _evict(self) -> None:
        now = time.time()
        # Evict expired
        expired = [
            sid for sid, s in self._sessions.items()
            if now - s["created_at"] > SESSION_TTL_SECONDS
        ]
        for sid in expired:
            self._sessions.pop(sid, None)
        # Evict oldest if over capacity
        while len(self._sessions) >= MAX_SESSIONS:
            self._sessions.popitem(last=False)


# Module-level singleton
session_store = SessionStore()


class NLQueryEngine:
    """Handles a single query turn: builds messages, calls LLM with tools, dispatches functions."""

    def __init__(self, db: Session) -> None:
        self.db = db

    async def ask(
        self, query: str, session_id: Optional[str] = None,
        regenerate: bool = False,
    ) -> Tuple[str, Optional[List[Dict]], Optional[str], str, int]:
        """
        Process a user query.

        Returns (answer, data, visualization, session_id, token_usage).
        """
        trace_start = datetime.now(timezone.utc)
        llm_call_records: List[Dict[str, Any]] = []
        function_call_records: List[Dict[str, Any]] = []

        # Session management
        if session_id:
            session = session_store.get(session_id)
            if session is None:
                session_id = session_store.create()
        else:
            session_id = session_store.create()

        # For regeneration: remove the last user+assistant pair so the LLM
        # doesn't see a duplicate query in the conversation history.
        if regenerate:
            session_store.pop_last_pair(session_id)

        session_store.add_message(session_id, "user", query)

        # Get LLM client
        try:
            client, model = self._get_llm_client()
        except ValueError as e:
            error_msg = str(e)
            session_store.add_message(session_id, "assistant", error_msg)
            return error_msg, None, None, session_id, 0

        # Build message history for LLM
        session = session_store.get(session_id)
        llm_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        if session:
            for msg in session["messages"]:
                llm_messages.append({"role": msg["role"], "content": msg["content"]})

        # Tool-call loop (max 3 iterations to prevent runaway)
        data = None
        visualization = None
        total_tokens = 0

        for _ in range(3):
            llm_start = datetime.now(timezone.utc)
            try:
                response = await client.chat.completions.create(
                    model=model,
                    messages=llm_messages,
                    tools=TOOL_DEFINITIONS,
                    tool_choice="auto",
                    temperature=0.1,
                    max_tokens=1500,
                )
            except Exception as e:
                logger.error("LLM call failed: %s", e)
                error_msg = "Sorry, I couldn't process your query. Please check your LLM connection settings."
                session_store.add_message(session_id, "assistant", error_msg)
                return error_msg, None, None, session_id, total_tokens
            llm_end = datetime.now(timezone.utc)

            # Track token usage
            if response.usage:
                total_tokens += response.usage.total_tokens

            choice = response.choices[0]

            # Record LLM call timing with rich context
            input_tokens = response.usage.prompt_tokens if response.usage else 0
            output_tokens = response.usage.completion_tokens if response.usage else 0
            call_total = response.usage.total_tokens if response.usage else 0
            llm_call_records.append({
                "start_time": llm_start,
                "end_time": llm_end,
                "processing_time": (llm_end - llm_start).total_seconds(),
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": call_total,
                "messages_count": len(llm_messages),
                "finish_reason": choice.finish_reason or "",
                "user_query": query,
                "response_content": (choice.message.content or "")[:500] if choice.message.content else None,
                "tool_calls_requested": [
                    {"name": tc.function.name, "arguments": tc.function.arguments[:200]}
                    for tc in (choice.message.tool_calls or [])
                ],
            })

            # If the LLM wants to call tools
            if choice.finish_reason == "tool_calls" or choice.message.tool_calls:
                # Add assistant message with tool calls
                llm_messages.append(choice.message)

                for tool_call in choice.message.tool_calls:
                    fn_name = tool_call.function.name
                    try:
                        fn_args = json.loads(tool_call.function.arguments)
                    except json.JSONDecodeError:
                        fn_args = {}

                    logger.info("Calling %s with %s", fn_name, fn_args)

                    func = FUNCTION_REGISTRY.get(fn_name)
                    fc_start = datetime.now(timezone.utc)
                    if func is None:
                        result_str = json.dumps({"error": f"Unknown function: {fn_name}"})
                        viz = None
                        fc_end = datetime.now(timezone.utc)
                        function_call_records.append({
                            "name": fn_name,
                            "arguments": fn_args,
                            "start_time": fc_start,
                            "end_time": fc_end,
                            "processing_time": (fc_end - fc_start).total_seconds(),
                            "error": f"Unknown function: {fn_name}",
                        })
                    else:
                        try:
                            result_data, viz = func(self.db, **fn_args)
                            fc_end = datetime.now(timezone.utc)
                            data = result_data
                            visualization = viz
                            result_str = json.dumps(result_data, default=str)
                            # Truncate very large results
                            if len(result_str) > 8000:
                                result_str = result_str[:8000] + '..."truncated"]'
                            function_call_records.append({
                                "name": fn_name,
                                "arguments": fn_args,
                                "start_time": fc_start,
                                "end_time": fc_end,
                                "processing_time": (fc_end - fc_start).total_seconds(),
                                "result_preview": result_str[:1000],
                            })
                        except Exception as e:
                            fc_end = datetime.now(timezone.utc)
                            logger.error("Function %s failed: %s", fn_name, e)
                            result_str = json.dumps({"error": str(e)})
                            viz = None
                            function_call_records.append({
                                "name": fn_name,
                                "arguments": fn_args,
                                "start_time": fc_start,
                                "end_time": fc_end,
                                "processing_time": (fc_end - fc_start).total_seconds(),
                                "error": str(e),
                            })

                    llm_messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": result_str,
                    })

                # Continue loop — LLM will now synthesize
                continue

            # LLM returned a text response (done)
            answer = choice.message.content or "I couldn't generate a response."
            session_store.add_message(session_id, "assistant", answer, data, visualization)
            self._record_trace(
                session_id, query, answer, model, total_tokens,
                llm_call_records, function_call_records, trace_start,
            )
            return answer, data, visualization, session_id, total_tokens

        # Fallback if loop exhausted
        answer = "I processed your query but couldn't synthesize a complete answer. Please try rephrasing."
        session_store.add_message(session_id, "assistant", answer, data, visualization)
        self._record_trace(
            session_id, query, answer, model, total_tokens,
            llm_call_records, function_call_records, trace_start,
        )
        return answer, data, visualization, session_id, total_tokens

    def _record_trace(
        self, session_id: str, query: str, answer: str, model: str,
        total_tokens: int, llm_calls: List[Dict], function_calls: List[Dict],
        trace_start: datetime,
    ) -> None:
        """Fire-and-forget: record self-trace. Never raises."""
        try:
            record_ask_auditi_trace(
                self.db,
                session_id=session_id,
                user_query=query,
                assistant_answer=answer,
                model=model,
                total_tokens=total_tokens,
                llm_calls=llm_calls,
                function_calls=function_calls,
                start_time=trace_start,
                end_time=datetime.now(timezone.utc),
            )
        except Exception:
            logger.exception("Failed to record self-trace (non-fatal)")

    def _get_llm_client(self):
        """Get AsyncOpenAI client from the default LLM connection."""
        connection = (
            self.db.query(LLMConnection)
            .filter(
                LLMConnection.is_default == True,
                LLMConnection.api_key_encrypted.isnot(None),
            )
            .first()
        )
        if not connection:
            raise ValueError(
                "No default LLM connection configured. "
                "Please set up an LLM connection in Settings > LLM Connections."
            )

        api_key = decrypt_api_key(connection.api_key_encrypted)
        if not api_key:
            raise ValueError(
                "Failed to decrypt the LLM API key. Please re-save your LLM connection."
            )

        model = connection.default_model or "gpt-4o"

        # Use OpenAI-compatible client for all providers (works with base_url for others)
        from openai import AsyncOpenAI

        client = AsyncOpenAI(
            api_key=api_key,
            base_url=connection.base_url or None,
        )
        return client, model
