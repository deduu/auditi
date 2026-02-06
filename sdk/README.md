<p align="center">
  <img src="https://auditi.dev/logo.svg" alt="Auditi" width="200">
</p>

<h1 align="center">Auditi Python SDK</h1>

<p align="center">
  <strong>Open Source LLM Observability & Evaluation Platform</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <a href="https://pypi.org/project/auditi/"><img src="https://img.shields.io/pypi/v/auditi" alt="PyPI"></a>
  <a href="https://pypi.org/project/auditi/"><img src="https://img.shields.io/pypi/pyversions/auditi" alt="Python"></a>
  <a href="https://github.com/auditi/auditi"><img src="https://img.shields.io/github/stars/auditi/auditi?style=social" alt="Stars"></a>
</p>

<p align="center">
  <a href="https://docs.auditi.dev">Documentation</a> |
  <a href="https://auditi.dev">Website</a> |
  <a href="https://discord.gg/auditi">Discord</a>
</p>

---

**Trace, evaluate, and improve your AI agents with just 2 lines of code.**

```python
import auditi
auditi.init()
auditi.instrument()  # Auto-captures all LLM calls!
```

That's it. Every OpenAI, Anthropic, and Google Gemini call is now traced with costs, latency, and token usage.

---

## Features

- **Zero-Config Auto-Instrumentation** - 2 lines to trace all LLM calls
- **Simple Decorators** - `@trace_agent`, `@trace_tool`, `@trace_llm` for custom control
- **Multi-Provider** - Auto-detects OpenAI, Anthropic, and Google Gemini
- **Cost Tracking** - Automatic token usage and cost calculation
- **Async & Sync** - Works with both synchronous and asynchronous functions
- **Custom Evaluators** - Implement your own evaluation logic
- **Production Ready** - FastAPI, LangChain, and framework integrations

---

## Installation

```bash
pip install auditi
```

## Quick Start

### Option 1: Auto-Instrumentation (Recommended)

The fastest way to get started - just 2 lines of code:

```python
import auditi
from openai import OpenAI

# Initialize and auto-instrument all LLM libraries
auditi.init(api_key="your-api-key")
auditi.instrument()

# Your existing code works unchanged!
client = OpenAI()
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)
# Trace automatically captured with cost, latency, tokens
```

Auto-instrumentation supports:

- **OpenAI** - `client.chat.completions.create()`
- **Anthropic** - `client.messages.create()`
- **Google Gemini** - `model.generate_content()`

> **Note:** Auto-instrumentation captures **LLM calls only** as standalone traces. Tool calls, retrieval, and embeddings are not auto-instrumented. For full agent tracing with multiple steps (tools, retrieval, etc.), use decorators as shown below. You can also combine both: use `auditi.instrument()` alongside `@trace_agent` — auto-instrumented LLM calls will automatically become nested spans within the agent trace.

### Option 2: Decorator-Based (Fine-Grained Control)

For complex agents with multiple steps:

```python
import auditi
from auditi import trace_agent, trace_tool, trace_llm

auditi.init(api_key="your-api-key")

@trace_agent(name="customer_support")
def support_agent(message: str):
    context = get_context(message)
    response = generate_response(message, context)
    return response

@trace_tool(name="get_context")
def get_context(query: str):
    return db.search(query)

@trace_llm(model="gpt-4o")
def generate_response(message: str, context: dict):
    return openai.chat.completions.create(...)
```

### Option 3: Self-Hosted (Development)

Run your own Auditi backend for development:

```bash
# Clone and run with Docker
git clone https://github.com/auditi/auditi
cd auditi
docker-compose up
```

```python
import auditi

# Point to your local instance
auditi.init(base_url="http://localhost:8000")
auditi.instrument()
```

---

## Usage Patterns

### Pattern 1: Simple LLM Calls (Auto-Instrumented)

With auto-instrumentation enabled, all LLM calls are traced automatically:

```python
import auditi
from openai import OpenAI

auditi.init()
auditi.instrument()

client = OpenAI()
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "What is Python?"}]
)
# Trace created automatically!
```

### Pattern 2: Complex Agents with Decorators

For multi-step agentic workflows, use decorators:

