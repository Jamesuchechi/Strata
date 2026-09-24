"""Sandboxed query and analytical code runner."""

from typing import Any, Dict, List
from strata_api.core.duckdb_engine import DuckDBEngine, validate_sql


class QueryExecutor:
    """Executes validated analytical queries against DuckDB views."""

    def __init__(self, engine: DuckDBEngine):
        self.engine = engine

    def execute_sql(self, sql: str, limit: int = 500) -> Dict[str, Any]:
        """Safely execute SQL query and return rows + column names."""
        clean_sql = sql.strip().rstrip(";")
        # Enforce limit if not present
        if "limit" not in clean_sql.lower():
            clean_sql = f"{clean_sql} LIMIT {limit}"

        try:
            validate_sql(sql, self.engine.conn)
            results = self.engine.query(clean_sql)
            columns = list(results[0].keys()) if results else []
            return {
                "success": True,
                "row_count": len(results),
                "columns": columns,
                "data": results,
                "executed_sql": clean_sql,
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "executed_sql": clean_sql,
            }
