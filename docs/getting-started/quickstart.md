---
sidebar_position: 2
---

# Quickstart

Get up and running with Auditi in less than 5 minutes.

## Prerequisites

1. Ensure the Auditi Platform is running (see [Installation](./installation.md)).
2. Install the SDK: `pip install auditi-sdk`.
3. Have an OpenAI (or other provider) API key ready.

## 1. Initialize the SDK

In your agent code, import `auditi` and initialize it pointing to your platform instance.

```python
import auditi
import os

# Point to your Auditi backend
auditi.init(
    api_key="your-api-key-if-auth-enabled",
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

## 4. View Verification

Go to [http://localhost:3000](http://localhost:3000) to see your trace in real-time!
