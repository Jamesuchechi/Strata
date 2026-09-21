"""Excel workbook parser with multi-sheet support."""

from typing import Any, Dict, List
import openpyxl
import pandas as pd
import pyarrow as pa
from strata_api.parsers.base import BaseParser


class ExcelParser(BaseParser):
    """Parser for Excel workbooks extracting sheet metadata and previews."""

    def parse_preview(self, file_path: str, limit: int = 100) -> Dict[str, Any]:
        """Inspect sheet names and return preview of the first sheet."""
        wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
        sheet_names = wb.sheetnames
        wb.close()

        first_sheet = sheet_names[0] if sheet_names else "Sheet1"
        df = pd.read_excel(file_path, sheet_name=first_sheet, nrows=limit)
        schema = [{"name": str(col), "type": str(dtype)} for col, dtype in zip(df.columns, df.dtypes)]

        return {
            "format": "excel",
            "sheets": sheet_names,
            "active_sheet": first_sheet,
            "schema": schema,
            "total_rows": len(df),
            "total_columns": len(schema),
            "preview_rows": df.where(pd.notnull(df), None).to_dict(orient="records"),
        }

    def parse_sheet(self, file_path: str, sheet_name: str, limit: int = 100) -> Dict[str, Any]:
        """Extract preview for a specific sheet."""
        df = pd.read_excel(file_path, sheet_name=sheet_name, nrows=limit)
        schema = [{"name": str(col), "type": str(dtype)} for col, dtype in zip(df.columns, df.dtypes)]
        return {
            "sheet_name": sheet_name,
            "schema": schema,
            "preview_rows": df.where(pd.notnull(df), None).to_dict(orient="records"),
        }

    def to_arrow(self, file_path: str) -> pa.Table:
        df = pd.read_excel(file_path)
        return pa.Table.from_pandas(df)
