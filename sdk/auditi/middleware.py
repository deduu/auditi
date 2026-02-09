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
Auditi middleware for FastAPI/Starlette.

Automatically extracts user_id and session_id from each request
and sets them in the Auditi context so all traces are attributed
to the correct user.

Requires starlette (installed with FastAPI).
"""
from typing import Optional, Callable, Tuple

from .context import set_context


class AuditiMiddleware:
    """
    ASGI middleware that extracts user_id and session_id from each request
    and calls auditi.set_context() so all traces within the request are
    attributed to the correct user.

    Works with FastAPI, Starlette, and any ASGI framework.

    Args:
        app: The ASGI application.
        user_id_header: Header name to read user_id from (default: "X-User-ID").
        session_id_header: Header name to read session_id from (default: "X-Session-ID").
        user_id_resolver: Optional callable that receives the ASGI scope and returns
            (user_id, session_id). When provided, headers are ignored.

    Example:
        # Header-based (default)
        app.add_middleware(AuditiMiddleware)

        # Custom headers
        app.add_middleware(AuditiMiddleware, user_id_header="X-Tenant-ID")

        # Custom resolver (e.g. JWT decoding)
        def resolve_user(scope):
            token = dict(scope.get("headers", [])).get(b"authorization", b"").decode()
            user_id = decode_jwt(token).get("sub")
            return user_id, None

        app.add_middleware(AuditiMiddleware, user_id_resolver=resolve_user)
    """

    def __init__(
        self,
        app,
        user_id_header: str = "X-User-ID",
        session_id_header: str = "X-Session-ID",
        user_id_resolver: Optional[Callable] = None,
    ):
        self.app = app
        self.user_id_header = user_id_header.lower().encode()
        self.session_id_header = session_id_header.lower().encode()
        self.user_id_resolver = user_id_resolver

    async def __call__(self, scope, receive, send):
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        user_id: Optional[str] = None
        session_id: Optional[str] = None

        if self.user_id_resolver:
            result = self.user_id_resolver(scope)
            if isinstance(result, tuple) and len(result) == 2:
                user_id, session_id = result
            else:
                user_id = result
        else:
            headers = dict(scope.get("headers", []))
            raw_user_id = headers.get(self.user_id_header)
            raw_session_id = headers.get(self.session_id_header)
            if raw_user_id:
                user_id = raw_user_id.decode()
            if raw_session_id:
                session_id = raw_session_id.decode()

        if user_id or session_id:
            set_context(user_id=user_id, session_id=session_id)

        await self.app(scope, receive, send)
