<table><tr>
  <td><img src="assets/logo.png" alt="Auditi" width="140"></td>
  <td>
    <h1>Auditi</h1>
    <p><b>AI Agent Evaluation and Observability Platform</b></p>
  </td>
</tr></table>

Auditi is a comprehensive platform for evaluating, monitoring, and improving AI agents and LLM applications. It provides automatic trace capture, LLM-as-a-judge evaluation, human annotation workflows, and detailed analytics to help you build better AI systems.

<p>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <a href="https://www.python.org/downloads/"><img src="https://img.shields.io/badge/python-3.8+-blue.svg" alt="Python"></a>
  <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-0.104+-green.svg" alt="FastAPI"></a>
  <a href="https://reactjs.org/"><img src="https://img.shields.io/badge/React-18+-blue.svg" alt="React"></a>
  <a href="https://github.com/deduu/auditi/discussions"><img src="https://img.shields.io/badge/discussions-join%20us-blue?logo=github" alt="Discussions"></a>
  <a href="https://github.com/deduu/auditi/actions/workflows/ci.yml"><img src="https://github.com/deduu/auditi/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
</p>

## Demo

<video src="https://github.com/user-attachments/assets/394c46d0-c6a9-4f4c-80bc-818a086a4f78" width="100%"></video>

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

### Getting Started
- [Introduction](docs/intro.md)
- [Installation Guide](docs/getting-started/installation.md)
- [Authentication](docs/getting-started/authentication.md)
- [Quickstart](docs/getting-started/quickstart.md)

### Guides
- [SDK Integration Patterns](docs/guides/sdk-integration.md)
- [Platform Features](docs/guides/platform-features.md)
- [Cost Tracking & Pricing](docs/guides/pricing.md)
- [Deployment](docs/guides/deployment.md)
- [Development Guide](docs/guides/development.md)

## Quick Start

### 1. Install & Run

```bash
# Clone the repository
git clone https://github.com/deduu/auditi.git
cd auditi

# Generate required keys
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Create a .env file with both keys
echo "ENCRYPTION_KEY=<paste-encryption-key-here>" > .env
echo "JWT_SECRET=<paste-jwt-secret-here>" >> .env

# Start all services
docker-compose up -d
```

> **Important:** `ENCRYPTION_KEY` encrypts LLM API keys in the database. `JWT_SECRET` signs user session tokens. Without these, ephemeral keys are generated on each restart. See [Installation Guide](docs/getting-started/installation.md) for details.

### 2. Authenticate

1. Open `http://localhost:5173` and create your admin account
2. Go to **Settings > API Keys** and create an API key
3. Copy the key (shown only once) — you'll need it for the SDK

See [Authentication](docs/getting-started/authentication.md) for details.

### 3. Instrument Your Code

```python
import auditi
from openai import OpenAI

# Initialize with your API key
auditi.init(api_key="audi_...", base_url="http://localhost:8000")

# Auto-instrument supported libraries
auditi.instrument()

# All LLM calls are now automatically traced!
client = OpenAI()
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "What is the capital of France?"}]
)
print(response.choices[0].message.content)
```

For more integration patterns (decorators, agents with tools, RAG pipelines, mixed mode), see [SDK Integration Patterns](docs/guides/sdk-integration.md).

## Examples

Explore the [SDK examples](sdk/examples/) for complete integration patterns:

- [Basic Integration](sdk/examples/01_basic_integration.py) — Decorators for agents, tools, and LLM calls
- [FastAPI Integration](sdk/examples/02_fastapi_integration.py) — Production agent with FastAPI
- [LangChain Integration](sdk/examples/03_langchain_integration.py) — RAG pipeline tracing
- [LLM Traces](sdk/examples/04_simple_llm_traces.py) — Multi-provider LLM tracing
- [Embedding Traces](sdk/examples/05_embedding_traces.py) — Vector search and embedding tracing

## Architecture

> **SDK** (Python) → HTTP POST → **Backend** (FastAPI/PostgreSQL) → REST API → **Frontend** (React/Vite)
>
> See the full project structure in the [repository tree](https://github.com/deduu/auditi) or read the [architecture docs](docs/).

## Configuration

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `ENCRYPTION_KEY` | Fernet key for encrypting LLM API keys |
| `JWT_SECRET` | Secret for signing JWT session tokens |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) |

See [Installation Guide](docs/getting-started/installation.md) for full configuration details.

## API Reference

Full interactive API documentation is available at [localhost:8000/docs](http://localhost:8000/docs) (Swagger UI) when the backend is running.

## Testing

```bash
# Backend tests
cd backend && pytest

# SDK tests
cd sdk && pytest tests/ -v
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
- [x] Multi-user authentication
- [ ] Cloud deployment templates
- [ ] Model fine-tuning workflows
- [ ] A/B testing framework

## Enterprise

For teams that need advanced security, compliance, and support:

- **SSO/SAML** — Connect your identity provider
- **Advanced RBAC** — Granular permissions and workspace isolation
- **Audit logging** — Full activity trail for compliance
- **Data retention policies** — Configurable cleanup and archival
- **Priority support** — Dedicated support with SLA
- **Custom integrations** — Tailored to your stack

**Contact:** auditi.ai.team@gmail.com

---
