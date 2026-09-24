"""Strata Data Transformation Engine.

Executes point-and-click wrangling operations on Polars DataFrames,
computes transformation deltas, and generates reproducible Python scripts.
"""

from typing import Any, Dict, List, Tuple
import polars as pl
from strata_api.schemas.dataset import TransformOperation


def execute_transformations(
    df: pl.DataFrame,
    operations: List[TransformOperation],
) -> Tuple[pl.DataFrame, str]:
    """Apply a sequence of wrangling operations to a Polars DataFrame.

    Returns the transformed DataFrame and a clean, copyable Python Polars script.
    """
    code_lines = [
        "import polars as pl",
        "",
        "# Load dataset",
        "df = pl.read_parquet('dataset.parquet')  # or pl.read_csv('dataset.csv')",
        "",
        "# Apply Strata Wrangling Recipe",
    ]

    transformed_df = df.clone()

    for op in operations:
        if op.op == "drop_nulls":
            if op.columns:
                transformed_df = transformed_df.drop_nulls(subset=op.columns)
                code_lines.append(f"df = df.drop_nulls(subset={repr(op.columns)})")
            elif op.column:
                transformed_df = transformed_df.drop_nulls(subset=[op.column])
                code_lines.append(f"df = df.drop_nulls(subset=[{repr(op.column)}])")
            else:
                transformed_df = transformed_df.drop_nulls()
                code_lines.append("df = df.drop_nulls()")

        elif op.op == "fill_null":
            col = op.column
            if not col or col not in transformed_df.columns:
                continue

            strat = op.strategy or "zero"
            if strat == "mean":
                mean_val = transformed_df[col].mean()
                transformed_df = transformed_df.with_columns(
                    pl.col(col).fill_null(mean_val)
                )
                code_lines.append(f"df = df.with_columns(pl.col({repr(col)}).fill_null(pl.col({repr(col)}).mean()))")
            elif strat == "median":
                median_val = transformed_df[col].median()
                transformed_df = transformed_df.with_columns(
                    pl.col(col).fill_null(median_val)
                )
                code_lines.append(f"df = df.with_columns(pl.col({repr(col)}).fill_null(pl.col({repr(col)}).median()))")
            elif strat == "mode":
                mode_vals = transformed_df[col].mode()
                mode_val = mode_vals[0] if len(mode_vals) > 0 else 0
                transformed_df = transformed_df.with_columns(
                    pl.col(col).fill_null(mode_val)
                )
                code_lines.append(f"df = df.with_columns(pl.col({repr(col)}).fill_null(pl.col({repr(col)}).mode()[0]))")
            elif strat == "forward":
                transformed_df = transformed_df.with_columns(
                    pl.col(col).fill_null(strategy="forward")
                )
                code_lines.append(f"df = df.with_columns(pl.col({repr(col)}).fill_null(strategy='forward'))")
            elif strat == "custom" and op.value is not None:
                transformed_df = transformed_df.with_columns(
                    pl.col(col).fill_null(op.value)
                )
                code_lines.append(f"df = df.with_columns(pl.col({repr(col)}).fill_null({repr(op.value)}))")
            else:  # zero or default
                fill_val = 0 if transformed_df[col].dtype.is_numeric() else ""
                transformed_df = transformed_df.with_columns(
                    pl.col(col).fill_null(fill_val)
                )
                code_lines.append(f"df = df.with_columns(pl.col({repr(col)}).fill_null({repr(fill_val)}))")

        elif op.op == "trim_whitespace":
            cols_to_trim = op.columns or ([op.column] if op.column else [])
            if not cols_to_trim:
                # Trim all string columns
                cols_to_trim = [
                    c for c, dt in zip(transformed_df.columns, transformed_df.dtypes)
                    if dt in (pl.String, pl.Utf8, pl.Categorical)
                ]
            for col in cols_to_trim:
                if col in transformed_df.columns and transformed_df[col].dtype in (pl.String, pl.Utf8):
                    transformed_df = transformed_df.with_columns(
                        pl.col(col).str.strip_chars()
                    )
            code_lines.append(f"for c in {repr(cols_to_trim)}:")
            code_lines.append("    if df[c].dtype == pl.String: df = df.with_columns(pl.col(c).str.strip_chars())")

        elif op.op == "drop_duplicates":
            subset = op.columns or ([op.column] if op.column else None)
            transformed_df = transformed_df.unique(subset=subset)
            if subset:
                code_lines.append(f"df = df.unique(subset={repr(subset)})")
            else:
                code_lines.append("df = df.unique()")

        elif op.op == "cast_type":
            col = op.column
            tgt = op.target_type or "String"
            if col and col in transformed_df.columns:
                type_map = {
                    "Int64": pl.Int64,
                    "Float64": pl.Float64,
                    "String": pl.String,
                    "Boolean": pl.Boolean,
                    "Date": pl.Date,
                }
                pl_type = type_map.get(tgt, pl.String)
                try:
                    transformed_df = transformed_df.with_columns(
                        pl.col(col).cast(pl_type, strict=False)
                    )
                    code_lines.append(f"df = df.with_columns(pl.col({repr(col)}).cast(pl.{tgt}, strict=False))")
                except Exception:
                    pass

        elif op.op == "filter_rows":
            col = op.column
            op_str = op.operator or "=="
            val = op.value
            if col and col in transformed_df.columns and val is not None:
                try:
                    if op_str == ">":
                        transformed_df = transformed_df.filter(pl.col(col) > val)
                    elif op_str == "<":
                        transformed_df = transformed_df.filter(pl.col(col) < val)
                    elif op_str == ">=":
                        transformed_df = transformed_df.filter(pl.col(col) >= val)
                    elif op_str == "<=":
                        transformed_df = transformed_df.filter(pl.col(col) <= val)
                    elif op_str == "==":
                        transformed_df = transformed_df.filter(pl.col(col) == val)
                    elif op_str == "!=":
                        transformed_df = transformed_df.filter(pl.col(col) != val)
                    code_lines.append(f"df = df.filter(pl.col({repr(col)}) {op_str} {repr(val)})")
                except Exception:
                    pass

        elif op.op in ("custom_code", "python", "python_script", "script"):
            from strata_api.core.sandbox import run_sandboxed_code, validate_safe_code

            code_to_run = op.code or (op.value if isinstance(op.value, str) else "")
            validate_safe_code(code_to_run)
            transformed_df = run_sandboxed_code(code_to_run, transformed_df)
            code_lines.append(f"# Custom Python transformation\n{code_to_run}")

    code_lines.append("")
    code_lines.append("# Save cleaned dataset")
    code_lines.append("df.write_parquet('cleaned_dataset.parquet')")
    code_lines.append("print(f'Transformed dataset shape: {df.shape}')")

    python_script = "\n".join(code_lines)
    return transformed_df, python_script
