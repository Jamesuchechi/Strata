"""Cryptographic content-addressing hashing utilities."""

import hashlib
from typing import BinaryIO


def compute_content_hash(file_obj: BinaryIO, chunk_size: int = 65536) -> str:
    """Compute SHA-256 hash across a binary stream for content-addressing."""
    sha256 = hashlib.sha256()
    file_obj.seek(0)
    while chunk := file_obj.read(chunk_size):
        sha256.update(chunk)
    file_obj.seek(0)
    return sha256.hexdigest()
