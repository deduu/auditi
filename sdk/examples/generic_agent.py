import time
import json
import re
import asyncio
from typing import Optional, List, Dict, Any, Union, AsyncGenerator, Set
from enum import Enum
from dataclasses import dataclass, field, asdict

from .decorators import trace_agent, trace_llm, trace_tool
from .events import EventType


def get_logger(name, verbose=True):
    import logging

    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO if verbose else logging.WARNING)
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    return logger


# --- Placeholders/Mocks for missing dependencies ---
class MessageRole(str, Enum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


@dataclass
class ToolCall:
    name: str
    arguments: Dict[str, Any]
    id: Optional[str] = None


@dataclass
class Message:
    role: MessageRole
    content: Optional[str] = None
    tool_calls: Optional[List[ToolCall]] = None
    name: Optional[str] = None

    def to_dict(self):
        d = {"role": self.role.value}
        if self.content:
            d["content"] = self.content
        if self.tool_calls:
            d["tool_calls"] = [asdict(tc) for tc in self.tool_calls]
        if self.name:
            d["name"] = self.name
        return d


class BaseLLM:
    """Abstract base for LLM providers."""

    def __init__(self, model_id: str = "unknown"):
        self.model_id = model_id

    def supports_streaming(self) -> bool:
        return True

    async def chat(self, messages, tools=None, enable_thinking=False, **kwargs):
        raise NotImplementedError

    async def stream(self, messages, tools=None, enable_thinking=False, **kwargs):
        raise NotImplementedError

    def _count_tokens(self, text: str) -> int:
        return len(text) // 4


class ToolService:
    def get_tool_descriptions(self) -> List[Dict]:
        return []

    def get_tool_names(self) -> List[str]:
        return []

    async def validate_tool_call(self, query, name, args, history):
        return args, None

    async def execute_tool(self, name, **args):
        return f"Tool {name} executed", None


class ToolOrchestrator:
    def __init__(self, logger=None):
        pass

    async def normalize_tools_async(self, tools):
        return ToolService()


class MessageFormatter:
    def __init__(self, provider):
        self.provider = provider

    def create_assistant_message(self, content, tool_calls):
        return Message(role=MessageRole.ASSISTANT, content=content, tool_calls=tool_calls)

    def create_tool_result_message(self, tool_call, result, metadata=None, warnings=None):
        return Message(role=MessageRole.TOOL, content=str(result), name=tool_call.name)


# --- End Placeholders ---


def compute_metrics(start, first_token, end, total_tokens):
    return {
        "duration": end - start,
        "ttft": first_token - start if first_token else 0,
        "total_tokens": total_tokens,
    }


prompt_template = "Question: {query_text}"


class GenericAgent:
    """Generic agent that works with any LLM provider"""

    def __init__(
        self,
        llm_provider: BaseLLM,
        tool_service: Optional[ToolService] = None,
        max_turns: int = 10,
        system_prompt: str = None,
        verbose: bool = True,
        enable_logging: bool = True,
    ):
        self.llm_provider = llm_provider
        self.tool_service = tool_service
        self.max_turns = max_turns
        self.system_prompt = system_prompt or "You are a helpful AI assistant."
        self.verbose = verbose
        self.logger = get_logger(self.__class__.__name__, verbose=verbose) if verbose else None
        if not self.logger and verbose:
            import logging

            logging.basicConfig(level=logging.INFO)
            self.logger = logging.getLogger("GenericAgent")

        self.message_formatter = MessageFormatter(llm_provider)
        self.model_id = (
            llm_provider.model_id if hasattr(llm_provider, "model_id") else "unknown_model"
        )
        self._run_id = None
        self.enable_logging = enable_logging

    @classmethod
    async def create(
        cls,
        llm_provider: BaseLLM,
        tools: Optional[Union[List[Any], ToolService]] = None,
        **kwargs,
    ):
        """
        Asynchronously create a GenericAgent instance and register MCP tools.
        """
        self = cls(llm_provider, **kwargs)

        # Async normalize tools (MCP, HTTP, stdio)
        tr = ToolOrchestrator(logger=self.logger)
        if isinstance(tools, ToolService):
            self.tool_service = tools
        else:
            self.tool_service = await tr.normalize_tools_async(tools)

        return self

    @trace_agent(name="GenericAgent")
    async def run(
        self,
        user_input,
        user_id: str = None,
        session_id: str = None,
        enable_thinking: bool = False,
        enable_streaming: bool = False,
        **provider_kwargs,
    ):
        """
        Main agent execution loop.
        Returns either:
            - dict: if enable_streaming=False
            - async generator of dict events: if enable_streaming=True
        """

        if isinstance(user_input, str):
            user_prompt = user_input
            messages = [
                Message(MessageRole.SYSTEM, self.system_prompt),
                Message(MessageRole.USER, user_prompt),
            ]
            user_question = user_input
            if self.verbose:
                print(f"user_input is string: {messages}")

        elif isinstance(user_input, list):
            messages = [Message(MessageRole.SYSTEM, self.system_prompt)] + [
                Message(
                    MessageRole(msg["role"]) if "role" in msg else MessageRole.USER,
                    msg.get("content", ""),
                )
                for msg in user_input
            ]

            user_question = next(
                (m.content for m in reversed(messages) if m.role == MessageRole.USER), ""
            )

            # user_prompt = prompt_template.format(query_text=user_question)
            # messages[-1] = Message(MessageRole.USER, user_prompt)

            if self.verbose:
                print(f"user_input is list: {messages}")

        else:
            raise ValueError(
                "user_message must be either a string or a list of {'role','content'} dicts"
            )

        if self.tool_service:
            tool_descriptions = self.tool_service.get_tool_descriptions()
            tool_list = self.tool_service.get_tool_names()
            if self.verbose:
                print(f"[DEBUG] Tool descriptions: {tool_descriptions}")
                print(f"[DEBUG] Tool list: {tool_list}")
        else:
            tool_descriptions = []
            tool_list = []

        agent_timestamp = time.strftime("%Y%m%d_%H%M%S")
        agent_history = []

        if enable_streaming and self.llm_provider.supports_streaming():
            # --- STREAMING MODE ---
            async for event in self._run_streaming(
                agent_timestamp,
                user_question,
                messages,
                tool_list,
                tool_descriptions,
                agent_history,
                enable_thinking,
                **provider_kwargs,
            ):
                yield event
            return

        # --- NON-STREAMING MODE ---
        else:
            # (Non-streaming implementation omitted for brevity as focus is on streaming)
            # In real usage, you'd keep the original non-streaming logic here
            yield {"type": "error", "content": "Non-streaming not implemented in this snippet"}
            return

    async def _run_streaming(
        self,
        agent_timestamp: str,
        user_question: str,
        messages: List[Message],
        tool_list: List[str],
        tool_descriptions: List[Dict[str, Any]],
        agent_history: List[Dict],
        enable_thinking: bool,
        **provider_kwargs,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Streaming mode execution with per-turn tracing"""

        called_functions = set()
        consecutive_reasoning_turns = 0
        global_start_time = time.perf_counter()

        for turn in range(self.max_turns):
            if self.logger:
                self.logger.info(f"🚀 Start streaming turn {turn + 1}/{self.max_turns}")

            cond_is_last_turn = turn == self.max_turns - 1

            content_accumulator = ""
            tool_calls_buffer = []
            perplexity = None
            confidence_level = None

            # Execute one turn (creates one LLM span)
            turn_break_sent = False
            # UPDATED: Now iterating over the generator directly
            async for event in self._execute_streaming_turn(
                turn=turn,
                messages=messages,
                tool_descriptions=tool_descriptions,
                enable_thinking=enable_thinking,
                model=self.model_id,
                **provider_kwargs,
            ):
                if event["type"] == EventType.TOKEN.value:
                    content_accumulator += event["content"]
                    if turn > 0 and not turn_break_sent:
                        yield {"type": EventType.TOKEN.value, "content": "\n\n"}
                        turn_break_sent = True

                    # Yield tokens as they come
                    yield event
                elif event["type"] == EventType.TURN_METADATA.value:
                    # Capture metadata
                    tool_calls_buffer = event.get("tool_calls", [])
                    perplexity = event.get("perplexity")
                    confidence_level = event.get("confidence_level")
                # else: yield other events (phase_end, etc) if needed

            # Process turn results
            thoughts = (
                re.findall(r"<think>(.*?)</think>", content_accumulator, re.DOTALL)
                if enable_thinking
                else None
            )
            response_without_thoughts = re.sub(
                r"<think>.*?</think>", "", content_accumulator, flags=re.DOTALL
            )

            # Create history entry
            turn_record = {
                "turn_number": turn + 1,
                "thought": thoughts,
                "tool_calls": [],
                "called_functions": [],
                "response": response_without_thoughts,
                "perplexity": perplexity,
                "confidence_level": confidence_level,
            }
            agent_history.append(turn_record)

            # ─────────────────────────────
            # TOOL EXECUTION (if any)
            # ─────────────────────────────
            if tool_calls_buffer:
                consecutive_reasoning_turns = 0
                if self.logger:
                    self.logger.info(f"⚙️ Executing {len(tool_calls_buffer)} tool(s)")

                messages.append(
                    self.message_formatter.create_assistant_message(
                        content_accumulator, tool_calls_buffer
                    )
                )

                for tool_call in tool_calls_buffer:
                    yield {"type": EventType.TOOL_EXEC_START.value, "tool": tool_call.name}
                    # Each tool call creates its own span via @trace_tool decorator
                    await self._execute_tool_call(
                        tool_call, user_question, messages, turn_record, called_functions
                    )
                    yield {"type": EventType.TOOL_EXEC_END.value, "tool": tool_call.name}
                    called_functions.add(tool_call.name)

                # self._log_messages_snapshot(turn, messages)

                if not cond_is_last_turn:
                    continue
                else:
                    should_finalize = True

            # ─────────────────────────────
            # NO TOOL CALLS IN THIS TURN
            # ─────────────────────────────
            should_finalize = False

            if content_accumulator.strip():
                consecutive_reasoning_turns += 1

                MAX_CONSECUTIVE_REASONING = 3
                if consecutive_reasoning_turns > MAX_CONSECUTIVE_REASONING:
                    if self.logger:
                        self.logger.warning(
                            f"⚠️ Model produced {consecutive_reasoning_turns} consecutive "
                            f"reasoning turns without tool calls. Forcing finalization."
                        )
                    should_finalize = True
                else:
                    messages.append(
                        self.message_formatter.create_assistant_message(
                            content_accumulator, tool_calls=[]
                        )
                    )

            # ─────────────────────────────
            # CHECK IF FINALIZATION NEEDED
            # ─────────────────────────────
            if not should_finalize:
                should_finalize = (
                    cond_is_last_turn and response_without_thoughts.strip() == ""
                ) or (response_without_thoughts.strip() == "")

            if should_finalize:
                if self.logger:
                    self.logger.info(
                        "🧾 Finalization needed — entering answer-only finalization pass"
                    )

                messages.append(
                    Message(MessageRole.SYSTEM, "Now return final user-facing answer ONLY...")
                )

                yield {"type": EventType.PHASE_START.value, "phase": "final_answer"}

                # Finalization creates its own span
                final_accumulator = ""
                async for event in self._execute_finalization_turn(
                    messages=messages, enable_thinking=False, **provider_kwargs
                ):
                    if event["type"] == EventType.TOKEN.value:
                        final_accumulator += event["content"]
                        yield event

                yield {"type": EventType.PHASE_END.value, "phase": "final_answer"}

                messages.append(
                    self.message_formatter.create_assistant_message(
                        final_accumulator, tool_calls=[]
                    )
                )

                final_answer = self._extract_final_answer(final_accumulator)
                global_end_time = time.perf_counter()
                total_duration = global_end_time - global_start_time

                yield {
                    "type": EventType.COMPLETE.value,
                    "content": final_answer,
                    "history": agent_history,
                    "messages": [m.to_dict() for m in messages],
                }
                return
            else:
                # Direct extraction, no second call needed
                if self.logger:
                    self.logger.info("✅ No finalization needed — extracting answer directly")

                final_answer = self._extract_final_answer(content_accumulator)
                global_end_time = time.perf_counter()
                total_duration = global_end_time - global_start_time

                yield {
                    "type": EventType.COMPLETE.value,
                    "content": final_answer,
                    "history": agent_history,
                    "messages": [m.to_dict() for m in messages],
                }
                return

        # Max turns reached
        yield {
            "type": EventType.COMPLETE.value,
            "content": "The agent could not determine a final answer within the turn limit.",
            "history": agent_history,
        }

    @trace_llm(name="LLMCall")
    async def _execute_streaming_turn(
        self,
        turn: int,
        messages: List[Message],
        tool_descriptions: List[Dict[str, Any]],
        enable_thinking: bool,
        **provider_kwargs,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Execute one streaming turn - creates ONE span per turn.
        UPDATED: Returns AsyncGenerator so trace_llm wraps the whole stream.
        """
        start_time = time.perf_counter()
        first_token_time = None
        total_tokens = 0

        content_accumulator = ""
        tool_calls_buffer: List[ToolCall] = []
        perplexity = None
        confidence_level = None

        async for chunk in self.llm_provider.stream(
            [m.to_dict() for m in messages],
            tools=tool_descriptions,
            enable_thinking=enable_thinking,
            **provider_kwargs,
        ):
            # Count tokens
            if chunk.content or chunk.tool_calls:
                total_tokens += 1
                if first_token_time is None:
                    first_token_time = time.perf_counter()

            if chunk.content:
                # Clean and accumulate
                if "</think>" in chunk.content and "</think>" in content_accumulator:
                    content_accumulator += chunk.content
                    continue

                if "<final_answer>" in chunk.content or "</final_answer>" in chunk.content:
                    chunk.content = self._clean_final_tags(chunk.content)

                content_accumulator += chunk.content

                if self.verbose:
                    print(chunk.content, end="", flush=True)

                yield {"type": EventType.TOKEN.value, "content": chunk.content}

            if chunk.tool_calls:
                tool_calls_buffer.extend(chunk.tool_calls)

            if hasattr(chunk, "perplexity") and chunk.perplexity is not None:
                perplexity = chunk.perplexity
                confidence_level = chunk.confidence_level

            # Capture usage if present in chunk
            if hasattr(chunk, "usage") and chunk.usage:
                usage = chunk.usage
                # Even though we might overwrite, usually the last usage is the cumulative one or only comes once.

        # Yield metadata at the end for the caller to process
        yield {
            "type": EventType.TURN_METADATA.value,
            "tool_calls": tool_calls_buffer,
            "perplexity": perplexity,
            "confidence_level": confidence_level,
            "total_tokens": total_tokens,
            "usage": usage if "usage" in locals() else None,
        }

        end_time = time.perf_counter()
        if self.verbose:
            print(f"\n⚙️  Turn {turn + 1} finished")

    @trace_llm(name="FinalizationCall")
    async def _execute_finalization_turn(
        self, messages: List[Message], enable_thinking: bool, **provider_kwargs
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Execute finalization turn - creates ONE span for finalization.
        UPDATED: Returns AsyncGenerator.
        """
        final_accumulator = ""

        async for chunk in self.llm_provider.stream(
            [m.to_dict() for m in messages], tools=None, enable_thinking=False, **provider_kwargs
        ):
            if chunk.content:
                clean_content = self._clean_final_tags(chunk.content)
                if not clean_content:
                    continue

                if self.verbose:
                    print(clean_content, end="", flush=True)

                final_accumulator += clean_content
                yield {"type": EventType.TOKEN.value, "content": clean_content}

    @trace_tool(name="ToolExecution")
    async def _execute_tool_call(
        self,
        tool_call: ToolCall,
        user_question: str,
        messages: List[Message],
        turn_record: Dict = None,
        called_functions: set = None,
    ):
        """Execute a tool call and append result as a tool message"""
        # (Simplified implementation for this snippet)
        args = tool_call.arguments
        try:
            tool_result, metadata = await self.tool_service.execute_tool(tool_call.name, **args)
        except Exception as e:
            tool_result = f"Error: {e}"
            metadata = None

        messages.append(
            self.message_formatter.create_tool_result_message(
                tool_call, tool_result, metadata, None
            )
        )
        if turn_record:
            turn_record["tool_calls"].append(
                {"name": tool_call.name, "arguments": args, "result": metadata or tool_result}
            )

    def _clean_final_tags(self, content: str) -> str:
        if not content:
            return ""
        return content.replace("<final_answer>", "").replace("</final_answer>", "")

    def _extract_final_answer(self, content: str) -> str:
        content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL)
        content = self._clean_final_tags(content)
        return content.strip()
