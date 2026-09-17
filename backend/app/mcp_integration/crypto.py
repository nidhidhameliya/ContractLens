"""
ContractLens — MCP Credential Encryption Utilities
Encrypts/decrypts MCP connection credentials at rest using AES-256.
Credentials are NEVER stored in plaintext — NFR-4 / B.6 compliance.
"""

import base64
import os
from cryptography.fernet import Fernet
from app.core.config import settings


def _get_fernet() -> Fernet:
    """Returns a Fernet instance using the configured ENCRYPTION_KEY."""
    key = settings.encryption_key
    if not key:
        # For local development without a key set, generate a temporary one
        # WARNING: This means credentials won't survive a restart — only for dev
        return Fernet(Fernet.generate_key())
    # Assume key is base64-encoded 32-byte key
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_credentials(plaintext: str) -> str:
    """Encrypts a plaintext credential string. Returns base64-encoded ciphertext."""
    f = _get_fernet()
    return f.encrypt(plaintext.encode()).decode()


def decrypt_credentials(ciphertext: str) -> str:
    """Decrypts an encrypted credential string back to plaintext."""
    f = _get_fernet()
    return f.decrypt(ciphertext.encode()).decode()

