import os
import re
from typing import Any, Dict, List, Optional
import duckdb
from strata_api.config import settings

SQL_TOKEN_RE = re.compile(
    r"""
    (?P<single_quote>\x27(?:[^\x27\\]|\\.)*\x27)
    |(?P<double_quote>"(?:[^"\\]|\\.)*")
    |(?P<block_comment>/\*.*?\*/)
    |(?P<line_comment>--[^\r\n]*)
    """,
    re.VERBOSE | re.DOTALL,
)

DISALLOWED_KEYWORDS = {
    "ATTACH",
    "DETACH",
    "COPY",
    "INSTALL",
    "LOAD",
    "PRAGMA",
    "CALL",
    "EXPORT",
    "IMPORT",
    "SET",
    "RESET",
}

DISALLOWED_FUNCS = {
    "read_csv",
    "read_csv_auto",
    "read_parquet",
    "scan_parquet",
    "parquet_scan",
    "read_json",
    "read_json_auto",
    "scan_json",
    "scan_csv",
    "read_ndjson",
    "read_ndjson_auto",
    "read_text",
    "read_blob",
    "glob",
    "httpfs",
    "sqlite_scanner",
    "postgres_scanner",
}

KW_RE = re.compile(r"\b(" + "|".join(DISALLOWED_KEYWORDS) + r")\b", re.IGNORECASE)
FN_RE = re.compile(r"\b(" + "|".join(DISALLOWED_FUNCS) + r")\b", re.IGNORECASE)
DISALLOWED_PATH_RE = re.compile(
    r"""^[\x27\x22](?:/|~|[a-zA-Z]:[/\\]|https?://|s3://|gcs://|file://|ftp://|\.\.[/\\]|[^\x27\x22]*\.\.[/\\])""",
    re.IGNORECASE,
)


def validate_sql(sql: str, duckdb_conn: Optional[duckdb.DuckDBPyConnection] = None) -> None:
    """Validate analytical SQL to ensure no external access, sensitive commands, or file system attacks."""
    if not sql or not sql.strip():
        raise ValueError("Query string cannot be empty.")

    literals = []
    cleaned_tokens = []
    last_idx = 0

    for match in SQL_TOKEN_RE.finditer(sql):
        cleaned_tokens.append(sql[last_idx : match.start()])
        last_idx = match.end()
        if match.group("single_quote"):
            lit = match.group("single_quote")
            literals.append(lit)
            cleaned_tokens.append("''")
        elif match.group("double_quote"):
            lit = match.group("double_quote")
            literals.append(lit)
            cleaned_tokens.append('""')
        elif match.group("block_comment") or match.group("line_comment"):
            cleaned_tokens.append(" ")

    cleaned_tokens.append(sql[last_idx:])
    cleaned_sql = "".join(cleaned_tokens).strip()

    # 1. Check string literals for external URLs, absolute paths, or traversal
    for lit in literals:
        if DISALLOWED_PATH_RE.search(lit):
            raise ValueError(f"External filesystem access or URL disallowed: {lit}")

    # 2. Check disallowed keywords
    kw_match = KW_RE.search(cleaned_sql)
    if kw_match:
        raise ValueError(f"Disallowed SQL keyword: {kw_match.group().upper()}")

    # 3. Check disallowed functions
    fn_match = FN_RE.search(cleaned_sql)
    if fn_match:
        raise ValueError(f"Disallowed SQL function: {fn_match.group().lower()}")

    # 4. Check statement types using DuckDB parser if conn is available
    if duckdb_conn:
        try:
            stmts = duckdb_conn.extract_statements(cleaned_sql)
        except Exception as e:
            raise ValueError(f"SQL parsing error: {e}")

        if len(stmts) == 0:
            raise ValueError("No executable statements found in query.")
        if len(stmts) > 1:
            raise ValueError("Multiple SQL statements are not permitted.")

        stmt_type = str(stmts[0].type)
        if stmt_type not in ("StatementType.SELECT", "StatementType.EXPLAIN"):
            raise ValueError(f"Statement type {stmt_type} is not allowed.")


class DuckDBEngine:
    """Manages embedded DuckDB connections for high-performance analytics."""

    def __init__(self, database: str = ":memory:"):
        self.conn = duckdb.connect(database=database)
        self._configure()

    def _configure(self) -> None:
        """Apply memory limits and enforce engine-level security lockdown."""
        self.conn.execute(f"SET memory_limit = '{settings.DUCKDB_MEMORY_LIMIT}';")
        self.conn.execute(f"SET threads = {settings.DUCKDB_THREADS};")
        self.conn.execute("SET autoinstall_known_extensions = false;")
        self.conn.execute("SET autoload_known_extensions = false;")
        self.conn.execute("SET enable_external_access = false;")
        self.conn.execute("SET lock_configuration = true;")

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
        """Register a parquet, csv, json, or excel file as an in-memory queryable view."""
        abs_path = os.path.abspath(file_path)
        if abs_path.endswith((".parquet", ".pq")):
            import pyarrow.parquet as pq

            table = pq.read_table(abs_path)
            self.conn.register(view_name, table)
        elif abs_path.endswith((".csv", ".tsv")):
            import polars as pl

            sep = "\t" if abs_path.endswith(".tsv") else ","
            try:
                df = pl.read_csv(abs_path, separator=sep)
                self.conn.register(view_name, df.to_arrow())
            except Exception:
                import pandas as pd

                df = pd.read_csv(abs_path, sep=sep)
                self.conn.register(view_name, df)
        elif abs_path.endswith((".json", ".jsonl")):
            import polars as pl

            try:
                df = pl.read_ndjson(abs_path)
                self.conn.register(view_name, df.to_arrow())
            except Exception:
                try:
                    df = pl.read_json(abs_path)
                    self.conn.register(view_name, df.to_arrow())
                except Exception:
                    import pandas as pd

                    df = pd.read_json(abs_path)
                    self.conn.register(view_name, df)
        elif abs_path.endswith((".xlsx", ".xls")):
            import pandas as pd

            df = pd.read_excel(abs_path)
            self.conn.register(view_name, df)
        else:
            raise ValueError(f"Unsupported file format for DuckDB registration: {file_path}")

    def register_df(self, view_name: str, df: Any) -> None:
        """Register a pandas or polars DataFrame directly."""
        self.conn.register(view_name, df)

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
