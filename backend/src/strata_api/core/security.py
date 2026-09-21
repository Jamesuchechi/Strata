"""Security & authentication utilities."""

from typing import Optional


def sanitize_column_name(col: str) -> str:
    """Sanitize column name to prevent SQL injection or bad syntax."""
    return col.replace('"', '""')


def verify_api_key(api_key: Optional[str]) -> bool:
    """Stub for API key verification."""
    return True
