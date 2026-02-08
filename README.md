<table><tr>
  <td><img src="assets/logo.png" alt="Auditi" width="140"></td>
  <td>
    <h1>auditi</h1>
    <p><b>AI Agent Evaluation & Observability Platform</b></p>
    <p>Automatic trace capture · LLM-as-a-judge evaluation · Human annotation · Analytics dashboards</p>
  </td>
</tr></table>

<p>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <a href="https://www.python.org/downloads/"><img src="https://img.shields.io/badge/python-3.8+-blue.svg" alt="Python"></a>
  <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-0.104+-green.svg" alt="FastAPI"></a>
  <a href="https://reactjs.org/"><img src="https://img.shields.io/badge/React-18+-blue.svg" alt="React"></a>
  <a href="https://github.com/deduu/auditi/discussions"><img src="https://img.shields.io/badge/discussions-join%20us-blue?logo=github" alt="Discussions"></a>
</p>

## Features

### Core Capabilities

- **Automatic Trace Capture**: Instrument your AI agents with simple decorators or auto-instrumentation to capture every interaction
- **LLM-as-a-Judge Evaluation**: Automated evaluation of agent performance using configurable LLM evaluators
- **Human Annotation Workflows**: Annotation queues with customizable score configs for human-in-the-loop evaluation
- **Advanced Analytics**: Comprehensive dashboards with metrics, trends, correlations, and anomaly detection
- **Dataset Management**: Create reusable datasets from annotations for fine-tuning and evaluation
- **Multi-Provider Support**: Works with OpenAI, Anthropic, Google Gemini, and OpenAI-compatible APIs
- **Cost Tracking**: Automatic cost calculation with provider-specific pricing. Provider pricing can be updated via Pricing API
- **Failure Mode Analysis**: Identify patterns and generate actionable recommendations

### SDK Features

- **Simple Integration**: Minimal code changes with Python decorators or auto-instrumentation
- **Flexible Tracing**: Support for agents, tools, LLM calls, embeddings, and retrieval operations
- **Standalone & Nested**: Trace individual calls or complex multi-step workflows
- **Async Support**: Full support for async/await patterns
- **Provider Abstraction**: Automatic detection and handling of different LLM providers
- **Custom Evaluators**: Build your own evaluation logic

## Documentation

For detailed documentation, see the [docs/](docs/) folder:

- [Introduction](docs/intro.md)
- [Installation Guide](docs/getting-started/installation.md)
- [Quickstart](docs/getting-started/quickstart.md)
- [SDK Integration Patterns](docs/guides/sdk-integration.md)

## Quick Start

### Installation

#### Using Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/deduu/auditi.git
cd auditi

# Start all services
docker-compose up -d

# Access the platform
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

#### Manual Installation

**Backend:**

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the backend
uvicorn app.main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend

# Install dependencies
npm install

# Run the frontend
npm run dev
```

**SDK:**

```bash
cd sdk

# Create and activate virtual environment (if not using backend's venv)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install SDK in development mode
pip install -e .
```

### SDK Usage

#### Method 1: Auto-Instrumentation (Recommended)

The easiest way to start tracing is with auto-instrumentation, which automatically captures calls from popular libraries:

```python
import auditi
from openai import OpenAI

# Initialize the SDK - pointing to your Auditi backend
auditi.init(base_url="http://localhost:8000")

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