```python
from auditi import trace_agent, trace_tool, trace_llm
import openai

@trace_agent(name="customer_support")
def customer_support_agent(user_message: str, user_id: str = None):
    """Your existing agent - just add the decorator!"""

    # Fetch user context
    context = get_user_context(user_id)

    # Search knowledge base
    docs = search_knowledge_base(user_message)

    # Generate response
    response = call_openai(user_message, context, docs)

    return response


@trace_tool(name="search_kb")
def search_knowledge_base(query: str):
    """Tool calls are automatically captured as spans."""
    results = vector_db.similarity_search(query, k=5)
    return results


@trace_llm(model="gpt-4o")
def call_openai(message: str, context: dict, docs: list):
    """LLM calls capture usage metrics and costs."""
    response = openai.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": f"Context: {context}"},
            {"role": "user", "content": message}
        ]
    )
    return response.choices[0].message.content
```

### 3. View Traces in Auditi Dashboard

That's it! Every call to `customer_support_agent()` will:

- ✅ Capture user input and assistant output
- ✅ Track all tool calls and LLM calls as spans
- ✅ Calculate token usage and costs
- ✅ Send to Auditi for evaluation and monitoring

## Usage Patterns

### Pattern 1: Simple LLM Calls (Standalone)

For simple chatbots or single LLM calls, you don't need `@trace_agent`:

```python
@trace_llm(standalone=True)
def simple_chat(prompt: str):
    """Creates its own trace automatically - no agent wrapper needed!"""
    response = openai.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content

# This creates a complete trace automatically
result = simple_chat("What is the capital of France?")
```

### Pattern 2: Complex Agents with Tools

For multi-step agentic workflows:

```python
@trace_agent(name="research_assistant")
def research_assistant(query: str, user_id: str):
    """Main agent creates ONE trace that captures all spans."""

    # Step 1: Web search (creates a tool span)
    search_results = web_search(query)

    # Step 2: Generate initial response (creates an LLM span)
    initial_response = generate_response(query, search_results)

    # Step 3: Reflect on quality (creates another LLM span)
    quality_score = evaluate_response(initial_response)

    # Step 4: Refine if needed (creates another LLM span)
    if quality_score < 0.7:
        final_response = refine_response(initial_response, search_results)
    else:
        final_response = initial_response

    return final_response


@trace_tool("web_search")
def web_search(query: str):
    # Search implementation
    return results


@trace_llm(model="gpt-4o")
def generate_response(query: str, context: list):
    # LLM call
    return response


@trace_llm(model="gpt-4o")
def evaluate_response(text: str):
    # Another LLM call for reflection
    return score
```

### Pattern 3: Embeddings and Retrieval

Embedding and retrieval operations are always standalone by default:

```python
@trace_embedding()
def embed_text(text: str):
    """Creates a standalone trace for embedding."""
    response = openai.embeddings.create(
        input=text,
        model="text-embedding-3-small"
    )
    return response.data[0].embedding


@trace_retrieval("vector_search")
def search_docs(query: str):
    """Creates a standalone trace for retrieval."""
    embedding = embed_text(query)
    results = vector_db.similarity_search(embedding, k=5)
    return results
```

### Pattern 4: RAG Pipeline

Combining all patterns in a full RAG workflow:

```python
@trace_agent(name="rag_assistant")
def rag_query(question: str):
    """Full RAG pipeline - all steps captured as spans."""

    # Embedding step (creates span)
    query_embedding = embed_query(question)

    # Retrieval step (creates span)
    docs = retrieve_docs(query_embedding)

    # LLM step (creates span)
    answer = generate_answer(question, docs)

    return answer


@trace_embedding()
def embed_query(text: str):
    # Embedding logic
    return embedding


@trace_retrieval("doc_search")
def retrieve_docs(embedding: list):
    # Vector search logic
    return documents


@trace_llm(model="gpt-4o")
def generate_answer(question: str, context: list):
    # LLM generation
    return answer
```

## Integration Examples

### FastAPI Integration

