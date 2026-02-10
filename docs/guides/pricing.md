---
sidebar_position: 2
---

# Cost Tracking & Pricing

Auditi automatically calculates costs for every LLM call. Pricing is resolved using a 3-tier priority system:

1. **SDK user overrides** (highest priority) — set via `configure_pricing()`
2. **Remote pricing from backend** — fetched from `GET /api/v1/pricing`, managed via the Pricing API
3. **Hardcoded provider defaults** (lowest priority) — built into the SDK

## Default Supported Models

Pricing is in USD per 1M tokens (input, output).

### OpenAI

| Model | Input | Output |
|-------|-------|--------|
| gpt-4o | $2.50 | $10.00 |
| gpt-4o-mini | $0.15 | $0.60 |
| gpt-4-turbo | $10.00 | $30.00 |
| gpt-4 | $30.00 | $60.00 |
| gpt-3.5-turbo | $0.50 | $1.50 |
| o1 | $15.00 | $60.00 |
| o1-mini | $3.00 | $12.00 |

### Anthropic

| Model | Input | Output |
|-------|-------|--------|
| claude-opus-4-5-20251101 | $15.00 | $75.00 |
| claude-sonnet-4-5-20250929 | $3.00 | $15.00 |
| claude-haiku-4-5-20251001 | $0.80 | $4.00 |
| claude-3-5-sonnet-20241022 | $3.00 | $15.00 |
| claude-3-opus-20240229 | $15.00 | $75.00 |
| claude-3-haiku-20240307 | $0.25 | $1.25 |

### Google Gemini

| Model | Input | Output |
|-------|-------|--------|
| gemini-2.0-flash | $0.10 | $0.40 |
| gemini-1.5-pro | $1.25 | $5.00 |
| gemini-1.5-flash | $0.075 | $0.30 |
| gemini-1.5-flash-8b | $0.0375 | $0.15 |
| gemini-1.0-pro | $0.50 | $1.50 |

## Option 1: SDK Override (Per-Application)

Use `configure_pricing()` to override pricing for specific models in your application. This takes highest priority.

```python
import auditi

auditi.init(api_key="audi_...", base_url="http://localhost:8000")

# Override pricing for specific models (input, output) per 1M tokens
auditi.configure_pricing({
    "openai": {
        "gpt-4o": (2.50, 10.00),
        "gpt-4o-mini": (0.15, 0.60),
    },
    "anthropic": {
        "claude-3-5-sonnet-20241022": (3.00, 15.00),
    },
    "google": {
        "gemini-2.0-flash": (0.10, 0.40),
    },
})

# All subsequent LLM calls will use your overridden pricing
auditi.instrument()
```

## Option 2: Backend Pricing API (Central Management)

Manage pricing centrally through the backend API. The SDK automatically fetches remote pricing from the backend.

**Update a single model's pricing:**

```bash
curl -X POST http://localhost:8000/api/v1/pricing \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4o",
    "input_price": 2.50,
    "output_price": 10.00
  }'
```

**Bulk update multiple models:**

```bash
curl -X POST http://localhost:8000/api/v1/pricing/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"provider": "openai", "model": "gpt-4o", "input_price": 2.50, "output_price": 10.00},
      {"provider": "anthropic", "model": "claude-3-5-sonnet-20241022", "input_price": 3.00, "output_price": 15.00},
      {"provider": "google", "model": "gemini-2.0-flash", "input_price": 0.10, "output_price": 0.40}
    ]
  }'
```

**List pricing by provider:**

```bash
curl http://localhost:8000/api/v1/pricing/list?provider=openai
```

## Option 3: Hardcoded Defaults (Zero Configuration)

If no overrides or remote pricing are configured, the SDK uses built-in defaults for all supported models. Unknown models fall back to conservative defaults per provider (e.g., GPT-4 Turbo pricing for unknown OpenAI models).