**User Tracking:** To attribute traces to specific users (visible in the Dashboard's User Consumption chart), set `user_id` at init or via context:

```python
# Option 1: Set at init (convenient for auto-instrumentation)
auditi.init(base_url="http://localhost:8000", user_id="user123")
auditi.instrument()

# Option 2: Set context separately (useful for dynamic user_id)
auditi.init(base_url="http://localhost:8000")
auditi.set_context(user_id="user123", session_id="conv456")
auditi.instrument()
```

**FastAPI Middleware:** For production backends serving many users, use `AuditiMiddleware` to auto-extract `user_id` from request headers:

```python
from fastapi import FastAPI
from auditi import AuditiMiddleware

app = FastAPI()
auditi.init(base_url="http://localhost:8000")
auditi.instrument()

# Reads X-User-ID and X-Session-ID headers from each request
app.add_middleware(AuditiMiddleware)

# Or use a custom resolver for JWT / auth tokens
app.add_middleware(AuditiMiddleware, user_id_resolver=lambda scope: (decode_jwt(scope), None))
```

#### Method 2: Decorators (Manual Control)

Use decorators for more granular control over tracing:

```python
import auditi
from auditi import trace_agent, trace_tool, trace_llm

# Initialize the SDK
auditi.init(base_url="http://localhost:8000")

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

#### Method 3: Agent with Tools

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

#### Method 4: RAG Pipeline

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

#### Method 5: Mixed Mode

Combine auto-instrumentation with decorators for maximum flexibility:

```python
import auditi
from auditi import trace_agent
from openai import OpenAI

auditi.init(base_url="http://localhost:8000")
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

## Platform Features

### Setup Wizard

First-time setup guides you through:

1. **LLM Connection**: Configure your OpenAI, Anthropic, or other API keys
2. **Evaluator Setup**: Choose between LLM-as-a-judge or human annotation
3. **Custom Prompts**: Customize evaluation criteria and prompts
4. **Schema Configuration**: Define custom evaluation schemas

### Evaluation

**LLM-as-a-Judge:**

- Automatic evaluation of traces using configurable LLM evaluators
- Granular span-level evaluation + overall trace evaluation
- Custom output schemas with flexible validation
- Support for multiple providers (OpenAI, Anthropic, Google)
- Batch evaluation with filtering

**Human Annotation:**

- Create annotation queues with custom score configurations
- Support for categorical, numerical, and binary scores
- FIFO processing with concurrency safety
- Export annotations for fine-tuning (JSONL, CSV, Parquet)
- Publish completed queues as versioned datasets

### Analytics & Insights

**Dashboard:**

- Real-time KPIs: total traces, pass rate, avg score, cost
- Breakdown views: traces by name, model costs, score evaluations
- Time-series trends with configurable time ranges
- Model comparison and performance metrics

**Advanced Analytics:**

- Score distribution analysis
- Failure mode detection and trending
- Correlation analysis between metrics
- Cost forecasting based on historical data
- Anomaly detection using statistical methods
- Tool/function call analytics

**Failure Analysis:**

- Automatic failure mode categorization
- Time-series trending of failures
- Failure breakdown by model
- Actionable insights and recommendations

### Data Management

**Conversations:**

- Group traces by conversation/session
- Multi-turn conversation tracking
- Conversation-level analytics

**Datasets:**

- Create datasets from annotation queues
- Manual dataset creation and management
- Version control for datasets
- Export in multiple formats (JSONL, CSV, Parquet)
- Link items back to source traces/spans

**Actions:**

- Auto-generated improvement recommendations
- Status tracking (open, in_progress, completed, dismissed)
- Manual resolution workflows

## Architecture

> **SDK** (Python) → HTTP POST → **Backend** (FastAPI/PostgreSQL) → REST API → **Frontend** (React/Vite)
>
> See the full project structure in the [repository tree](https://github.com/deduu/auditi) or read the [architecture docs](docs/).

## Configuration

### Environment Variables

**Backend (.env):**

```bash
DATABASE_URL=postgresql://user:pass@localhost/auditi
CORS_ORIGINS=http://localhost:3000
```

**Evaluation Configuration (eval_config.json):**

```json
{
  "enabled": true,
  "llm": {
    "provider": "openai",
    "model": "gpt-4",
    "temperature": 0.1
  },
  "prompts": {
    "system": "You are an expert AI evaluator...",
    "user_template": "Evaluate this interaction:\nUser: {user_input}\nAssistant: {assistant_output}"
  }
}
```

## Cost Tracking & Pricing

Auditi automatically calculates costs for every LLM call. Pricing is resolved using a 3-tier priority system:

1. **SDK user overrides** (highest priority) — set via `configure_pricing()`
2. **Remote pricing from backend** — fetched from `GET /api/v1/pricing`, managed via the Pricing API
3. **Hardcoded provider defaults** (lowest priority) — built into the SDK

### Default Supported Models

Pricing is in USD per 1M tokens (input, output).

**OpenAI:**

| Model | Input | Output |
|-------|-------|--------|
| gpt-4o | $2.50 | $10.00 |
| gpt-4o-mini | $0.15 | $0.60 |
| gpt-4-turbo | $10.00 | $30.00 |
| gpt-4 | $30.00 | $60.00 |
| gpt-3.5-turbo | $0.50 | $1.50 |
| o1 | $15.00 | $60.00 |
| o1-mini | $3.00 | $12.00 |

**Anthropic:**

| Model | Input | Output |
|-------|-------|--------|
| claude-opus-4-5-20251101 | $15.00 | $75.00 |
| claude-sonnet-4-5-20250929 | $3.00 | $15.00 |
| claude-haiku-4-5-20251001 | $0.80 | $4.00 |
| claude-3-5-sonnet-20241022 | $3.00 | $15.00 |
| claude-3-opus-20240229 | $15.00 | $75.00 |
| claude-3-haiku-20240307 | $0.25 | $1.25 |

**Google Gemini:**

| Model | Input | Output |
|-------|-------|--------|
| gemini-2.0-flash | $0.10 | $0.40 |
| gemini-1.5-pro | $1.25 | $5.00 |
| gemini-1.5-flash | $0.075 | $0.30 |
| gemini-1.5-flash-8b | $0.0375 | $0.15 |
| gemini-1.0-pro | $0.50 | $1.50 |

### Option 1: SDK Override (Per-Application)

Use `configure_pricing()` to override pricing for specific models in your application. This takes highest priority.

```python
import auditi

auditi.init(base_url="http://localhost:8000")

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

### Option 2: Backend Pricing API (Central Management)

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

### Option 3: Hardcoded Defaults (Zero Configuration)

If no overrides or remote pricing are configured, the SDK uses built-in defaults for all supported models. Unknown models fall back to conservative defaults per provider (e.g., GPT-4 Turbo pricing for unknown OpenAI models).

## Database Models

### Core Models

- **Conversation**: Multi-turn conversation sessions
- **Trace**: Individual agent interactions
- **Span**: Internal operations (LLM calls, tools, etc.)
- **Evaluator**: Custom evaluator configurations
- **LLMConnection**: API connection settings
- **ModelPricing**: Per-model pricing for cost calculation (seeded with defaults on first run)

### Annotation Models

- **ScoreConfig**: Score configuration definitions
- **AnnotationQueue**: Annotation queue management
- **AnnotationQueueItem**: Items in queues
- **Annotation**: Human-provided scores

### Dataset Models

- **Dataset**: Named dataset collections
- **DatasetItem**: Individual dataset entries

## API Reference

Full interactive API documentation is available at [localhost:8000/docs](http://localhost:8000/docs) (Swagger UI) when the backend is running.

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

## Deployment

### Production with Docker

```bash
# Build and run
docker-compose -f docker-compose.yml up -d

# Scale services
docker-compose up -d --scale backend=3

# View logs
docker-compose logs -f backend
```

### Manual Deployment

**Backend:**

```bash
cd backend
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

**Frontend:**

```bash
cd frontend
npm run build
# Serve dist/ with nginx or other web server
```

## Development

### Adding a New Provider

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

### Adding a Custom Evaluator

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

## Community

- **GitHub Discussions**: Ask questions, share ideas, and connect with other users in [Discussions](https://github.com/deduu/auditi/discussions)
- **Issues**: Report bugs or request features via [GitHub Issues](https://github.com/deduu/auditi/issues)

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- FastAPI for the excellent web framework
- React and Vite for the frontend stack
- OpenAI, Anthropic, and Google for LLM APIs
- The open-source community

## Roadmap

- [ ] Real-time streaming support
- [ ] More LLM provider integrations
- [ ] Advanced visualization options
- [ ] Webhook integrations
- [ ] Multi-user authentication
- [ ] Cloud deployment templates
- [ ] Model fine-tuning workflows
- [ ] A/B testing framework

---
