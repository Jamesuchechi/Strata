"""Parsers module for dataset ingestion across formats."""

from strata_api.parsers.base import BaseParser
from strata_api.parsers.tabular import TabularParser
from strata_api.parsers.excel import ExcelParser
from strata_api.parsers.scientific import ScientificParser
from strata_api.parsers.geospatial import GeospatialParser


def get_parser_for_file(file_path: str) -> BaseParser:
    """Return appropriate parser based on file extension."""
    lower = file_path.lower()
    if lower.endswith((".xlsx", ".xls")):
        return ExcelParser()
    elif lower.endswith((".sdf", ".mol", ".fasta")):
        return ScientificParser()
    elif lower.endswith((".geojson", ".json")) and "geo" in lower:
        return GeospatialParser()
    else:
        return TabularParser()


__all__ = [
    "BaseParser",
    "TabularParser",
    "ExcelParser",
    "ScientificParser",
    "GeospatialParser",
    "get_parser_for_file",
]
