---
sidebar_position: 5
---

# Development Guide

## Adding a New Provider

1. Create `sdk/auditi/providers/your_provider.py`:

```python
from .base import BaseProvider

class YourProvider(BaseProvider):
    def name(self) -> str:
        return "your_provider"

    def extract_usage(self, usage):
        # Extract token counts
        pass

    def calculate_cost(self, model, input_tokens, output_tokens):
        # Calculate cost
        pass
```

2. Register in `sdk/auditi/providers/registry.py`:

```python
registry.register(YourProvider())
```

## Adding a Custom Evaluator

```python
from app.evaluators.base import BaseBackendEvaluator, EvalResult

class CustomEvaluator(BaseBackendEvaluator):
    async def evaluate(self, user_input, assistant_output, context=None):
        # Your evaluation logic
        score = calculate_score(assistant_output)

        return EvalResult(
            status="pass" if score > 0.7 else "fail",
            score=score,
            failure_mode="quality_issue" if score < 0.5 else None,
            reason="Custom evaluation result"
        )
```

## Testing

```bash
# Backend tests
cd backend
pytest

# SDK tests
cd sdk
pytest tests/ -v

# Run specific test
pytest tests/test_provider.py -v
```

## Code Quality (SDK)

```bash
cd sdk
black auditi/                 # Format (line-length=100)
ruff auditi/                  # Lint
mypy auditi/                  # Type check (strict mode)
```
