---
description: How to set up the local development environment
---

# Setup Local Environment

This workflow guides you through starting the application locally.

## Prerequisite Check
- [ ] Docker installed?
- [ ] Python 3.10+ installed?
- [ ] Node.js 18+ installed?

## Option 1: Docker Compose (Recommended for Running)
This runs the entire stack. Best for "I just want to see it work".

```bash
docker-compose up --build
```
- Access Frontend: http://localhost:5173
- Access Backend: http://localhost:8000

## Option 2: Local Development (Recommended for Coding)
Run services individually to enable hot-reloading and debuggers.

### 1. Start Database
We still use Docker for the database to avoid messing up your local OS.
```bash
docker-compose up -d postgres
```

### 2. Start Backend
```bash
cd backend
# Create/Activate Virtual Environment (if not done)
python -m venv venv
./venv/Scripts/Activate.ps1 # Windows PowerShell

# Install Dependencies
pip install -r requirements.txt

# Run Server
uvicorn app.main:app --reload --port 8000
```

### 3. Start Frontend
```bash
cd frontend
npm install
npm run dev
```

### 4. Verify Connection
- Open http://localhost:5173
- Check if the "Conversations" list loads (even if empty). If you see a CORS error or Network Error, check backend logs.
