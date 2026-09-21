"""DuckDB Vectorized Query Execution Engine."""

from typing import Any, Dict, List, Optional
import duckdb
from strata_api.config import settings


class DuckDBEngine:
    """Manages embedded DuckDB connections for high-performance analytics."""

    def __init__(self, database: str = ":memory:"):
        self.conn = duckdb.connect(database=database)
        self._configure()

    def _configure(self) -> None:
        """Apply memory limits and performance settings."""
        self.conn.execute(f"SET memory_limit = '{settings.DUCKDB_MEMORY_LIMIT}';")
        self.conn.execute(f"SET threads = {settings.DUCKDB_THREADS};")

    def query(self, sql: str, params: Optional[List[Any]] = None) -> List[Dict[str, Any]]:
        """Execute a SQL query and return results as a list of dicts."""
        if params:
            relation = self.conn.execute(sql, params)
        else:
            relation = self.conn.execute(sql)
        
        df = relation.fetchdf()
        return df.to_dict(orient="records")

    def query_arrow(self, sql: str, params: Optional[List[Any]] = None):
        """Execute a query and return Arrow Table for zero-copy streaming."""
        if params:
            relation = self.conn.execute(sql, params)
        else:
            relation = self.conn.execute(sql)
        return relation.arrow()

    def register_file(self, view_name: str, file_path: str) -> None:
        """Register a parquet, csv, or json file as a queryable view."""
        if file_path.endswith((".parquet", ".pq")):
            self.conn.execute(f"CREATE OR REPLACE VIEW {view_name} AS SELECT * FROM read_parquet('{file_path}');")
        elif file_path.endswith((".csv", ".tsv")):
            self.conn.execute(f"CREATE OR REPLACE VIEW {view_name} AS SELECT * FROM read_csv_auto('{file_path}');")
        elif file_path.endswith((".json", ".jsonl")):
            self.conn.execute(f"CREATE OR REPLACE VIEW {view_name} AS SELECT * FROM read_json_auto('{file_path}');")
        else:
            raise ValueError(f"Unsupported file format for DuckDB registration: {file_path}")

    def close(self) -> None:
        """Close connection."""
        self.conn.close()


_engine_instance: Optional[DuckDBEngine] = None


def get_duckdb_engine() -> DuckDBEngine:
    """Dependency provider for DuckDB engine instance."""
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = DuckDBEngine()
    return _engine_instance
