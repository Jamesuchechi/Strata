"""Tabular parser for CSV, TSV, Parquet, and JSON."""

from typing import Any, Dict
import polars as pl
import pyarrow as pa
import pyarrow.parquet as pq
import pyarrow.csv as pcsv
from strata_api.parsers.base import BaseParser


class TabularParser(BaseParser):
    """Parser for high-performance tabular files (CSV, Parquet, Arrow)."""

    def parse_preview(self, file_path: str, limit: int = 100) -> Dict[str, Any]:
        """Generate fast preview using Polars/PyArrow."""
        if file_path.endswith((".parquet", ".pq")):
            parquet_file = pq.ParquetFile(file_path)
            schema = [
                {"name": name, "type": str(field.type)}
                for name, field in zip(parquet_file.schema_arrow.names, parquet_file.schema_arrow)
            ]
            sample_table = parquet_file.read_row_group(0) if parquet_file.num_row_groups > 0 else parquet_file.read()
            rows = sample_table.slice(0, limit).to_pylist()
            total_rows = parquet_file.metadata.num_rows
            return {
                "format": "parquet",
                "schema": schema,
                "total_rows": total_rows,
                "total_columns": len(schema),
                "preview_rows": rows,
            }

        # Fallback to Polars lazy scan for CSV/TSV/JSON
        df = pl.read_csv(file_path, n_rows=limit) if file_path.endswith((".csv", ".tsv")) else pl.read_json(file_path)
        schema = [{"name": col, "type": str(dtype)} for col, dtype in zip(df.columns, df.dtypes)]
        return {
            "format": "csv" if file_path.endswith((".csv", ".tsv")) else "json",
            "schema": schema,
            "total_rows": len(df),
            "total_columns": len(schema),
            "preview_rows": df.to_dicts(),
        }

    def to_arrow(self, file_path: str) -> pa.Table:
        if file_path.endswith((".parquet", ".pq")):
            return pq.read_table(file_path)
        return pl.read_csv(file_path).to_arrow()
