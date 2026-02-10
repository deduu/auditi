---
sidebar_position: 1
---

# SDK Integration Patterns

Auditi provides flexible ways to integrate with your existing codebase. All methods require initializing the SDK first:

```python
import auditi

auditi.init(api_key="audi_...", base_url="http://localhost:8000")
```

## Method 1: Auto-Instrumentation (Recommended)

For most use cases, especially when using standard libraries, auto-instrumentation is the cleanest approach.

```python
import auditi
from openai import OpenAI

# Initialize the SDK
auditi.init(api_key="audi_...", base_url="http://localhost:8000")

# Auto-instrument supported libraries (OpenAI, Anthropic, Google)
auditi.instrument()

# Now all LLM calls are automatically traced!
client = OpenAI()
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "What is the capital of France?"}]
)
print(response.choices[0].message.content)
```

### Supported Libraries

- OpenAI (`openai>=1.0.0`)
- Anthropic (`anthropic>=0.3.0`)
- Google Generative AI
- *More coming soon*

## Method 2: Decorators (Manual Control)

Use decorators for more granular control over tracing:

```python
import auditi
from auditi import trace_agent, trace_tool, trace_llm

# Initialize the SDK
auditi.init(api_key="audi_...", base_url="http://localhost:8000")

@trace_llm(standalone=True)
def simple_chat(prompt: str) -> str:
    """Simple LLM call - creates its own trace automatically"""
    response = openai.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content

# Call your function normally
result = simple_chat("What is the capital of France?")
```

### Available Decorators

| Decorator | Use Case |
|-----------|----------|
| `@trace_agent()` | Top-level agent that creates a trace with nested spans |
| `@trace_tool()` | Tool/function calls within an agent |
| `@trace_llm()` | LLM API calls |
| `@trace_embedding()` | Embedding operations |
| `@trace_retrieval()` | Vector DB / retrieval operations |

## Method 3: Agent with Tools

```python
@trace_tool()
def search_knowledge_base(query: str) -> str:
    """Search the knowledge base - creates a span"""
    results = db.search(query)
    return f"Found {len(results)} results"

@trace_llm()
def call_llm(prompt: str, context: str) -> str:
    """LLM call - creates a span with usage tracking"""
    response = openai.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": context},
            {"role": "user", "content": prompt}
        ]
    )
    return response.choices[0].message.content

@trace_agent(name="Customer Support Agent")
def support_agent(user_message: str, user_id: str = None, session_id: str = None):
    """Main agent - creates a trace with all spans"""
    # Search knowledge base (span 1)
    context = search_knowledge_base(user_message)

    # Generate response (span 2)
    response = call_llm(user_message, context)

    return response

# Use the agent
result = support_agent(
    "How do I reset my password?",
    user_id="user_123",
    session_id="conv_456"
)
```

## Method 4: RAG Pipeline

```python
@trace_embedding()
def embed_text(text: str) -> list:
    """Embed text - standalone trace"""
    response = openai.embeddings.create(
        input=text,
        model="text-embedding-3-small"
    )
    return response.data[0].embedding

@trace_retrieval()
def search_docs(query_embedding: list, top_k: int = 5) -> list:
    """Search vector DB - standalone trace"""
    return vector_db.similarity_search(query_embedding, k=top_k)

@trace_agent(name="RAG Agent")
def rag_query(question: str):
    """Full RAG pipeline with individual span tracking"""
    # Embed query (span 1)
    query_embedding = embed_text(question)

    # Retrieve documents (span 2)
    docs = search_docs(query_embedding)

    # Generate answer (span 3)
    context = "\n".join([d.text for d in docs])
    answer = call_llm(question, context)

    return answer
```

## Method 5: Mixed Mode

Combine auto-instrumentation with decorators for maximum flexibility:

```python
import auditi
from auditi import trace_agent
from openai import OpenAI

auditi.init(api_key="audi_...", base_url="http://localhost:8000")
auditi.instrument()  # Auto-capture all LLM calls

client = OpenAI()

@trace_agent(name="SmartAssistant")
def main_loop(user_query):
    # This LLM call is auto-captured and nested under "SmartAssistant" trace
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": user_query}]
    )
    return response

main_loop("What time is it?")
```

## User Tracking

To attribute traces to specific users (visible in the Dashboard's User Consumption chart), set `user_id` at init or via context:

```python
# Option 1: Set at init (convenient for auto-instrumentation)
auditi.init(api_key="audi_...", base_url="http://localhost:8000", user_id="user123")
auditi.instrument()

# Option 2: Set context separately (useful for dynamic user_id)
auditi.init(api_key="audi_...", base_url="http://localhost:8000")
auditi.set_context(user_id="user123", session_id="conv456")
auditi.instrument()
```

## FastAPI Middleware

For production backends serving many users, use `AuditiMiddleware` to auto-extract `user_id` from request headers:

```python
from fastapi import FastAPI
from auditi import AuditiMiddleware

app = FastAPI()
auditi.init(api_key="audi_...", base_url="http://localhost:8000")
auditi.instrument()

# Reads X-User-ID and X-Session-ID headers from each request
app.add_middleware(AuditiMiddleware)

# Or use a custom resolver for JWT / auth tokens
app.add_middleware(AuditiMiddleware, user_id_resolver=lambda scope: (decode_jwt(scope), None))
```
