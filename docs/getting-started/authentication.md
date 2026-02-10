---
sidebar_position: 2
---

# Authentication

Auditi requires authentication for all access. The platform uses two authentication mechanisms:

- **JWT cookies** for the dashboard (frontend)
- **API keys** for SDK trace ingestion

## 1. Create Your Account

When you first open the frontend at `http://localhost:5173`, the setup wizard prompts you to create an admin account with your email, name, and password. This initial setup is only available when no users exist yet.

For subsequent users, use the login page with your email and password.

## 2. Generate an API Key

After logging in, navigate to **Settings > API Keys** and click **Create API Key**. Give it a descriptive name (e.g., "Production", "Development").

The key (prefixed with `audi_`) is shown **only once** at creation time — copy it immediately and store it securely. You will not be able to view the full key again.

## 3. Use the API Key in the SDK

Pass your API key when initializing the SDK:

```python
import auditi

auditi.init(api_key="audi_...", base_url="http://localhost:8000")
```

The SDK sends the key as a `Bearer` token in the `Authorization` header on every request.

## Authentication Summary

| Context | Auth Method | How it works |
|---------|-------------|--------------|
| Dashboard (frontend) | JWT cookie | Email/password login sets an httpOnly cookie |
| SDK trace ingestion | API key | `Authorization: Bearer audi_...` header |
| API docs / curl | JWT or API key | Bearer token in Authorization header |

## API Key Management

- **List keys**: View all your API keys in Settings (only the prefix is shown for security)
- **Revoke keys**: Deactivate a key permanently — it cannot be reactivated
- **Usage tracking**: Each key tracks when it was last used
- **Multiple keys**: Create separate keys for different environments (dev, staging, production)

## Security Notes

- API keys are stored as SHA-256 hashes in the database — the plaintext is never stored
- JWT session tokens expire after 24 hours by default (configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`)
- Session cookies use `httpOnly` and `SameSite=Lax` flags for security
- Set `JWT_SECRET` in your environment to persist sessions across restarts (see [Installation](./installation.md))
