"""Restricted execution sandbox and AST security validator.

Implements AST-based security auditing and isolated execution environments
for custom transformations and pipeline steps.
"""

import ast
import concurrent.futures
from typing import Any, Dict, Optional, Tuple
import polars as pl

BLOCKED_MODULES = {
    "os",
    "subprocess",
    "sys",
    "shutil",
    "socket",
    "pty",
    "urllib",
    "requests",
    "builtins",
    "importlib",
    "pathlib",
    "pickle",
    "ctypes",
    "multiprocessing",
    "threading",
    "signal",
    "inspect",
    "tempfile",
    "platform",
    "posix",
    "nt",
    "gc",
    "codecs",
    "io",
    "glob",
    "webbrowser",
    "http",
    "ftplib",
    "poplib",
    "imaplib",
    "smtplib",
    "asyncio",
    "concurrent",
    "_thread",
}

BLOCKED_NAMES = {
    "__builtins__",
    "__subclasses__",
    "__class__",
    "__globals__",
    "__base__",
    "__bases__",
    "__mro__",
    "__code__",
    "__reduce__",
    "__reduce_ex__",
    "__format__",
    "__dir__",
    "__getattribute__",
    "__dict__",
    "__qualname__",
    "__closure__",
    "__func__",
    "__self__",
    "__annotations__",
    "__import__",
    "eval",
    "exec",
    "compile",
    "open",
    "breakpoint",
    "getattr",
    "setattr",
    "delattr",
    "hasattr",
    "globals",
    "locals",
    "vars",
    "dir",
    "input",
    "help",
    "callable",
    "memoryview",
    "classmethod",
    "staticmethod",
    "super",
    "property",
    "type",
}

BLOCKED_ATTRIBUTES = {
    # Polars & Pandas file/database reading
    "read_csv",
    "read_parquet",
    "read_json",
    "read_ipc",
    "read_excel",
    "read_database",
    "read_delta",
    "read_avro",
    "read_sql",
    "read_table",
    "read_feather",
    "read_clipboard",
    "scan_csv",
    "scan_parquet",
    "scan_json",
    "scan_ipc",
    "scan_delta",
    "scan_iceberg",
    "scan_pyarrow_dataset",
    "scan_ndjson",
    # Polars & Pandas file/database writing and streaming
    "write_csv",
    "write_parquet",
    "write_json",
    "write_ipc",
    "write_excel",
    "write_database",
    "write_delta",
    "write_avro",
    "write_ndjson",
    "sink_parquet",
    "sink_csv",
    "sink_json",
    "sink_ipc",
    "sink_ndjson",
    "to_csv",
    "to_parquet",
    "to_json",
    "to_excel",
    "to_sql",
    "to_pickle",
    "to_feather",
    "to_hdf",
    # String format injection
    "format",
    "format_map",
    # Frame/code reflection
    "gi_frame",
    "f_globals",
    "f_locals",
    "f_code",
    "f_back",
    "cr_frame",
    "ag_frame",
    "co_code",
    "func_globals",
    "func_code",
}

SAFE_BUILTINS: Dict[str, Any] = {
    "abs": abs,
    "all": all,
    "any": any,
    "bool": bool,
    "dict": dict,
    "enumerate": enumerate,
    "filter": filter,
    "float": float,
    "int": int,
    "isinstance": isinstance,
    "issubclass": issubclass,
    "len": len,
    "list": list,
    "map": map,
    "max": max,
    "min": min,
    "pow": pow,
    "range": range,
    "reversed": reversed,
    "round": round,
    "set": set,
    "slice": slice,
    "sorted": sorted,
    "str": str,
    "sum": sum,
    "tuple": tuple,
    "zip": zip,
}


class SecurityASTVisitor(ast.NodeVisitor):
    """AST Visitor that inspects code trees for blocked modules, identifiers, and private/dangerous attributes."""

    def __init__(self):
        self.errors = []

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            root_mod = alias.name.split(".")[0]
            if root_mod in BLOCKED_MODULES:
                self.errors.append(f"Import of blocked module '{alias.name}'")
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        if node.module:
            root_mod = node.module.split(".")[0]
            if root_mod in BLOCKED_MODULES:
                self.errors.append(f"Import from blocked module '{node.module}'")
        self.generic_visit(node)

    def visit_Name(self, node: ast.Name):
        if node.id in BLOCKED_NAMES or node.id in BLOCKED_ATTRIBUTES:
            self.errors.append(f"Access to blocked identifier '{node.id}'")
        elif node.id.startswith("_"):
            self.errors.append(f"Access to private identifier '{node.id}'")
        self.generic_visit(node)

    def visit_Attribute(self, node: ast.Attribute):
        if node.attr in BLOCKED_NAMES or node.attr in BLOCKED_ATTRIBUTES:
            self.errors.append(f"Access to blocked attribute '{node.attr}'")
        elif node.attr.startswith("_"):
            self.errors.append(f"Access to private attribute '{node.attr}'")
        self.generic_visit(node)


def _is_ast_safe(code: str) -> Tuple[bool, Optional[str]]:
    """Inspect Python source code AST for unsafe constructs.

    Returns (True, None) if safe, or (False, error_description) if disallowed.
    """
    if not code or not code.strip():
        return True, None

    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return False, f"Syntax error: {e}"

    visitor = SecurityASTVisitor()
    visitor.visit(tree)
    if visitor.errors:
        return False, "; ".join(visitor.errors)
    return True, None


def validate_safe_code(code: str) -> None:
    """Validate that Python code complies with the sandbox security policy.

    Raises ValueError if code contains dangerous constructs.
    """
    is_safe, error = _is_ast_safe(code)
    if not is_safe:
        raise ValueError(f"Unsafe code detected: {error}")


def run_sandboxed_code(
    code: str,
    df: Optional[pl.DataFrame] = None,
    timeout_seconds: float = 30.0,
) -> pl.DataFrame:
    """Execute validated code in a restricted execution environment.

    Fails closed: any code failing AST validation is rejected before execution.
    Enforces an execution timeout.
    """
    validate_safe_code(code)

    loc: Dict[str, Any] = {"df": df, "pl": pl}
    glob: Dict[str, Any] = {"__builtins__": SAFE_BUILTINS, "pl": pl}

    def _execute():
        exec(code, glob, loc)
        result_df = loc.get("df")
        if result_df is not None and isinstance(result_df, pl.DataFrame):
            return result_df
        if df is not None:
            return df
        return pl.DataFrame()

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_execute)
        try:
            return future.result(timeout=timeout_seconds)
        except concurrent.futures.TimeoutError:
            raise TimeoutError(f"Sandboxed code execution timed out after {timeout_seconds}s")

