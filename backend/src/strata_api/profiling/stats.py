"""Instant profiling & micro-statistics engine."""

from typing import Any, Dict, List
import polars as pl


def compute_column_microstats(df: pl.DataFrame) -> List[Dict[str, Any]]:
    """Compute instant column stats (null count, distinct count, data type, min/max)."""
    stats = []
    total_rows = len(df)

    for col in df.columns:
        series = df[col]
        null_count = series.null_count()
        null_pct = round((null_count / total_rows * 100), 2) if total_rows > 0 else 0.0
        n_unique = series.n_unique()

        col_stat: Dict[str, Any] = {
            "name": col,
            "type": str(series.dtype),
            "null_count": null_count,
            "null_pct": null_pct,
            "distinct_count": n_unique,
            "is_unique": n_unique == total_rows,
        }

        if series.dtype.is_numeric() and total_rows > 0 and series.drop_nulls().len() > 0:
            clean = series.drop_nulls()
            col_min = float(clean.min()) if clean.min() is not None else 0.0
            col_max = float(clean.max()) if clean.max() is not None else 0.0
            col_stat["min"] = col_min
            col_stat["max"] = col_max
            col_stat["mean"] = round(float(clean.mean()), 2) if clean.mean() is not None else 0.0
            col_stat["median"] = round(float(clean.median()), 2) if clean.median() is not None else 0.0

            # 10-bucket distribution sparkline
            if col_max > col_min:
                step = (col_max - col_min) / 10
                bins = [0] * 10
                for v in clean.to_list()[:1000]:
                    if v is not None:
                        idx = min(max(int((float(v) - col_min) / step), 0), 9)
                        bins[idx] += 1
                col_stat["sparkline"] = bins
                col_stat["distribution"] = bins
            else:
                col_stat["sparkline"] = [len(clean)] + [0] * 9
                col_stat["distribution"] = col_stat["sparkline"]
        else:
            # For non-numeric / categorical columns: compute real frequency of top categories if low cardinality
            if 0 < n_unique <= 10 and total_rows > 0:
                vc = series.value_counts()
                counts = [int(row[1]) for row in vc.rows()[:10]]
                col_stat["sparkline"] = counts
                col_stat["distribution"] = counts
            else:
                col_stat["sparkline"] = []
                col_stat["distribution"] = []

        stats.append(col_stat)

    return stats
