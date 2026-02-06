"""
Pricing endpoints for LLM model cost data.

- GET /pricing          → SDK endpoint (flat dict format for remote fetching)
- GET /pricing/list     → Admin: list all pricing entries
- POST /pricing         → Admin: create or update a single entry
- POST /pricing/bulk    → Admin: bulk create/update
- DELETE /pricing/{id}  → Admin: delete an entry
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.model_pricing import ModelPricing
from app.schemas.pricing import (
    ModelPricingCreate,
    ModelPricingBulkCreate,
    ModelPricingResponse,
)

router = APIRouter(
    prefix="/pricing",
    tags=["pricing"],
    responses={404: {"description": "Not found"}},
)


# ---------------------------------------------------------------------------
# SDK endpoint – consumed by auditi SDK's PricingManager
# ---------------------------------------------------------------------------

@router.get("")
def get_pricing_for_sdk(
    db: Session = Depends(get_db),
):
    """
    Return all model pricing grouped by provider.

    Response format consumed by the SDK:
    {
        "openai": { "gpt-4o": [2.50, 10.00], ... },
        "anthropic": { "claude-3-5-sonnet-20241022": [3.00, 15.00], ... },
        "google": { "gemini-1.5-pro": [1.25, 5.00], ... }
    }
    """
    rows = db.query(ModelPricing).all()

    result: dict[str, dict[str, list[float]]] = {}
    for row in rows:
        if row.provider not in result:
            result[row.provider] = {}
        result[row.provider][row.model] = [row.input_price, row.output_price]

    return result


# ---------------------------------------------------------------------------
# Admin CRUD – for managing pricing via the dashboard
# ---------------------------------------------------------------------------

@router.get("/list", response_model=list[ModelPricingResponse])
def list_pricing(
    provider: str | None = Query(None, description="Filter by provider"),
    db: Session = Depends(get_db),
):
    """List all pricing entries, optionally filtered by provider."""
    query = db.query(ModelPricing)
    if provider:
        query = query.filter(ModelPricing.provider == provider.lower())
    return query.order_by(ModelPricing.provider, ModelPricing.model).all()


@router.post("", response_model=ModelPricingResponse, status_code=201)
def create_or_update_pricing(
    body: ModelPricingCreate,
    db: Session = Depends(get_db),
):
    """Create or update pricing for a single model (upsert by provider+model)."""
    existing = (
        db.query(ModelPricing)
        .filter(
            ModelPricing.provider == body.provider.lower(),
            ModelPricing.model == body.model,
        )
        .first()
    )

    if existing:
        existing.input_price = body.input_price
        existing.output_price = body.output_price
        db.commit()
        db.refresh(existing)
        return existing

    entry = ModelPricing(
        id=str(uuid.uuid4()),
        provider=body.provider.lower(),
        model=body.model,
        input_price=body.input_price,
        output_price=body.output_price,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.post("/bulk", status_code=201)
def bulk_create_or_update_pricing(
    body: ModelPricingBulkCreate,
    db: Session = Depends(get_db),
):
    """Bulk create/update pricing entries."""
    created = 0
    updated = 0

    for item in body.items:
        existing = (
            db.query(ModelPricing)
            .filter(
                ModelPricing.provider == item.provider.lower(),
                ModelPricing.model == item.model,
            )
            .first()
        )

        if existing:
            existing.input_price = item.input_price
            existing.output_price = item.output_price
            updated += 1
        else:
            entry = ModelPricing(
                id=str(uuid.uuid4()),
                provider=item.provider.lower(),
                model=item.model,
                input_price=item.input_price,
                output_price=item.output_price,
            )
            db.add(entry)
            created += 1

    db.commit()
    return {"created": created, "updated": updated, "total": created + updated}


@router.delete("/{pricing_id}", status_code=204)
def delete_pricing(
    pricing_id: str,
    db: Session = Depends(get_db),
):
    """Delete a pricing entry by ID."""
    entry = db.query(ModelPricing).filter(ModelPricing.id == pricing_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Pricing entry not found")

    db.delete(entry)
    db.commit()


# ---------------------------------------------------------------------------
# Seed default pricing
# ---------------------------------------------------------------------------

DEFAULT_PRICING: dict[str, dict[str, tuple[float, float]]] = {
    "openai": {
        "gpt-4o": (2.50, 10.00),
        "gpt-4o-2024-11-20": (2.50, 10.00),
        "gpt-4o-2024-08-06": (2.50, 10.00),
        "gpt-4o-2024-05-13": (5.00, 15.00),
        "gpt-4o-mini": (0.15, 0.60),
        "gpt-4o-mini-2024-07-18": (0.15, 0.60),
        "gpt-4-turbo": (10.00, 30.00),
        "gpt-4-turbo-2024-04-09": (10.00, 30.00),
        "gpt-4-turbo-preview": (10.00, 30.00),
        "gpt-4-0125-preview": (10.00, 30.00),
        "gpt-4-1106-preview": (10.00, 30.00),
        "gpt-4": (30.00, 60.00),
        "gpt-4-0613": (30.00, 60.00),
        "gpt-4-32k": (60.00, 120.00),
        "gpt-4-32k-0613": (60.00, 120.00),
        "gpt-3.5-turbo": (0.50, 1.50),
        "gpt-3.5-turbo-0125": (0.50, 1.50),
        "gpt-3.5-turbo-1106": (1.00, 2.00),
        "gpt-3.5-turbo-16k": (3.00, 4.00),
        "o1-preview": (15.00, 60.00),
        "o1-preview-2024-09-12": (15.00, 60.00),
        "o1-mini": (3.00, 12.00),
        "o1-mini-2024-09-12": (3.00, 12.00),
        "o1": (15.00, 60.00),
    },
    "anthropic": {
        "claude-opus-4-5-20251101": (15.00, 75.00),
        "claude-sonnet-4-5-20250929": (3.00, 15.00),
        "claude-haiku-4-5-20251001": (0.80, 4.00),
        "claude-3-5-sonnet-20241022": (3.00, 15.00),
        "claude-3-5-sonnet-20240620": (3.00, 15.00),
        "claude-3-5-sonnet-latest": (3.00, 15.00),
        "claude-3-5-haiku-20241022": (0.80, 4.00),
        "claude-3-5-haiku-latest": (0.80, 4.00),
        "claude-3-opus-20240229": (15.00, 75.00),
        "claude-3-opus-latest": (15.00, 75.00),
        "claude-3-sonnet-20240229": (3.00, 15.00),
        "claude-3-haiku-20240307": (0.25, 1.25),
        "claude-2.1": (8.00, 24.00),
        "claude-2.0": (8.00, 24.00),
        "claude-instant-1.2": (0.80, 2.40),
    },
    "google": {
        "gemini-2.0-flash-exp": (0.00, 0.00),
        "gemini-2.0-flash": (0.10, 0.40),
        "gemini-2.0-flash-thinking-exp": (0.00, 0.00),
        "gemini-1.5-pro": (1.25, 5.00),
        "gemini-1.5-pro-001": (1.25, 5.00),
        "gemini-1.5-pro-002": (1.25, 5.00),
        "gemini-1.5-pro-latest": (1.25, 5.00),
        "gemini-1.5-flash": (0.075, 0.30),
        "gemini-1.5-flash-001": (0.075, 0.30),
        "gemini-1.5-flash-002": (0.075, 0.30),
        "gemini-1.5-flash-latest": (0.075, 0.30),
        "gemini-1.5-flash-8b": (0.0375, 0.15),
        "gemini-1.0-pro": (0.50, 1.50),
        "gemini-1.0-pro-001": (0.50, 1.50),
        "gemini-1.0-pro-latest": (0.50, 1.50),
        "gemini-pro": (0.50, 1.50),
        "gemini-1.5-pro-exp-0827": (1.25, 5.00),
        "gemini-exp-1206": (0.00, 0.00),
    },
}


def seed_default_pricing(db: Session) -> None:
    """
    Seed the model_pricing table with defaults if it's empty.
    Called once on application startup.
    """
    count = db.query(ModelPricing).count()
    if count > 0:
        return  # Already has data, don't overwrite

    for provider, models in DEFAULT_PRICING.items():
        for model, (input_price, output_price) in models.items():
            entry = ModelPricing(
                id=str(uuid.uuid4()),
                provider=provider,
                model=model,
                input_price=input_price,
                output_price=output_price,
            )
            db.add(entry)

    db.commit()