```python
from fastapi import FastAPI
from auditi import trace_agent, trace_tool, trace_llm

app = FastAPI()

@app.post("/chat")
async def chat_endpoint(message: str, user_id: str):
    response = await process_chat(message, user_id)
    return {"response": response}


@trace_agent(name="chat_agent")
async def process_chat(message: str, user_id: str):
    """Async agent - fully supported!"""
    context = await fetch_user_context(user_id)
    kb_results = await search_knowledge_base(message)
    response = await call_llm(message, context, kb_results)
    return response


@trace_tool("fetch_context")
async def fetch_user_context(user_id: str):
    # Async tool call
    return context


@trace_llm(model="gpt-4o")
async def call_llm(message: str, context: dict, docs: list):
    # Async LLM call
    return response
```

### LangChain Integration

```python
from langchain.agents import AgentExecutor, create_openai_functions_agent
from auditi import trace_agent, trace_tool

@trace_agent(name="langchain_agent")
def run_langchain_agent(query: str):
    """Wrap your LangChain execution."""
    agent_executor = create_agent()
    result = agent_executor.invoke({"input": query})
    return result["output"]


@trace_tool("vector_search")
def vector_search(query: str):
    """Individual tools can be traced too."""
    return vectorstore.similarity_search(query)
```

## Custom Evaluators

Implement custom evaluation logic to assess trace quality:

```python
from auditi import BaseEvaluator, EvaluationResult, TraceInput

class ResponseQualityEvaluator(BaseEvaluator):
    def evaluate(self, trace: TraceInput) -> EvaluationResult:
        """Evaluate response quality based on custom criteria."""

        # Access trace data
        user_input = trace.user_input
        assistant_output = trace.assistant_output
        spans = trace.spans

        # Your evaluation logic
        score = self._calculate_quality_score(assistant_output)

        # Return evaluation result
        if score >= 0.8:
            status = "pass"
            reason = "High quality response"
        elif score >= 0.6:
            status = "pass"
            reason = "Acceptable quality"
        else:
            status = "fail"
            reason = "Low quality response - needs improvement"

        return EvaluationResult(
            status=status,
            score=score,
            reason=reason
        )

    def _calculate_quality_score(self, text: str) -> float:
        # Your scoring logic here
        return 0.85


# Use with trace_agent
@trace_agent(name="assistant", evaluator=ResponseQualityEvaluator())
def my_agent(message: str):
    response = generate_response(message)
    return response
```

## Multi-Provider Support

Auditi automatically detects and handles multiple LLM providers:

```python
# OpenAI
@trace_llm(model="gpt-4o")
def call_openai(prompt: str):
    response = openai.chat.completions.create(...)
    return response  # Auto-extracts usage from response.usage


# Anthropic Claude
@trace_llm(model="claude-sonnet-4-5-20250929")
def call_anthropic(prompt: str):
    response = anthropic.messages.create(...)
    return response  # Auto-extracts from response.usage


# Google Gemini
@trace_llm(model="gemini-2.0-flash-exp")
def call_google(prompt: str):
    response = genai.generate_content(...)
    return response  # Auto-extracts from response.usage_metadata
```

**Supported Providers:**

- ✅ OpenAI (GPT-4, GPT-4o, GPT-3.5, etc.)
- ✅ Anthropic (Claude 3.5, Claude 3, Claude 2)
- ✅ Google (Gemini Pro, Gemini Flash)
- ✅ Auto-detection from model names and response structures
- ✅ Automatic cost calculation with up-to-date pricing

## Configuration

### Environment Variables

```bash
# Enable debug logging
export AUDITI_DEBUG=true

# Set API key
export AUDITI_API_KEY=your-api-key

# Set base URL
export AUDITI_BASE_URL=https://api.auditi.dev
```

### Programmatic Configuration

```python
import auditi

# Production setup
auditi.init(
    api_key="your-api-key",
    base_url="https://api.auditi.dev"
)

# Development setup (prints traces to console)
from auditi.transport import DebugTransport

auditi.init(
    transport=DebugTransport()  # Prints to console instead of sending
)
```

## Model Pricing

Auditi automatically calculates costs for every LLM call. Pricing is resolved in priority order:

1. **User overrides** (highest priority)
2. **Remote pricing** from your Auditi backend API
3. **Hardcoded defaults** in the SDK (fallback/offline)

### Auto-Updated Pricing

When you call `auditi.init()`, the SDK connects to your backend to fetch the latest model pricing. This means you never need to update the SDK just because a provider changed their prices — update the backend, and all SDK users get the new pricing automatically.

