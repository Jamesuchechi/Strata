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

        if series.dtype.is_numeric() and total_rows > 0:
            col_stat["min"] = float(series.min()) if series.min() is not None else None
            col_stat["max"] = float(series.max()) if series.max() is not None else None
            col_stat["mean"] = float(series.mean()) if series.mean() is not None else None

        stats.append(col_stat)

    return stats
