---
name: Add Backend Endpoint
description: Checklist and guide for adding a new API endpoint to the FastAPI backend
---

# Add Backend Endpoint Skill

Follow this checklist to add a new endpoint, ensuring all layers (Schema, Model, CRUD, Router) are covered.

## Checklist

### 1. Define Pydantic Schemas (`backend/app/schemas/`)
Create or update a schema file. You need:
- `BaseSchema`: Common fields.
- `CreateSchema`: Fields required for creation.
- `ResponseSchema`: Fields returned to the client (include `id`, `created_at`).

### 2. Update Database Model (`backend/app/models/`)
If this endpoint involves new data, define the SQLAlchemy model.
- **Action**: Run `database_migration` skill if you modify models.

### 3. Service/CRUD Layer (`backend/app/services/` or directly in Router)
For simple logic, you can put it in the router. for complex logic, create a service.

### 4. Create/Update Router (`backend/app/routers/`)
- **Path Operations**: Use `@router.get`, `@router.post`, etc.
- **Response Model**: Always specify `response_model`.
- **Async**: Use `async def`.
- **DB Session**: Inject dependencies: `db: AsyncSession = Depends(get_db)`.

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.item import ItemResponse

router = APIRouter()

@router.get("/items", response_model=list[ItemResponse])
async def read_items(db: AsyncSession = Depends(get_db)):
    # ... logic
    return items
```

### 5. Register Router (`backend/app/main.py`)
If this is a new router file, include it in `main.py`:

```python
from app.routers import new_router
app.include_router(new_router.router, prefix="/api/v1/resource", tags=["Resource"])
```
