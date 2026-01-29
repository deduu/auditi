---
name: Database Migration
description: How to safely modify the database schema using Alembic
---

# Database Migration Skill

This skill guides you through the process of modifying the database schema and applying changes safely.

## Prerequisites
- Backend container must be running or `postgres` service must be accessible.
- If running locally, ensure `DATABASE_URL` is set in `.env`.

## Steps

### 1. Modify the Database Model
Edit the model file in `backend/app/models/`.

Example (adding a column):
```python
# backend/app/models/evaluator.py
class Evaluator(Base):
    # ... existing fields
    new_column = Column(String, nullable=True)
```

### 2. Generate Migration Script
Run the following command from the `backend/` directory:

```bash
# If using Docker (Recommended)
docker-compose run --rm backend alembic revision --autogenerate -m "description of change"

# If running locally
cd backend
alembic revision --autogenerate -m "description of change"
```

### 3. Verify the Migration Script
Open the newly created file in `backend/alembic/versions/`.
- Check `upgrade()` function: Does it add the column/table?
- Check `downgrade()` function: Does it remove it?
- **CRITICAL**: Ensure no existing tables are being dropped accidentally. If Alembic doesn't see a table, it might try to drop it.

### 4. Apply the Migration
```bash
# Docker
docker-compose run --rm backend alembic upgrade head

# Local
alembic upgrade head
```

## Common Issues
- **Connection Refused**: Check if `postgres` container is healthy (`docker ps`).
- **Target database is not up to date**: Run `alembic upgrade head` before creating a new revision.
- **Multiple heads**: If two branches created migrations, you might need to merge heads.
