"""
Bug #7: Plaintext API keys stored in database.

In backend/app/routers/llm_connections.py line 56:
    api_key_encrypted=data.api_key,  # TODO: Encrypt in production

The API key is stored as-is in the `api_key_encrypted` column,
despite the column name implying encryption.

Fix: Use Fernet symmetric encryption with ENCRYPTION_KEY env var.
"""
import os


def test_api_key_now_encrypted():
    """After fix, the router should use encrypt_api_key instead of plaintext."""
    import inspect
    from app.routers.llm_connections import create_connection

    source = inspect.getsource(create_connection)

    # Fixed: should use encrypt_api_key, not direct assignment
    assert "encrypt_api_key(data.api_key)" in source, (
        "Expected encryption call for api_key"
    )
    assert "api_key_encrypted=data.api_key," not in source, (
        "Plaintext assignment should be replaced"
    )


def test_encryption_util_exists():
    """After fix, an encryption utility should be available."""
    try:
        from app.utils.encryption import encrypt_api_key, decrypt_api_key
        exists = True
    except ImportError:
        exists = False

    assert exists, (
        "app.utils.encryption module with encrypt_api_key/decrypt_api_key should exist"
    )


def test_encryption_roundtrip():
    """Encryption and decryption should produce the original value."""
    from app.utils.encryption import encrypt_api_key, decrypt_api_key

    original_key = "sk-test-1234567890abcdef"
    encrypted = encrypt_api_key(original_key)

    # Encrypted should differ from original
    assert encrypted != original_key, "Encrypted key should differ from plaintext"

    # Decryption should recover original
    decrypted = decrypt_api_key(encrypted)
    assert decrypted == original_key, (
        f"Expected '{original_key}', got '{decrypted}'"
    )


def test_empty_key_handled():
    """Empty or None keys should be handled gracefully."""
    from app.utils.encryption import encrypt_api_key, decrypt_api_key

    assert encrypt_api_key("") == ""
    assert encrypt_api_key(None) is None
    assert decrypt_api_key("") == ""
    assert decrypt_api_key(None) is None
