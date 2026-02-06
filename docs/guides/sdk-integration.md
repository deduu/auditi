---
sidebar_position: 1
---

# SDK Integration Patterns

Auditi provides flexible ways to integrate with your existing codebase.

## Method 1: Auto-Instrumentation (Recommended)

For most use cases, especially when using standard libraries like `openai`, `anthropic`, or `langchain`, auto-instrumentation is the cleanest approach.

```python
import auditi

auditi.init()
auditi.instrument() # patches supported libraries
```

### Supported Libraries
- OpenAI (`openai>=1.0.0`)
- Anthropic (`anthropic>=0.3.0`)
- *More coming soon*

## Method 2: Decorators (Manual Control)

If you need more granular control or are tracing custom functions that aren't LLM calls (e.g., tools, agents), use decorators.

### Tracing an Agent

```python
from auditi import trace_agent

@trace_agent(name="MyCustomAgent")
def run_agent(input_text):
    # Your agent logic here
    return "Agent response"
```

### Tracing a Tool

```python
from auditi import trace_tool

@trace_tool(name="Calculator")
def add(a, b):
    return a + b
```

## Method 3: Mixed Mode

You can mix auto-instrumentation with decorators. For example, use `auditi.instrument()` to catch all LLM calls, but use `@trace_agent` to group them into a logical agent execution.

```python
import auditi
from auditi import trace_agent
from openai import OpenAI

auditi.init()
auditi.instrument()

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
