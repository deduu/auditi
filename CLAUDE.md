# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Auditi is an open-source AI Agent Evaluation and Observability Platform. It captures traces from LLM applications, evaluates them (LLM-as-a-judge + human annotation), and provides analytics dashboards. Three main components: a Python SDK, a FastAPI backend, and a React frontend.

## Commands

### Docker (full stack)
```bash
docker-compose up -d          # Start all services (postgres, backend, frontend)
docker-compose logs -f backend  # View backend logs
```

### Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000    # Dev server
# API docs at http://localhost:8000/docs
alembic revision --autogenerate -m "desc"    # Generate DB migration
alembic upgrade head                          # Apply migrations
```

### Frontend (React/Vite)
```bash
cd frontend
npm install
npm run dev       # Dev server on port 5173
npm run build     # Production build
npm run lint      # ESLint
```

### SDK
```bash
cd sdk
pip install -e ".[dev]"       # Install with dev deps
pytest tests/ -v              # Run all tests
pytest tests/test_client.py   # Run single test file
pytest tests/ -k "test_name"  # Run single test by name
black auditi/                 # Format (line-length=100)
ruff auditi/                  # Lint
mypy auditi/                  # Type check (strict mode)
```

## Architecture

```
SDK (Python package)  ──HTTP POST /api/v1/traces/ingest──>  Backend (FastAPI)  ──SQLAlchemy──>  PostgreSQL
                                                                  │
                                                            REST API /api/v1/*
                                                                  │
                                                            Frontend (React/Vite)
```

**Data flow**: User code instrumented with SDK decorators/auto-instrumentation → SDK serializes TraceInput with SpanInputs → HTTP transport to backend → stored in PostgreSQL → background eval_worker evaluates traces → frontend displays via REST API.

### SDK (`sdk/auditi/`)
- **decorators.py** — Core file. Defines `@trace_agent`, `@trace_tool`, `@trace_llm`, `@trace_embedding`, `@trace_retrieval`. Supports sync and async. Handles automatic span nesting via context.
- **instrumentation.py** — Auto-patches OpenAI, Anthropic, Google client libraries via monkey-patching. Call `instrument()` to enable.
- **providers/** — Extract token usage and calculate costs from LLM responses. Auto-detected by response type. Each provider (OpenAI, Anthropic, Google) has its own module.
- **types/api_types.py** — Pydantic models: `TraceInput`, `SpanInput`, `EvaluationResult`. These are the contract between SDK and backend.
- **transport.py** — `SyncHttpTransport` (sends to backend) and `DebugTransport` (prints to console).
- **client.py** — Singleton `AuditiClient`. Initialize with `auditi.init(api_key=..., base_url=...)`.
- Dependencies are intentionally minimal (pydantic + httpx only).

### Backend (`backend/app/`)
- **main.py** — FastAPI entry point. Registers 13 routers under `/api/v1`. Starts background `eval_worker` on lifespan startup.
- **routers/** — One module per resource (traces, conversations, evaluations, evaluators, annotations, datasets, analytics, metrics, actions, models, settings, llm_connections, evaluation_jobs).
- **models/** — SQLAlchemy ORM. Key models: Trace, Span, Conversation, Evaluator, AnnotationQueue, Dataset, ScoreConfig, LLMConnection, Action.
- **schemas/** — Pydantic validation for all API I/O. Each resource has Create/Response/Update variants.
- **services/** — Business logic: `eval_worker.py` (background evaluation loop), `analytics.py`, `action_generator.py`, `llm_provider.py`.
- **config.py** — Pydantic BaseSettings. Reads from env vars: `DATABASE_URL`, `DEBUG`, `CORS_ORIGINS`, `API_PORT`, `API_HOST`.

### Frontend (`frontend/src/`)
- **api/client.js** — Shared HTTP client. All API calls MUST use this (not raw fetch).
- **pages/** — Route-level components (Dashboard, Traces, Conversations, Evaluations, Analytics, Datasets, Annotations, Settings).
- **components/** — Organized by feature domain (traces/, annotations/, analytics/, datasets/, etc.) plus common/ for reusable UI.
- **Path aliases**: `@` → src, `@api`, `@components`, `@hooks`, `@utils`, `@pages`, `@features` (configured in vite.config.js).

## Key Conventions (from .agent/rules.md)

- **Frontend API calls**: Always use the shared `client` from `frontend/src/api/client.js`. Never use `fetch` directly.
- **Frontend styling**: TailwindCSS exclusively. No raw CSS unless complex animations.
- **Backend routing**: Group routes in `app/routers/` by resource. Always use `response_model`, `async def`, and `Depends(get_db)` for DB sessions.
- **Backend validation**: Pydantic schemas required for all API inputs/outputs. Define schemas before implementing logic.
- **SDK decorators**: Primary user interface. Keep dependencies minimal. Must support Python 3.9+.
- **DB migrations**: Always use Alembic for model changes (`alembic revision --autogenerate`).
- **Feature development workflow**: Frontend-first (mock UI) → Backend (schema → model → router) → Integration → Verification.

## Adding a New Backend Endpoint

1. Define Pydantic schemas in `backend/app/schemas/` (Base, Create, Response)
2. Create/update SQLAlchemy model in `backend/app/models/`
3. Run Alembic migration if model changed
4. Create router in `backend/app/routers/` (async, Depends, response_model)
5. Register router in `backend/app/main.py` with `/api/v1` prefix

## Services & Ports

| Service    | Port  | Notes                                    |
|------------|-------|------------------------------------------|
| Frontend   | 5173  | Vite dev server, proxies /api to backend |
| Backend    | 8000  | FastAPI, Swagger at /docs                |
| PostgreSQL | 5434  | Maps to internal 5432, db: audit_db      |

## SDK Code Quality

- Black: line-length=100
- Ruff: E, W, F, I, B, C4, UP rules (line-length=100)
- MyPy: strict mode, Python 3.9 target
- pytest: asyncio_mode=auto, testpaths=["tests"]
