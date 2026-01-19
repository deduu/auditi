# Auditi Python SDK

Official Python SDK for [Auditi](https://auditi.dev) - AI/LLM Evaluation and Monitoring Platform.

## Installation

```bash
pip install auditi
```

Or install from source:

```bash
pip install -e .
```

## Quick Start

### Initialize the SDK

```python
import auditi

# Initialize with your API key (or use localhost for development)
auditi.init(api_key="your-api-key", base_url="https://api.auditi.dev")
```

### Trace an Agent

```python
from auditi import trace_agent, trace_tool, trace_llm

@trace_agent(name="My AI Assistant")
def my_agent(user_message: str, session_id: str = None):
    # Your agent logic here
    response = generate_response(user_message)
    return response

@trace_tool(name="search_database")
def search_database(query: str):
    # Tool implementation
    return results

@trace_llm(name="generate", model="gpt-4")
def generate_response(prompt: str):
    # LLM call
    return response
```

### Custom Evaluators

```python
from auditi import BaseEvaluator, EvaluationResult, TraceInput

class QualityEvaluator(BaseEvaluator):
    def evaluate(self, trace: TraceInput) -> EvaluationResult:
        # Your evaluation logic
        score = calculate_quality_score(trace)
        return EvaluationResult(
            status="pass" if score > 0.7 else "fail",
            score=score,
            reason="Response quality check"
        )

# Use with trace_agent
@trace_agent(name="Assistant", evaluator=QualityEvaluator())
def my_agent(message: str):
    ...
```

## API Reference

### Decorators

- `@trace_agent(name, user_id, evaluator)` - Trace a top-level agent function
- `@trace_tool(name)` - Trace a tool/function call within an agent
- `@trace_llm(name, model)` - Trace an LLM call within an agent

### Types

- `TraceInput` - Complete trace data model
- `SpanInput` - Individual span within a trace
- `EvaluationResult` - Evaluation result data

### Transport

- `SyncHttpTransport` - Default synchronous HTTP transport
- `DebugTransport` - Debug transport that prints to console

## Development

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Format code
black auditi/

# Type check
mypy auditi/
```

## License

MIT License
