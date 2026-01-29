# Project Rules: Auditi

These rules define the standard practices for the Auditi project. All agents and developers should follow these constraints to ensure consistency.

## 1. Architecture Overview
- **Frontend**: React (Vite) + TailwindCSS. Located in `frontend/`.
- **Backend**: FastAPI (Python) + PostgreSQL (Asyncpg/SQLAlchemy). Located in `backend/`.
- **SDK**: Python package. Located in `sdk/`.
- **Database**: PostgreSQL is the source of truth.

## 2. Coding Standards

### Backend (`backend/`)
- **Framework**: Use `FastAPI`.
- **Database**: Use `SQLAlchemy` 1.4+ with `asyncio`.
- **Type Hints**: strict Python type hints are required. Use `Pydantic` schemas for all API Inputs/Outputs.
- **Routing**: Group routes in `app/routers/` by resource name.
- **Dependency Injection**: Use `Depends` for database sessions: `db: AsyncSession = Depends(get_db)`.
- **Error Handling**: Raise `HTTPException` with clear detail messages.

### Frontend (`frontend/`)
- **Framework**: React 18+ with Vite.
- **Styling**: `TailwindCSS` exclusively. Avoid raw CSS/SCSS unless for complex animations.
- **State Management**: Use React Hooks (`useState`, `useEffect`, or custom hooks).
- **API Calls**: Use the pre-configured `axios` instance (or similar) pointing to `VITE_API_BASE_URL`.
- **Components**: Functional components only.

### SDK (`sdk/`)
- **Decorators**: Primary interface is decorators (`@trace_llm`, `@trace_agent`).
- **Dependencies**: Keep external dependencies minimal to avoid bloating user projects.
- **Compatibility**: Must work with standard Python 3.10+.

## 3. Development Process
- **Frontend First**: When building a feature, design the UI first to understand the data requirements.
- **API Contract**: Define the Pydantic schema in the backend before implementing the logic.
- **Migrations**: Always generate migrations for DB model changes using Alembic (`alembic revision --autogenerate`).