```python
import auditi

# SDK fetches latest pricing from your backend automatically
auditi.init(api_key="your-key", base_url="https://your-auditi-instance.com")
```

Pricing is cached for 1 hour and falls back to hardcoded defaults if the backend is unreachable.

### Custom Pricing Overrides

Override pricing for specific models if you have negotiated rates or want to track custom costs:

```python
from auditi import configure_pricing

# Override specific model pricing (per 1M tokens)
configure_pricing(pricing={
    "openai": {
        "gpt-4o": (2.00, 8.00),           # Custom negotiated rate
        "gpt-4o-mini": (0.10, 0.40),
    },
    "anthropic": {
        "claude-3-5-sonnet-20241022": (2.50, 12.00),
    }
})
```

### Disabling Remote Pricing

For offline or air-gapped environments, disable remote fetching entirely:

```python
from auditi import configure_pricing

# Use only hardcoded defaults
configure_pricing(enable_remote=False)
```

### Updating Pricing (Backend Admin)

If you self-host Auditi, default pricing is seeded on first startup. You can update pricing at any time via the REST API:

```bash
# View all current pricing
curl https://your-auditi-instance.com/api/v1/pricing

# Update a single model's pricing
curl -X POST https://your-auditi-instance.com/api/v1/pricing \
  -H "Content-Type: application/json" \
  -d '{"provider": "openai", "model": "gpt-4o", "input_price": 2.50, "output_price": 10.00}'

# Bulk update multiple models
curl -X POST https://your-auditi-instance.com/api/v1/pricing/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"provider": "openai", "model": "gpt-4o", "input_price": 2.50, "output_price": 10.00},
      {"provider": "openai", "model": "gpt-4o-mini", "input_price": 0.15, "output_price": 0.60}
    ]
  }'
```

---

## API Reference

### Decorators

#### `@trace_agent(name=None, user_id=None, evaluator=None)`

Trace a top-level agent function. Creates a complete trace with user input, assistant output, and all spans.

**Parameters:**

- `name` (str, optional): Custom name for the agent
- `user_id` (str, optional): User identifier
- `evaluator` (BaseEvaluator, optional): Custom evaluator instance

**Returns:** The decorated function's return value becomes `assistant_output`

#### `@trace_tool(name=None, standalone=False)`

Trace a tool/function call within an agent.

**Parameters:**

- `name` (str, optional): Custom name for the tool
- `standalone` (bool): If True, creates a standalone trace when not inside `@trace_agent`

#### `@trace_llm(name=None, model=None, standalone=False)`

Trace an LLM call within an agent.

**Parameters:**

- `name` (str, optional): Custom name for the LLM call
- `model` (str, optional): Model name (auto-detected from response if not provided)
- `standalone` (bool): If True, creates a standalone trace when not inside `@trace_agent`

#### `@trace_embedding(name=None, model=None)`

Trace an embedding operation. Always creates a standalone trace when not inside `@trace_agent`.

**Parameters:**

- `name` (str, optional): Custom name for the embedding operation
- `model` (str, optional): Model name (auto-detected if not provided)

#### `@trace_retrieval(name=None)`

Trace a retrieval/search operation. Always creates a standalone trace when not inside `@trace_agent`.

**Parameters:**

- `name` (str, optional): Custom name for the retrieval operation

### Types

#### `TraceInput`

Complete trace data model.

**Fields:**

- `trace_id` (str): Unique trace identifier
- `name` (str): Agent name
- `user_input` (str): User's message
- `assistant_output` (str): Agent's response
- `user_id` (str, optional): User identifier
- `conversation_id` (str, optional): Conversation/session identifier
- `spans` (List[SpanInput]): List of spans (tools, LLM calls)
- `input_tokens` (int): Total input tokens
- `output_tokens` (int): Total output tokens
- `total_tokens` (int): Total tokens
- `cost` (float): Total cost in USD
- `processing_time` (float): Total processing time in seconds
- `metadata` (dict, optional): Additional metadata
- `timestamp` (datetime): Trace timestamp

#### `SpanInput`

Individual span within a trace.

**Fields:**

