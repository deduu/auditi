"""
Bug #4: Route shadowing — GET /evaluators/setup/state potentially unreachable.

GET /{evaluator_id} is registered before GET /setup/state in the codebase.
With Starlette >=0.50.0 / FastAPI >=0.128.0, specific routes win over param
routes regardless of registration order. But the ordering is still a
best-practice concern for older Starlette versions and code clarity.

Result: NOT CONFIRMED on Starlette 0.50.0 — specific route wins.
Recommendation: Reorder routes for clarity and backward compatibility.
"""
from fastapi import FastAPI, APIRouter
from fastapi.testclient import TestClient


def _build_app_param_first():
    """Current codebase ordering: param route registered before specific route."""
    router = APIRouter()

    @router.get("/{evaluator_id}")
    def get_evaluator(evaluator_id: str):
        return {"matched": "param", "evaluator_id": evaluator_id}

    @router.get("/setup/state")
    def get_setup_state():
        return {"matched": "setup_state"}

    app = FastAPI()
    app.include_router(router, prefix="/evaluators")
    return app


def _build_app_specific_first():
    """Best-practice ordering: specific route before param route."""
    router = APIRouter()

    @router.get("/setup/state")
    def get_setup_state():
        return {"matched": "setup_state"}

    @router.get("/{evaluator_id}")
    def get_evaluator(evaluator_id: str):
        return {"matched": "param", "evaluator_id": evaluator_id}

    app = FastAPI()
    app.include_router(router, prefix="/evaluators")
    return app


def test_setup_state_not_shadowed_on_current_starlette():
    """Starlette 0.50.0 correctly resolves /setup/state even when param is first."""
    client = TestClient(_build_app_param_first())
    resp = client.get("/evaluators/setup/state")
    data = resp.json()
    assert data["matched"] == "setup_state", (
        "Starlette should prefer specific route over param route"
    )


def test_setup_state_reachable_with_correct_ordering():
    """With best-practice ordering, /setup/state is correctly reached."""
    client = TestClient(_build_app_specific_first())
    resp = client.get("/evaluators/setup/state")
    data = resp.json()
    assert data["matched"] == "setup_state"


def test_param_route_still_works():
    """Normal /{evaluator_id} still works in both orderings."""
    for builder in [_build_app_param_first, _build_app_specific_first]:
        client = TestClient(builder())
        resp = client.get("/evaluators/abc-123")
        data = resp.json()
        assert data["matched"] == "param"
        assert data["evaluator_id"] == "abc-123"
