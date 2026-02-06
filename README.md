# Auditi

**AI Agent Evaluation and Observability Platform**

Auditi is a comprehensive platform for evaluating, monitoring, and improving AI agents and LLM applications. It provides automatic trace capture, LLM-as-a-judge evaluation, human annotation workflows, and detailed analytics to help you build better AI systems.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)

## Features

### Core Capabilities

- **Automatic Trace Capture**: Instrument your AI agents with simple decorators or auto-instrumentation to capture every interaction
- **LLM-as-a-Judge Evaluation**: Automated evaluation of agent performance using configurable LLM evaluators
- **Human Annotation Workflows**: Annotation queues with customizable score configs for human-in-the-loop evaluation
- **Advanced Analytics**: Comprehensive dashboards with metrics, trends, correlations, and anomaly detection
- **Dataset Management**: Create reusable datasets from annotations for fine-tuning and evaluation
- **Multi-Provider Support**: Works with OpenAI, Anthropic, Google Gemini, and OpenAI-compatible APIs
- **Cost Tracking**: Automatic cost calculation with dynamic, remotely-updated pricing
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

```
auditi/
├── backend/           # FastAPI backend
│   ├── app/
│   │   ├── models/    # SQLAlchemy models
│   │   ├── routers/   # API endpoints
│   │   ├── schemas/   # Pydantic schemas
│   │   ├── services/  # Business logic
│   │   └── evaluators/# Evaluation logic
│   └── requirements.txt
├── frontend/          # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── api/
│   └── package.json
├── sdk/              # Python SDK
│   ├── auditi/
│   │   ├── client.py
│   │   ├── decorators.py
│   │   ├── instrumentation.py  # Auto-instrumentation
│   │   ├── providers/  # LLM provider abstraction
│   │   └── types/
│   ├── examples/
│   └── tests/
├── docs/             # Documentation
└── docker-compose.yml
```

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

## API Endpoints

### Traces
- `POST /api/traces/ingest` - Ingest traces
- `GET /api/traces` - List traces
- `GET /api/traces/{id}` - Get trace details
- `DELETE /api/traces` - Bulk delete

### Conversations
- `GET /api/conversations` - List conversations
- `GET /api/conversations/{id}` - Get conversation details

### Evaluations
- `POST /api/evaluation-jobs` - Run batch evaluation
- `GET /api/evaluations` - Get evaluation stats
- `GET /api/evaluations/failure-modes` - Failure analysis

### Annotations
- `GET /api/score-configs` - List score configs
- `POST /api/score-configs` - Create score config
- `GET /api/annotation-queues` - List queues
- `POST /api/annotation-queues/{id}/items` - Add items to queue
- `GET /api/annotation-queues/{id}/next` - Get next item
- `POST /api/annotation-queues/items/{id}/complete` - Complete item

### Datasets
- `GET /api/datasets` - List datasets
- `POST /api/datasets` - Create dataset
- `POST /api/datasets/publish-from-queue` - Publish queue to dataset
- `GET /api/datasets/{id}/export` - Export dataset

### Pricing
- `GET /api/v1/pricing` - Get all model pricing (used by SDK for auto-updated costs)
- `GET /api/v1/pricing/list` - List pricing entries with optional `?provider=` filter
- `POST /api/v1/pricing` - Create or update a single model's pricing
- `POST /api/v1/pricing/bulk` - Bulk create/update pricing entries
- `DELETE /api/v1/pricing/{id}` - Delete a pricing entry

### Analytics
- `GET /api/analytics/dashboard-kpis` - Dashboard metrics
- `GET /api/analytics/trends` - Time-series trends
- `GET /api/analytics/correlations` - Correlation analysis
- `GET /api/analytics/insights` - AI-generated insights

[Full API documentation](http://localhost:8000/docs)

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

## Contact

- **Repository**: [https://github.com/deduu/auditi](https://github.com/deduu/auditi)
- **Issues**: [https://github.com/deduu/auditi/issues](https://github.com/deduu/auditi/issues)

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
