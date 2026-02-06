"""
Encryption utilities for sensitive data (API keys, secrets).

Uses Fernet symmetric encryption from the cryptography library.
Requires ENCRYPTION_KEY environment variable to be set.
Generate a key with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""

import os
from typing import Optional
from cryptography.fernet import Fernet

_fernet_instance: Optional[Fernet] = None


def _get_fernet() -> Fernet:
    """Get or create the Fernet instance from ENCRYPTION_KEY env var."""
    global _fernet_instance
    if _fernet_instance is None:
        key = os.environ.get("ENCRYPTION_KEY")
        if not key:
            # Generate a key for development; in production, ENCRYPTION_KEY must be set
            key = Fernet.generate_key().decode()
            os.environ["ENCRYPTION_KEY"] = key
        _fernet_instance = Fernet(key.encode() if isinstance(key, str) else key)
    return _fernet_instance


def encrypt_api_key(plaintext: Optional[str]) -> Optional[str]:
    """Encrypt an API key. Returns None/empty for None/empty input."""
    if plaintext is None:
        return None
    if plaintext == "":
        return ""
    fernet = _get_fernet()
    return fernet.encrypt(plaintext.encode()).decode()


def decrypt_api_key(ciphertext: Optional[str]) -> Optional[str]:
    """Decrypt an API key. Returns None/empty for None/empty input."""
    if ciphertext is None:
        return None
    if ciphertext == "":
        return ""
    fernet = _get_fernet()
    return fernet.decrypt(ciphertext.encode()).decode()
