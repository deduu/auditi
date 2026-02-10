---
sidebar_position: 4
---

# Deployment

## Production with Docker

```bash
# Build and run
docker-compose -f docker-compose.yml up -d

# Scale services
docker-compose up -d --scale backend=3

# View logs
docker-compose logs -f backend
```

## Manual Deployment

### Backend

```bash
cd backend
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

### Frontend

```bash
cd frontend
npm run build
# Serve dist/ with nginx or other web server
```

## Environment Variables

See [Installation](../getting-started/installation.md) for required environment variables (`DATABASE_URL`, `ENCRYPTION_KEY`, `JWT_SECRET`, etc.).

## Services & Ports

| Service    | Port  | Notes                                    |
|------------|-------|------------------------------------------|
| Frontend   | 5173  | Vite dev server, proxies /api to backend |
| Backend    | 8000  | FastAPI, Swagger at /docs                |
| PostgreSQL | 5434  | Maps to internal 5432, db: audit_db      |
