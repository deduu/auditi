# Copyright (c) 2026 Auditi Contributors
#
# MIT License
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

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
    datasets_router,
    pricing_router,
    auth_router,
    api_keys_router,
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

logger = logging.getLogger(__name__)


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
            logger.info("Database tables created successfully.")

            # Seed default model pricing on first run
            from app.routers.pricing import seed_default_pricing

            db = SessionLocal()
            try:
                seed_default_pricing(db)
            finally:
                db.close()

            break
        except OperationalError as e:
            if i == retries - 1:
                raise e
            logger.warning("Database not ready, retrying in 2s... (%d/%d)", i + 1, retries)
            time.sleep(2)

    # Start background evaluation worker
    eval_worker_task = asyncio.create_task(run_eval_worker(SessionLocal))
    logger.info("Background evaluation worker started.")

    yield

    # Shutdown: cancel background worker
    eval_worker_task.cancel()
    try:
        await eval_worker_task
    except asyncio.CancelledError:
        pass
    logger.info("Application shutting down...")


# Create FastAPI application
app = FastAPI(
    title="Auditi Backend",
    description="AI/LLM Evaluation and Monitoring Platform API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Register routers with /api/v1 prefix
app.include_router(auth_router, prefix="/api/v1")
app.include_router(api_keys_router, prefix="/api/v1")
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
app.include_router(datasets_router, prefix="/api/v1")
app.include_router(pricing_router, prefix="/api/v1")


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
