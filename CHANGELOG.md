# Changelog

## 2026-02-06 — Bug Fixes & Security Hardening

### Security Fixes
- Fixed XSS vulnerability in frontend content renderer (replaced unsafe parsing with `JSON.parse`)
- Fixed plaintext API key storage — LLM connection keys are now encrypted at rest using Fernet

### Bug Fixes
- **SDK**: Created missing `pricing.py` module that prevented SDK import
- **SDK**: Fixed async standalone traces returning unawaited coroutine objects instead of actual results
- **SDK**: Fixed `trace_agent` decorator not clearing context after execution, causing stale trace leakage
- **Backend**: Fixed missing 404 response in actions PATCH endpoint (returned 500 on nonexistent resource)
- **Frontend**: Fixed unguarded property access crash on conversation detail page when evaluation data is missing
- **Frontend**: Added Error Boundary to prevent full-page white screen on rendering errors

### Test Infrastructure
- Added 36 regression tests across SDK (pytest), Backend (pytest + TestClient), and Frontend (Vitest)
