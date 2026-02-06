"""
Bug #6: Missing 404 raise in PATCH /actions/{action_id}.

In backend/app/routers/actions.py, when action_id doesn't exist,
the endpoint should return 404 instead of continuing with None.

Fix: Added `raise HTTPException(status_code=404, detail="Action not found")`.
"""
from unittest.mock import MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient


def _build_test_app():
    """Build a minimal test app with the actions router."""
    from app.routers.actions import router

    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    return app


def test_patch_nonexistent_action_returns_404():
    """After fix, PATCH on non-existent action_id returns 404."""
    app = _build_test_app()
    client = TestClient(app, raise_server_exceptions=False)

    mock_db = MagicMock()
    mock_query = MagicMock()
    mock_query.filter.return_value.first.return_value = None
    mock_db.query.return_value = mock_query

    from app.database import get_db
    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        resp = client.patch(
            "/api/v1/actions/nonexistent-id",
            json={"status": "completed"},
        )
        assert resp.status_code == 404, (
            f"Expected 404 for non-existent action, got {resp.status_code}"
        )
        assert "not found" in resp.json()["detail"].lower()
    finally:
        app.dependency_overrides.clear()
