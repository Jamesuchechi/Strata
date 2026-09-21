"""Scientific and domain format parsers (PubChem SDF, MOL)."""

import re
from typing import Any, Dict, List
import pyarrow as pa
from strata_api.parsers.base import BaseParser


class ScientificParser(BaseParser):
    """Parser for scientific molecular structures and chemical data (PubChem SDF/MOL)."""

    def parse_preview(self, file_path: str, limit: int = 50) -> Dict[str, Any]:
        """Extract compound records, 2D coordinates, bonds, and properties from SDF/MOL files."""
        records = []
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        raw_mols = [m for m in content.split("$$$$\n") if m.strip()][:limit]
        molecules_data = []

        for idx, mol in enumerate(raw_mols):
            lines = [line.rstrip() for line in mol.strip().split("\n")]
            if len(lines) < 4:
                continue

            title = lines[0].strip() or f"Compound #{idx+1}"

            # Parse properties (e.g. > <PUBCHEM_COMPOUND_CID>)
            props: Dict[str, Any] = {}
            current_tag = None
            for line in lines:
                tag_match = re.match(r"^>\s*<([^>]+)>", line)
                if tag_match:
                    current_tag = tag_match.group(1).lower().replace(" ", "_")
                elif current_tag and line.strip() and not line.startswith(">"):
                    props[current_tag] = line.strip()
                    current_tag = None

            # Parse Counts line (usually line 4)
            num_atoms, num_bonds = 0, 0
            atoms: List[Dict[str, Any]] = []
            bonds: List[Dict[str, Any]] = []

            counts_line_idx = -1
            for l_idx in range(3, min(len(lines), 6)):
                if "V2000" in lines[l_idx] or "v2000" in lines[l_idx].lower():
                    counts_line_idx = l_idx
                    break

            if counts_line_idx != -1:
                cline = lines[counts_line_idx]
                try:
                    num_atoms = int(cline[0:3].strip())
                    num_bonds = int(cline[3:6].strip())
                except Exception:
                    pass

                # Parse Atom Block
                atom_start = counts_line_idx + 1
                atom_end = atom_start + num_atoms
                for a_idx in range(atom_start, min(atom_end, len(lines))):
                    aline = lines[a_idx]
                    parts = aline.split()
                    if len(parts) >= 4:
                        try:
                            x = float(parts[0])
                            y = float(parts[1])
                            z = float(parts[2]) if len(parts) > 2 else 0.0
                            sym = parts[3]
                            atoms.append({"index": len(atoms) + 1, "x": x, "y": y, "z": z, "symbol": sym})
                        except Exception:
                            pass

                # Parse Bond Block
                bond_start = atom_end
                bond_end = bond_start + num_bonds
                for b_idx in range(bond_start, min(bond_end, len(lines))):
                    bline = lines[b_idx]
                    parts = bline.split()
                    if len(parts) >= 3:
                        try:
                            a1 = int(parts[0])
                            a2 = int(parts[1])
                            btype = int(parts[2])
                            bonds.append({"source": a1, "target": a2, "type": btype})
                        except Exception:
                            pass

            rec = {
                "compound_id": props.get("pubchem_compound_cid", f"CID-{idx+1}"),
                "title": title,
                "formula": props.get("pubchem_molecular_formula", ""),
                "molecular_weight": props.get("pubchem_molecular_weight", ""),
                "smiles": props.get("pubchem_openeye_can_smiles", ""),
                "atom_count": len(atoms),
                "bond_count": len(bonds),
                **props,
            }
            records.append(rec)

            if len(molecules_data) < 10:
                molecules_data.append({
                    "id": rec["compound_id"],
                    "title": title,
                    "atoms": atoms,
                    "bonds": bonds,
                    "properties": props,
                })

        schema = [
            {"name": "compound_id", "type": "string"},
            {"name": "title", "type": "string"},
            {"name": "formula", "type": "string"},
            {"name": "molecular_weight", "type": "string"},
            {"name": "smiles", "type": "string"},
            {"name": "atom_count", "type": "int64"},
            {"name": "bond_count", "type": "int64"},
        ]

        return {
            "format": "scientific_sdf",
            "schema": schema,
            "total_rows": len(raw_mols),
            "total_columns": len(schema),
            "preview_rows": records,
            "molecules_data": molecules_data,
        }

    def to_arrow(self, file_path: str) -> pa.Table:
        preview = self.parse_preview(file_path, limit=1000)
        return pa.Table.from_pylist(preview["preview_rows"])
