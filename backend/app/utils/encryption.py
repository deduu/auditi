# Copyright (c) 2026 Auditibl Inc.
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
Encryption utilities for sensitive data (API keys, secrets).

Uses Fernet symmetric encryption from the cryptography library.
Requires ENCRYPTION_KEY environment variable to be set.
Generate a key with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""

import logging
import os
from typing import Optional
from cryptography.fernet import Fernet

logger = logging.getLogger("auditi.encryption")

_fernet_instance: Optional[Fernet] = None


def _get_fernet() -> Fernet:
    """Get or create the Fernet instance from ENCRYPTION_KEY env var."""
    global _fernet_instance
    if _fernet_instance is None:
        key = os.environ.get("ENCRYPTION_KEY")
        if not key:
            key = Fernet.generate_key().decode()
            os.environ["ENCRYPTION_KEY"] = key
            logger.warning(
                "ENCRYPTION_KEY not set — generated ephemeral key. "
                "API keys encrypted now will be LOST on restart. "
                "Set ENCRYPTION_KEY env var for persistence."
            )
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
    """Decrypt an API key. Returns None/empty for None/empty input.
    Returns None on decryption failure (e.g. encryption key changed)."""
    if ciphertext is None:
        return None
    if ciphertext == "":
        return ""
    try:
        fernet = _get_fernet()
        return fernet.decrypt(ciphertext.encode()).decode()
    except Exception:
        logger.warning(
            "Failed to decrypt API key — encryption key may have changed. "
            "Please re-save your LLM connection."
        )
        return None
