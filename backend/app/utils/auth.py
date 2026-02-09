"""Authentication utilities: password hashing, JWT tokens, API key generation."""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import jwt, JWTError

from app.config import settings

logger = logging.getLogger("auditi.auth")

# ---------------------------------------------------------------------------
# Password hashing (bcrypt)
# ---------------------------------------------------------------------------


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


# ---------------------------------------------------------------------------
# JWT tokens
# ---------------------------------------------------------------------------

_jwt_secret: str | None = None


def _get_jwt_secret() -> str:
    global _jwt_secret
    if _jwt_secret is None:
        secret = settings.jwt_secret
        if not secret:
            secret = secrets.token_urlsafe(64)
            logger.warning(
                "JWT_SECRET not set — generated ephemeral key. "
                "User sessions will be LOST on restart. "
                "Set JWT_SECRET env var for persistence."
            )
        _jwt_secret = secret
    return _jwt_secret


def create_access_token(user_id: str, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload = {
        "sub": user_id,
        "email": email,
        "exp": expire,
    }
    return jwt.encode(payload, _get_jwt_secret(), algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(
            token, _get_jwt_secret(), algorithms=[settings.jwt_algorithm]
        )
        return payload
    except JWTError:
        return None


# ---------------------------------------------------------------------------
# API key generation / hashing
# ---------------------------------------------------------------------------

API_KEY_PREFIX = "audi_"


def generate_api_key() -> tuple[str, str, str]:
    """Generate a new API key.

    Returns:
        (full_key, key_prefix, key_hash)
    """
    random_part = secrets.token_urlsafe(32)
    full_key = f"{API_KEY_PREFIX}{random_part}"
    key_prefix = full_key[:16]
    key_hash = hashlib.sha256(full_key.encode()).hexdigest()
    return full_key, key_prefix, key_hash


def hash_api_key(key: str) -> str:
    """Hash an API key for database lookup."""
    return hashlib.sha256(key.encode()).hexdigest()
