"""Multi-dimensional dataset diffing engine."""

from typing import Any, Dict, List, Optional, Set


def compute_schema_diff(schema_v1: List[Dict[str, Any]], schema_v2: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Compute structural differences between two dataset schemas."""
    v1_map = {col["name"]: col.get("type", "unknown") for col in schema_v1}
    v2_map = {col["name"]: col.get("type", "unknown") for col in schema_v2}

    v1_cols = set(v1_map.keys())
    v2_cols = set(v2_map.keys())

    added_columns = sorted(list(v2_cols - v1_cols))
    removed_columns = sorted(list(v1_cols - v2_cols))
    common_columns = sorted(list(v1_cols & v2_cols))

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
        "common_columns": common_columns,
        "type_changes": type_changes,
        "identical_schema": not (added_columns or removed_columns or type_changes),
    }


def compute_cell_diff(
    rows_v1: List[Dict[str, Any]],
    rows_v2: List[Dict[str, Any]],
    primary_key: Optional[str] = None,
    limit: int = 50,
) -> Dict[str, Any]:
    """Compute row additions, deletions, and cell-level modifications."""
    if not rows_v1 and not rows_v2:
        return {"added_rows_count": 0, "removed_rows_count": 0, "modified_cells": []}

    # Determine key column
    if not primary_key and rows_v1:
        for candidate in ["id", "uuid", "key", "code", "variant_id", "customer_id"]:
            if candidate in rows_v1[0]:
                primary_key = candidate
                break

    modified_cells = []
    added_rows = []
    removed_rows = []

    if primary_key:
        v1_dict = {str(r.get(primary_key)): r for r in rows_v1 if r.get(primary_key) is not None}
        v2_dict = {str(r.get(primary_key)): r for r in rows_v2 if r.get(primary_key) is not None}

        for k, r2 in list(v2_dict.items())[:limit]:
            if k not in v1_dict:
                added_rows.append(r2)
            else:
                r1 = v1_dict[k]
                for col in r2:
                    if col in r1 and r1[col] != r2[col]:
                        modified_cells.append({
                            "key": k,
                            "column": col,
                            "old_val": r1[col],
                            "new_val": r2[col],
                        })

        for k, r1 in list(v1_dict.items())[:limit]:
            if k not in v2_dict:
                removed_rows.append(r1)
    else:
        # Positional row diff
        min_len = min(len(rows_v1), len(rows_v2))
        for i in range(min(min_len, limit)):
            r1 = rows_v1[i]
            r2 = rows_v2[i]
            for col in r2:
                if col in r1 and r1[col] != r2[col]:
                    modified_cells.append({
                        "row_index": i,
                        "column": col,
                        "old_val": r1[col],
                        "new_val": r2[col],
                    })
        if len(rows_v2) > len(rows_v1):
            added_rows = rows_v2[min_len:min_len + limit]
        elif len(rows_v1) > len(rows_v2):
            removed_rows = rows_v1[min_len:min_len + limit]

    return {
        "primary_key_used": primary_key,
        "delta_rows": len(rows_v2) - len(rows_v1),
        "total_v1_rows": len(rows_v1),
        "total_v2_rows": len(rows_v2),
        "modified_cells_count": len(modified_cells),
        "modified_cells_sample": modified_cells[:limit],
        "added_rows_count": max(0, len(rows_v2) - len(rows_v1)),
        "removed_rows_count": max(0, len(rows_v1) - len(rows_v2)),
    }


def compute_statistical_drift(
    stats_v1: List[Dict[str, Any]],
    stats_v2: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Compute mean, null percentage, and distinct count drift between two versions."""
    s1_map = {s["name"]: s for s in stats_v1}
    s2_map = {s["name"]: s for s in stats_v2}

    drift_report = []
    for name, s1 in s1_map.items():
        if name in s2_map:
            s2 = s2_map[name]
            drift_item = {
                "column": name,
                "null_pct_delta": round(s2.get("null_pct", 0) - s1.get("null_pct", 0), 2),
                "distinct_count_delta": s2.get("distinct_count", 0) - s1.get("distinct_count", 0),
            }
            if "mean" in s1 and "mean" in s2 and s1["mean"] is not None and s2["mean"] is not None:
                drift_item["mean_delta"] = round(s2["mean"] - s1["mean"], 4)
                drift_item["old_mean"] = s1["mean"]
                drift_item["new_mean"] = s2["mean"]

            drift_report.append(drift_item)

    return drift_report

