"""Multi-dimensional dataset diffing engine."""

from typing import Any, Dict, List, Set


def compute_schema_diff(schema_v1: List[Dict[str, Any]], schema_v2: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Compute structural differences between two dataset schemas."""
    v1_map = {col["name"]: col["type"] for col in schema_v1}
    v2_map = {col["name"]: col["type"] for col in schema_v2}

    v1_cols = set(v1_map.keys())
    v2_cols = set(v2_map.keys())

    added_columns = list(v2_cols - v1_cols)
    removed_columns = list(v1_cols - v2_cols)
    common_columns = v1_cols & v2_cols

    type_changes = []
    for col in common_columns:
        if v1_map[col] != v2_map[col]:
            type_changes.append({
                "column": col,
                "old_type": v1_map[col],
                "new_type": v2_map[col],
            })

    return {
        "added_columns": added_columns,
        "removed_columns": removed_columns,
        "type_changes": type_changes,
        "identical_schema": not (added_columns or removed_columns or type_changes),
    }
