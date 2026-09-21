"""Scientific and domain format parsers (PubChem SDF, MOL, FASTA)."""

from typing import Any, Dict
import pyarrow as pa
from strata_api.parsers.base import BaseParser


class ScientificParser(BaseParser):
    """Parser for scientific molecular structures and chemical data (PubChem SDF/MOL)."""

    def parse_preview(self, file_path: str, limit: int = 50) -> Dict[str, Any]:
        """Extract compound records and molecular properties from SDF/MOL files."""
        records = []
        with open(file_path, "r", errors="ignore") as f:
            content = f.read()

        # Simple SDF record splitter on '$$$$'
        raw_mols = content.split("$$$$\n")[:limit]
        for idx, mol in enumerate(raw_mols):
            if not mol.strip():
                continue
            lines = mol.strip().split("\n")
            compound_id = lines[0].strip() if lines else f"MOL_{idx+1}"
            records.append({
                "index": idx + 1,
                "compound_id": compound_id,
                "lines_count": len(lines),
                "structure_preview": "\n".join(lines[:10]),
            })

        schema = [
            {"name": "index", "type": "int64"},
            {"name": "compound_id", "type": "string"},
            {"name": "lines_count", "type": "int64"},
            {"name": "structure_preview", "type": "string"},
        ]

        return {
            "format": "scientific_sdf",
            "schema": schema,
            "total_compounds": len(raw_mols),
            "preview_rows": records,
        }

    def to_arrow(self, file_path: str) -> pa.Table:
        preview = self.parse_preview(file_path, limit=1000)
        return pa.Table.from_pylist(preview["preview_rows"])
