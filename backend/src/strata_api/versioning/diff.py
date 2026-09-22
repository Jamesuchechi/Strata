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


def compute_distribution_diff(
    rows_v1: List[Dict[str, Any]],
    rows_v2: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Compute mean, median, variance, IQR shift, and min/max shift for numerical columns."""
    if not rows_v1 and not rows_v2:
        return {}

    all_keys = set()
    if rows_v1:
        all_keys.update(rows_v1[0].keys())
    if rows_v2:
        all_keys.update(rows_v2[0].keys())

    distribution_shifts = {}

    for col in sorted(list(all_keys)):
        vals_v1 = [float(r[col]) for r in rows_v1 if col in r and isinstance(r[col], (int, float)) and r[col] is not None]
        vals_v2 = [float(r[col]) for r in rows_v2 if col in r and isinstance(r[col], (int, float)) and r[col] is not None]

        if not vals_v1 or not vals_v2:
            continue

        import statistics
        vals_v1.sort()
        vals_v2.sort()

        mean_v1 = statistics.mean(vals_v1)
        mean_v2 = statistics.mean(vals_v2)
        med_v1 = statistics.median(vals_v1)
        med_v2 = statistics.median(vals_v2)
        var_v1 = statistics.variance(vals_v1) if len(vals_v1) > 1 else 0.0
        var_v2 = statistics.variance(vals_v2) if len(vals_v2) > 1 else 0.0

        def calc_iqr(arr: List[float]) -> float:
            n = len(arr)
            if n < 4:
                return arr[-1] - arr[0]
            q1 = arr[n // 4]
            q3 = arr[(3 * n) // 4]
            return q3 - q1

        iqr_v1 = calc_iqr(vals_v1)
        iqr_v2 = calc_iqr(vals_v2)

        distribution_shifts[col] = {
            "column": col,
            "mean": {"v1": round(mean_v1, 3), "v2": round(mean_v2, 3), "delta": round(mean_v2 - mean_v1, 3)},
            "median": {"v1": round(med_v1, 3), "v2": round(med_v2, 3), "delta": round(med_v2 - med_v1, 3)},
            "variance": {"v1": round(var_v1, 3), "v2": round(var_v2, 3), "delta": round(var_v2 - var_v1, 3)},
            "iqr": {"v1": round(iqr_v1, 3), "v2": round(iqr_v2, 3), "delta": round(iqr_v2 - iqr_v1, 3)},
            "min": {"v1": vals_v1[0], "v2": vals_v2[0], "delta": round(vals_v2[0] - vals_v1[0], 3)},
            "max": {"v1": vals_v1[-1], "v2": vals_v2[-1], "delta": round(vals_v2[-1] - vals_v1[-1], 3)},
            "shift_severity": "high" if abs(mean_v2 - mean_v1) > (0.2 * (abs(mean_v1) + 1e-5)) else "normal",
        }

    return distribution_shifts


def compute_missing_and_duplicate_deltas(
    rows_v1: List[Dict[str, Any]],
    rows_v2: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Compute null percentages before/after and duplicate row count deltas."""
    def count_nulls(rows: List[Dict[str, Any]]) -> Dict[str, float]:
        if not rows:
            return {}
        cols = list(rows[0].keys())
        res = {}
        for c in cols:
            null_count = sum(1 for r in rows if r.get(c) is None or r.get(c) == "")
            res[c] = round((null_count / len(rows)) * 100, 2)
        return res

    nulls_v1 = count_nulls(rows_v1)
    nulls_v2 = count_nulls(rows_v2)

    null_deltas = {}
    all_cols = set(nulls_v1.keys()) | set(nulls_v2.keys())
    for c in sorted(all_cols):
        p1 = nulls_v1.get(c, 0.0)
        p2 = nulls_v2.get(c, 0.0)
        null_deltas[c] = {
            "v1_null_pct": p1,
            "v2_null_pct": p2,
            "delta_pct": round(p2 - p1, 2),
        }

    # Count duplicate rows
    import json
    def count_dupes(rows: List[Dict[str, Any]]) -> int:
        seen = set()
        dupes = 0
        for r in rows:
            rep = json.dumps(r, sort_keys=True, default=str)
            if rep in seen:
                dupes += 1
            else:
                seen.add(rep)
        return dupes

    dupes_v1 = count_dupes(rows_v1)
    dupes_v2 = count_dupes(rows_v2)

    return {
        "null_deltas": null_deltas,
        "duplicate_rows": {
            "v1": dupes_v1,
            "v2": dupes_v2,
            "delta": dupes_v2 - dupes_v1,
        }
    }


def detect_smart_column_renames(
    schema_v1: List[Dict[str, Any]],
    schema_v2: List[Dict[str, Any]],
    rows_v1: List[Dict[str, Any]],
    rows_v2: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Smart heuristic to identify renamed columns rather than separate drops and adds."""
    cols_v1 = {c["name"]: c.get("type", "unknown") for c in schema_v1}
    cols_v2 = {c["name"]: c.get("type", "unknown") for c in schema_v2}

    dropped = set(cols_v1.keys()) - set(cols_v2.keys())
    added = set(cols_v2.keys()) - set(cols_v1.keys())

    potential_renames = []

    for d in dropped:
        for a in added:
            # 1. Check common substring or token overlap
            d_norm = d.lower().replace("_", "").replace("-", "")
            a_norm = a.lower().replace("_", "").replace("-", "")
            name_similarity = (d_norm in a_norm) or (a_norm in d_norm)

            # 2. Check type consistency
            type_match = cols_v1[d] == cols_v2[a]

            # 3. Check cardinality and sample values if rows available
            vals_v1 = [r.get(d) for r in rows_v1 if r.get(d) is not None]
            vals_v2 = [r.get(a) for r in rows_v2 if r.get(a) is not None]

            cardinality_ratio = 1.0
            if vals_v1 and vals_v2:
                u1 = len(set(str(v) for v in vals_v1))
                u2 = len(set(str(v) for v in vals_v2))
                cardinality_ratio = min(u1, u2) / max(u1, u2) if max(u1, u2) > 0 else 1.0

            confidence = 0.5
            if name_similarity:
                confidence += 0.3
            if type_match:
                confidence += 0.1
            if cardinality_ratio > 0.8:
                confidence += 0.1

            if confidence >= 0.7 or (name_similarity and type_match):
                potential_renames.append({
                    "old_column": d,
                    "new_column": a,
                    "confidence": min(1.0, round(confidence, 2)),
                    "type": cols_v2[a],
                    "reason": "High name/type/cardinality match between dropped and added columns",
                })

    return potential_renames


def detect_categorical_domain_shifts(
    rows_v1: List[Dict[str, Any]],
    rows_v2: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Detect new categorical classes introduced or existing classes dropped."""
    if not rows_v1 and not rows_v2:
        return {}

    shifts = {}
    cols = set(rows_v1[0].keys()) & set(rows_v2[0].keys()) if (rows_v1 and rows_v2) else set()

    for c in cols:
        v1_sample = [r.get(c) for r in rows_v1 if r.get(c) is not None]
        v2_sample = [r.get(c) for r in rows_v2 if r.get(c) is not None]

        # Check if non-numeric or low cardinality (categorical)
        is_num = all(isinstance(x, (int, float)) for x in v1_sample[:10])
        if is_num and len(set(v1_sample)) > 20:
            continue

        cats_v1 = set(str(x) for x in v1_sample)
        cats_v2 = set(str(x) for x in v2_sample)

        added_cats = sorted(list(cats_v2 - cats_v1))
        dropped_cats = sorted(list(cats_v1 - cats_v2))

        if added_cats or dropped_cats:
            shifts[c] = {
                "column": c,
                "added_categories": added_cats,
                "dropped_categories": dropped_cats,
                "v1_total_categories": len(cats_v1),
                "v2_total_categories": len(cats_v2),
            }

    return shifts


def generate_diff_markdown_report(
    base_commit: Dict[str, Any],
    target_commit: Dict[str, Any],
    detailed_diff: Dict[str, Any],
) -> str:
    """Generate professional Markdown audit diff report between two versions."""
    lines = [
        f"# Strata Dataset Diff Audit Report",
        f"",
        f"- **Dataset:** {base_commit.get('dataset_name', 'Unknown')}",
        f"- **Base Version:** `{base_commit.get('version', 'v1.0.0')}` (`{base_commit.get('hash', '')}`)",
        f"- **Target Version:** `{target_commit.get('version', 'v1.1.0')}` (`{target_commit.get('hash', '')}`)",
        f"- **Generated At:** {base_commit.get('date', 'Now')}",
        f"",
        f"---",
        f"",
        f"## 1. Schema & Structural Changes",
        f"",
    ]

    schema_diff = detailed_diff.get("schema_diff", {})
    if schema_diff.get("identical_schema"):
        lines.append("✅ **Schema Identical**: No columns were added, removed, or changed type.")
    else:
        if schema_diff.get("added_columns"):
            lines.append(f"- **Added Columns:** {', '.join([f'`{c}`' for c in schema_diff['added_columns']])}")
        if schema_diff.get("removed_columns"):
            lines.append(f"- **Removed Columns:** {', '.join([f'`{c}`' for c in schema_diff['removed_columns']])}")
        if schema_diff.get("type_changes"):
            lines.append("- **Type Modifications:**")
            for tc in schema_diff["type_changes"]:
                lines.append(f"  - `{tc['column']}`: `{tc['old_type']}` → `{tc['new_type']}`")

    # Smart renames
    renames = detailed_diff.get("smart_renames", [])
    if renames:
        lines.append("")
        lines.append("### 🔍 Detected Column Renames")
        for r in renames:
            lines.append(f"- Renamed `{r['old_column']}` → `{r['new_column']}` (Confidence: {int(r['confidence']*100)}%)")

    # Row and Duplicate deltas
    lines.extend([
        f"",
        f"## 2. Row Volume & Duplicate Shifts",
        f"",
        f"- **Base Delta:** {base_commit.get('deltaRows', '+0 rows')}",
        f"- **Target Delta:** {target_commit.get('deltaRows', '+0 rows')}",
        f"- **Duplicate Rows:** Base: {detailed_diff.get('missing_and_duplicates', {}).get('duplicate_rows', {}).get('v1', 0)} | Target: {detailed_diff.get('missing_and_duplicates', {}).get('duplicate_rows', {}).get('v2', 0)}",
        f"",
        f"## 3. Statistical Distribution Drift",
        f"",
    ])

    dist_shifts = detailed_diff.get("distribution_shifts", {})
    if dist_shifts:
        lines.append("| Column | Mean Drift | Median Drift | Variance Drift | IQR Drift | Severity |")
        lines.append("|---|---|---|---|---|---|")
        for col, d in dist_shifts.items():
            lines.append(f"| `{col}` | {d['mean']['delta']:+g} | {d['median']['delta']:+g} | {d['variance']['delta']:+g} | {d['iqr']['delta']:+g} | {d['shift_severity'].upper()} |")
    else:
        lines.append("No significant numerical distribution shifts detected.")

    # Domain shifts
    domain_shifts = detailed_diff.get("categorical_domain_shifts", {})
    if domain_shifts:
        lines.extend([
            f"",
            f"## 4. Categorical Domain Shifts",
            f"",
        ])
        for col, sh in domain_shifts.items():
            lines.append(f"- **`{col}`**:")
            if sh["added_categories"]:
                lines.append(f"  - New classes: {', '.join([f'`{c}`' for c in sh['added_categories']])}")
            if sh["dropped_categories"]:
                lines.append(f"  - Dropped classes: {', '.join([f'`{c}`' for c in sh['dropped_categories']])}")

    lines.extend([
        f"",
        f"---",
        f"*Report certified by Strata Provenance & Diffing Engine.*",
    ])
    return "\n".join(lines)

