"""
Tests for AuditiMiddleware.

Run with: pytest tests/test_middleware.py -v
"""

import pytest

from auditi.middleware import AuditiMiddleware
from auditi.context import get_context, _global_context


@pytest.fixture(autouse=True)
def reset_context():
    _global_context.set({})
    yield
    _global_context.set({})


def _make_scope(headers=None, scope_type="http"):
    """Build a minimal ASGI scope with the given headers."""
    raw_headers = []
    for k, v in (headers or {}).items():
        raw_headers.append((k.lower().encode(), v.encode()))
    return {"type": scope_type, "headers": raw_headers}


class _CaptureApp:
    """Tiny ASGI app that captures the context at call time."""

    def __init__(self):
        self.captured_context = {}

    async def __call__(self, scope, receive, send):
        self.captured_context = get_context().copy()


class TestHeaderExtraction:
    """Test extracting user_id / session_id from request headers."""

    @pytest.mark.asyncio
    async def test_default_headers(self):
        app = _CaptureApp()
        mw = AuditiMiddleware(app)

        scope = _make_scope({"X-User-ID": "alice", "X-Session-ID": "sess1"})
        await mw(scope, None, None)

        assert app.captured_context["user_id"] == "alice"
        assert app.captured_context["session_id"] == "sess1"

    @pytest.mark.asyncio
    async def test_custom_header_names(self):
        app = _CaptureApp()
        mw = AuditiMiddleware(
            app, user_id_header="X-Tenant-ID", session_id_header="X-Conversation"
        )

        scope = _make_scope({"X-Tenant-ID": "tenant42", "X-Conversation": "conv7"})
        await mw(scope, None, None)

        assert app.captured_context["user_id"] == "tenant42"
        assert app.captured_context["session_id"] == "conv7"

    @pytest.mark.asyncio
    async def test_missing_headers_no_error(self):
        app = _CaptureApp()
        mw = AuditiMiddleware(app)

        scope = _make_scope({})
        await mw(scope, None, None)

        assert app.captured_context.get("user_id") is None
        assert app.captured_context.get("session_id") is None

    @pytest.mark.asyncio
    async def test_only_user_id_header(self):
        app = _CaptureApp()
        mw = AuditiMiddleware(app)

        scope = _make_scope({"X-User-ID": "bob"})
        await mw(scope, None, None)

        assert app.captured_context["user_id"] == "bob"
        assert app.captured_context.get("session_id") is None


class TestCustomResolver:
    """Test the user_id_resolver callback."""

    @pytest.mark.asyncio
    async def test_resolver_tuple(self):
        app = _CaptureApp()

        def resolver(scope):
            return "resolved_user", "resolved_sess"

        mw = AuditiMiddleware(app, user_id_resolver=resolver)

        scope = _make_scope({"X-User-ID": "ignored"})
        await mw(scope, None, None)

        assert app.captured_context["user_id"] == "resolved_user"
        assert app.captured_context["session_id"] == "resolved_sess"

    @pytest.mark.asyncio
    async def test_resolver_single_value(self):
        app = _CaptureApp()

        def resolver(scope):
            return "just_user"

        mw = AuditiMiddleware(app, user_id_resolver=resolver)
        await mw(_make_scope(), None, None)

        assert app.captured_context["user_id"] == "just_user"

    @pytest.mark.asyncio
    async def test_resolver_returns_none(self):
        app = _CaptureApp()

        def resolver(scope):
            return None, None

        mw = AuditiMiddleware(app, user_id_resolver=resolver)
        await mw(_make_scope(), None, None)

        # No context set when resolver returns None
        assert app.captured_context.get("user_id") is None


class TestNonHttpScope:
    """Middleware should pass through non-http scopes untouched."""

    @pytest.mark.asyncio
    async def test_lifespan_passthrough(self):
        app = _CaptureApp()
        mw = AuditiMiddleware(app)

        scope = {"type": "lifespan", "headers": []}
        await mw(scope, None, None)

        # Context should be empty — middleware didn't run
        assert app.captured_context.get("user_id") is None

    @pytest.mark.asyncio
    async def test_websocket_supported(self):
        app = _CaptureApp()
        mw = AuditiMiddleware(app)

        scope = _make_scope({"X-User-ID": "ws_user"}, scope_type="websocket")
        await mw(scope, None, None)

        assert app.captured_context["user_id"] == "ws_user"
