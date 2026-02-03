"""
Auditi Backend - FastAPI Application Entry Point

Modular FastAPI application with separate routers for each domain.
Run with: uvicorn app.main:app --reload --port 8000
"""

import asyncio
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.routers import (
    traces_router,
    conversations_router,
    metrics_router,
    actions_router,
    models_router,
    evaluations_router,
    settings_router,
    llm_connections_router,
    evaluators_router,
    annotations_router,
    analytics_router,
)
from app.routers.evaluation_jobs import router as evaluation_jobs_router
from app.services.eval_worker import run_eval_worker

from fastapi.exceptions import RequestValidationError
from app.errors import validation_exception_handler

import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler.
    Creates database tables on startup with retry logic.
    Starts background evaluation worker.
    """
    retries = 10
    for i in range(retries):
        try:
            Base.metadata.create_all(bind=engine)
            print("✓ Database tables created successfully.")
            break
        except OperationalError as e:
            if i == retries - 1:
                raise e
            print(f"Database not ready, retrying in 2s... ({i+1}/{retries})")
            time.sleep(2)

    # Start background evaluation worker
    eval_worker_task = asyncio.create_task(run_eval_worker(SessionLocal))
    print("✓ Background evaluation worker started.")

    yield

    # Shutdown: cancel background worker
    eval_worker_task.cancel()
    try:
        await eval_worker_task
    except asyncio.CancelledError:
        pass
    print("Application shutting down...")


# Create FastAPI application
app = FastAPI(
    title="Auditi Backend",
    description="AI/LLM Evaluation and Monitoring Platform API",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers with /api/v1 prefix
app.include_router(traces_router, prefix="/api/v1")
app.include_router(conversations_router, prefix="/api/v1")
app.include_router(metrics_router, prefix="/api/v1")
app.include_router(actions_router, prefix="/api/v1")
app.include_router(models_router, prefix="/api/v1")
app.include_router(evaluations_router, prefix="/api/v1")
app.include_router(settings_router, prefix="/api/v1")
app.include_router(llm_connections_router, prefix="/api/v1")
app.include_router(evaluators_router, prefix="/api/v1")
app.include_router(evaluation_jobs_router, prefix="/api/v1")
app.include_router(annotations_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")


@app.get("/")
def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "auditi-backend"}


@app.get("/health")
def health():
    """Health check for container orchestration."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.debug,
    )
