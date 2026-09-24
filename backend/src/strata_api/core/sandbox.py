"""Restricted execution sandbox and AST security validator.

Implements AST-based security auditing and isolated execution environments
for custom transformations and pipeline steps.
"""

import ast
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
    """AST Visitor that inspects code trees for blocked modules, identifiers, and private attributes."""

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
        if node.id in BLOCKED_NAMES:
            self.errors.append(f"Access to blocked identifier '{node.id}'")
        elif node.id.startswith("_"):
            self.errors.append(f"Access to private identifier '{node.id}'")
        self.generic_visit(node)

    def visit_Attribute(self, node: ast.Attribute):
        if node.attr in BLOCKED_NAMES:
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
    """
    validate_safe_code(code)

    loc: Dict[str, Any] = {"df": df, "pl": pl}
    glob: Dict[str, Any] = {"__builtins__": SAFE_BUILTINS, "pl": pl}

    exec(code, glob, loc)

    result_df = loc.get("df")
    if result_df is not None and isinstance(result_df, pl.DataFrame):
        return result_df
    if df is not None:
        return df
    return pl.DataFrame()