- `span_id` (str): Unique span identifier
- `name` (str): Span name
- `span_type` (str): Type: "tool", "llm", "embedding", "retrieval"
- `inputs` (dict): Input parameters
- `outputs` (Any): Output value
- `input_tokens` (int, optional): Input tokens (for LLM spans)
- `output_tokens` (int, optional): Output tokens (for LLM spans)
- `total_tokens` (int, optional): Total tokens
- `cost` (float, optional): Cost in USD
- `model` (str, optional): Model name
- `processing_time` (float, optional): Processing time in seconds
- `timestamp` (datetime): Span timestamp

#### `EvaluationResult`

Evaluation result data.

**Fields:**

- `status` (str): "pass" or "fail"
- `score` (float, optional): Evaluation score
- `reason` (str, optional): Explanation
- `metadata` (dict, optional): Additional evaluation data

### Transport

#### `SyncHttpTransport(api_key, base_url)`

Default synchronous HTTP transport.

**Parameters:**

- `api_key` (str): API key for authentication
- `base_url` (str): Base URL of Auditi API

#### `DebugTransport()`

Debug transport that prints traces to console. Useful for local development.

### Context Management

```python
from auditi.context import (
    get_current_trace,
    set_current_trace,
    get_current_span,
    set_context,
    get_context
)

# Get current trace (if inside @trace_agent)
trace = get_current_trace()

# Get current span (if inside @trace_tool/@trace_llm)
span = get_current_span()

# Set global context (available across all traces)
set_context({"environment": "production", "version": "1.0"})
```

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/deduu/auditi
cd auditi

# Install dev dependencies
pip install -e ".[dev]"
```

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=auditi --cov-report=html

# Run specific test file
pytest tests/test_decorators.py -v

# Run async tests
pytest tests/test_decorators.py -k async
```

### Code Quality

```bash
# Format code
black auditi/

# Lint code
ruff auditi/

# Type check
mypy auditi/
```

### Project Structure

```
auditi/
├── __init__.py           # Package initialization
├── client.py             # SDK client and initialization
├── context.py            # Context management for traces/spans
├── decorators.py         # Core decorators (@trace_agent, etc.)
├── evaluator.py          # Base evaluator class
├── events.py             # Event types for streaming
├── transport.py          # Transport layer (HTTP, Debug)
├── providers/            # LLM provider abstractions
│   ├── __init__.py
│   ├── base.py          # Base provider interface
│   ├── openai.py        # OpenAI provider
│   ├── anthropic.py     # Anthropic provider
│   ├── google.py        # Google provider
│   └── registry.py      # Provider auto-detection
└── types/
    ├── __init__.py
    └── api_types.py     # Pydantic models for API types
```

## Examples

The `examples/` directory contains complete working examples:

- `01_basic_integration.py` - Simple chatbot integration
- `02_fastapi_integration.py` - Production FastAPI integration
- `03_langchain_integration.py` - LangChain agent integration
- `04_simple_llm_traces.py` - Standalone LLM call tracing
- `05_embedding_traces.py` - Embedding and retrieval tracing

Run any example:

```bash
# Enable debug output
export AUDITI_DEBUG=true

# Run example
python examples/01_basic_integration.py
```

## Troubleshooting

### Traces Not Appearing

1. **Check initialization:**

   ```python
   import auditi
   auditi.init(api_key="your-key", base_url="https://api.auditi.dev")
   ```

2. **Enable debug logging:**

   ```bash
   export AUDITI_DEBUG=true
   python your_script.py
   ```

3. **Verify decorator order:**
   - `@trace_agent` should be the outermost decorator
   - `@trace_tool` and `@trace_llm` should be inside functions called by the agent

### Missing Usage Metrics

Make sure your LLM call returns the full response object:

```python
@trace_llm(model="gpt-4o")
def call_openai(prompt: str):
    response = openai.chat.completions.create(...)
    return response  # ✅ Return full response, not just .choices[0].message.content
```

### Async Functions Not Working

Both sync and async functions are supported. Make sure to use `await`:

```python
@trace_agent(name="async_agent")
async def my_agent(message: str):
    result = await async_llm_call(message)
    return result
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Links

- GitHub: [https://github.com/deduu/auditi](https://github.com/deduu/auditi)
