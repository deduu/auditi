"""
Bug #5: Route shadowing — GET /llm-connections/default/model potentially unreachable.

GET /{connection_id} is registered before GET /default/model in the codebase.
With Starlette >=0.50.0 / FastAPI >=0.128.0, specific routes win over param
routes regardless of registration order.

Result: NOT CONFIRMED on Starlette 0.50.0 — specific route wins.
Recommendation: Reorder routes for clarity and backward compatibility.
"""
from fastapi import FastAPI, APIRouter
from fastapi.testclient import TestClient


def _build_app_param_first():
    """Current codebase ordering: param route registered before specific route."""
    router = APIRouter()

    @router.get("/{connection_id}")
    def get_connection(connection_id: str):
        return {"matched": "param", "connection_id": connection_id}

    @router.get("/default/model")
    def get_default_model():
        return {"matched": "default_model"}

    app = FastAPI()
    app.include_router(router, prefix="/llm-connections")
    return app


def _build_app_specific_first():
    """Best-practice ordering: specific route before param route."""
    router = APIRouter()

    @router.get("/default/model")
    def get_default_model():
        return {"matched": "default_model"}

    @router.get("/{connection_id}")
    def get_connection(connection_id: str):
        return {"matched": "param", "connection_id": connection_id}

    app = FastAPI()
    app.include_router(router, prefix="/llm-connections")
    return app


def test_default_model_not_shadowed_on_current_starlette():
    """Starlette 0.50.0 correctly resolves /default/model even when param is first."""
    client = TestClient(_build_app_param_first())
    resp = client.get("/llm-connections/default/model")
    data = resp.json()
    assert data["matched"] == "default_model", (
        "Starlette should prefer specific route over param route"
    )


def test_default_model_reachable_with_correct_ordering():
    """With best-practice ordering, /default/model is correctly reached."""
    client = TestClient(_build_app_specific_first())
    resp = client.get("/llm-connections/default/model")
    data = resp.json()
    assert data["matched"] == "default_model"


def test_param_route_still_works():
    """Normal /{connection_id} still works in both orderings."""
    for builder in [_build_app_param_first, _build_app_specific_first]:
        client = TestClient(builder())
        resp = client.get("/llm-connections/abc-123")
        data = resp.json()
        assert data["matched"] == "param"
        assert data["connection_id"] == "abc-123"
