import json
import logging
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.status import HTTP_422_UNPROCESSABLE_CONTENT

logger = logging.getLogger("app.validation")

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # exc.errors() contains the exact mismatch paths
    # request.body() shows what client actually sent
    body = await request.body()
    try:
        body_json = json.loads(body.decode("utf-8")) if body else None
    except Exception:
        body_json = body.decode("utf-8", errors="replace")

    logger.error(
        "422 ValidationError on %s %s\nErrors:\n%s\nBody:\n%s",
        request.method,
        request.url.path,
        json.dumps(exc.errors(), indent=2),
        json.dumps(body_json, indent=2) if isinstance(body_json, dict) else body_json,
    )

    return JSONResponse(
        status_code=HTTP_422_UNPROCESSABLE_CONTENT,
        content={"detail": exc.errors()},
    )
