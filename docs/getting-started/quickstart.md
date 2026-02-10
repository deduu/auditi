---
sidebar_position: 3
---

# Quickstart

Get up and running with Auditi in less than 5 minutes.

## Prerequisites

1. Ensure the Auditi Platform is running (see [Installation](./installation.md)).
2. Create your account and generate an API key (see [Authentication](./authentication.md)).
3. Install the SDK: `pip install auditi-sdk` (or `pip install -e .` from the `sdk/` directory).
4. Have an OpenAI (or other provider) API key ready.

## 1. Initialize the SDK

In your agent code, import `auditi` and initialize it pointing to your platform instance.

```python
import auditi

# Point to your Auditi backend with your API key
auditi.init(
    api_key="audi_...",
    base_url="http://localhost:8000"
)
```

## 2. Auto-Instrument Your Code

The easiest way to start tracing is to use **auto-instrumentation**. This automatically captures calls from popular libraries like `openai` and `anthropic`.

```python
# Automatically instrument OpenAI, Anthropic, etc.
auditi.instrument()
```

## 3. Run Your Agent

Now just run your LLM code as normal!

```python
from openai import OpenAI

client = OpenAI()

# This call will be automatically traced and sent to Auditi!
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello, how are you?"}]
)

print(response.choices[0].message.content)
```

## 4. View Your Traces

Go to [http://localhost:5173](http://localhost:5173) to see your trace in real-time!

## Next Steps

- Learn about [SDK Integration Patterns](../guides/sdk-integration.md) for more advanced usage
- Explore [Platform Features](../guides/platform-features.md) like evaluation and analytics
- Configure [Cost Tracking & Pricing](../guides/pricing.md) for your models
