# Auditi

A standardized (frontend-first) dashboard for monitoring, evaluating, and improving AI Agents.

![Dashboard Preview](https://via.placeholder.com/800x400?text=AI+Agent+Monitor+Preview)

## 🚀 Overview

This dashboard provides a unified interface to visualize the performance of your AI agents. It is designed to be **backend-agnostic**, meaning you can plug it into *any* AI system (Python, Node, Go, LangChain, etc.) simply by implementing the standard API protocol.

### Key Features
- **📊 Real-time Metrics**: Track pass rates, latency, and conversation volume.
- **💬 Conversation Inspector**: Drill down into full session logs with turn-by-turn analysis.
- **🎯 Failure Analysis**: Identify top failure modes (Hallucination, Timeout, etc.).
- **⚡ Model Performance**: Compare accuracy and cost across different LLMs (GPT-4, Claude, etc.).
- **✅ Recommended Actions**: Get prioritized suggestions to improve your agent.

---

## 📂 Project Structure

This project is organized into three main packages:

```
├── backend/           # FastAPI backend server
│   ├── app/           # Application code (routes, models, services)
│   ├── Dockerfile     # Container configuration
│   └── requirements.txt
│
├── frontend/          # React + Vite dashboard
│   ├── src/           # Components, pages, services
│   ├── Dockerfile     # Container configuration
│   └── package.json
│
├── sdk/               # Python SDK for tracing
│   ├── auditi/        # Core SDK package
│   ├── examples/      # Usage examples
│   └── pyproject.toml
│
├── docker-compose.yml # Orchestration for all services
└── README.md          # This file
```

---

## 🛠️ Getting Started

### Prerequisites
- Node.js (v18+)
- Python 3.10+
- Docker & Docker Compose (recommended)

### Option 1: Run with Docker Compose (Recommended)

The easiest way to get started is using Docker Compose:

```bash
docker-compose up --build
```

This will start:
- **Backend**: http://localhost:8000
- **Frontend**: http://localhost:5173
- **PostgreSQL**: localhost:5432

### Option 2: Run Locally (Development)

**Terminal 1 (Backend):**
```bash
cd backend
pip install -r requirements.txt
py -m app.main
# Running on http://localhost:8000
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm install
npm run dev
# Running on http://localhost:5173
```

---

## 📦 SDK Installation

The Auditi SDK provides decorators for tracing LLM calls and agent executions.

### Installation

```bash
pip install auditi-sdk
# or install from local source
pip install -e ./sdk
```

### Quick Start

```python
from auditi import trace_llm, trace_agent, AuditiClient

# Initialize the client
client = AuditiClient(base_url="http://localhost:8000")

# Trace an LLM call
@trace_llm(model="gpt-4")
def my_llm_call(prompt: str) -> str:
    # Your LLM logic here
    return response

# Trace an agent execution
@trace_agent(agent_name="my-agent")
def my_agent(query: str) -> str:
    # Your agent logic here
    return result
```

For more examples, see the [SDK documentation](./sdk/README.md).

---

## 🔌 Integration Guide

**Want to use this dashboard with your REAL AI Agent?**

You do not need to rewrite your agent. You only need to:

1.  **Install the SDK**: Add `auditi-sdk` to your project.
2.  **Decorate your functions**: Use `@trace_llm` and `@trace_agent` decorators.
3.  **Configure the endpoint**: Point the SDK to your Auditi backend.

For detailed instructions, see the **[Integration Guide](./INTEGRATION_GUIDE.md)**.

---

## 🔧 Configuration

### Backend

Create a `.env` file in the `backend/` directory:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/auditi
```

### Frontend

Create a `.env` file in the `frontend/` directory:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a PR for any new features or bug fixes.

## 📄 License

MIT