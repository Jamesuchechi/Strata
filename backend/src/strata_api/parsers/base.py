"""Base parser interface for multi-format dataset ingestion."""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
import pyarrow as pa


class BaseParser(ABC):
    """Abstract interface for all dataset format parsers."""

    @abstractmethod
    def parse_preview(self, file_path: str, limit: int = 100) -> Dict[str, Any]:
        """Extract schema, row count estimate, and first N sample rows."""
        pass

    @abstractmethod
    def to_arrow(self, file_path: str) -> pa.Table:
        """Convert or read file into an Apache Arrow Table."""
        pass
