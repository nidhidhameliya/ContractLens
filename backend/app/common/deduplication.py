"""
Termora — Deduplication
Prevents redundant contract processing using SHA-256 file hashing.
A file is a duplicate if it has the same source_file_id + file_hash.
If the hash differs (updated file), it triggers a re-scan.
"""

import hashlib
import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.contracts.contract import Contract

logger = logging.getLogger(__name__)


def compute_hash(file_bytes: bytes) -> str:
    """Returns the SHA-256 hex digest of a file's raw bytes."""
    return hashlib.sha256(file_bytes).hexdigest()


def check_duplicate(
    org_id: UUID,
    source_file_id: str,
    file_hash: str,
    db: Session,
) -> tuple[bool, Contract | None]:
    """
    Checks if a file has already been ingested.

    Returns:
        (True, existing_contract) → Exact duplicate (same hash). Skip processing.
        (False, existing_contract) → Updated file (same source_file_id, different hash). Re-scan.
        (False, None) → New file. Process normally.
    """
    existing = (
        db.query(Contract)
        .filter(
            Contract.org_id == org_id,
            Contract.source_file_id == source_file_id,
        )
        .first()
    )

    if existing is None:
        return False, None  # New file

    if existing.file_hash == file_hash:
        logger.info(f"Duplicate detected: source_file_id={source_file_id} hash matches. Skipping.")
        return True, existing  # Exact duplicate — skip

    # Same file ID, different hash → file was updated
    logger.info(f"Updated file detected: source_file_id={source_file_id}. Will re-scan.")
    return False, existing  # Re-scan with updated content
