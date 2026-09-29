"""Scientific and domain format parsers (PubChem SDF, MOL) using RDKit."""

import math
from typing import Any, Dict, List, Optional
import pyarrow as pa
from rdkit import Chem
from rdkit.Chem import rdMolDescriptors, rdDepictor
from strata_api.parsers.base import BaseParser


class ScientificParser(BaseParser):
    """Parser for scientific molecular structures and chemical data (PubChem SDF/MOL)."""

    def parse_preview(self, file_path: str, limit: int = 100) -> Dict[str, Any]:
        """Extract compound records, 2D coordinates, bonds, and chemical properties using RDKit."""
        records: List[Dict[str, Any]] = []
        molecules_data: List[Dict[str, Any]] = []
        is_mol = file_path.lower().endswith(".mol")

        if is_mol:
            mol = Chem.MolFromMolFile(file_path, removeHs=False)
            mols = [mol] if mol is not None else []
        else:
            # SDF file - supplier
            suppl = Chem.SDMolSupplier(file_path, removeHs=False)
            mols = []
            for m in suppl:
                if m is not None:
                    mols.append(m)
                if len(mols) >= limit:
                    break

        for idx, mol in enumerate(mols):
            # Extract raw SDF tags
            props: Dict[str, Any] = {}
            for prop_name in mol.GetPropNames():
                props[prop_name.lower().replace(" ", "_")] = mol.GetProp(prop_name)

            # Compute real chemical descriptors via RDKit
            try:
                formula = rdMolDescriptors.CalcMolFormula(mol)
            except Exception:
                formula = props.get("pubchem_molecular_formula", "")

            try:
                mol_wt = round(float(rdMolDescriptors.CalcExactMolWt(mol)), 3)
            except Exception:
                mol_wt = float(props.get("pubchem_molecular_weight", 0.0) or 0.0)

            try:
                log_p = round(float(rdMolDescriptors.CalcCrippenDescriptors(mol)[0]), 3)
            except Exception:
                log_p = 0.0

            try:
                num_hbd = int(rdMolDescriptors.CalcNumHBD(mol))
                num_hba = int(rdMolDescriptors.CalcNumHBA(mol))
                rotatable_bonds = int(rdMolDescriptors.CalcNumRotatableBonds(mol))
            except Exception:
                num_hbd, num_hba, rotatable_bonds = 0, 0, 0

            try:
                tpsa = round(float(rdMolDescriptors.CalcTPSA(mol)), 2)
            except Exception:
                tpsa = 0.0

            try:
                smiles = Chem.MolToSmiles(mol)
            except Exception:
                smiles = props.get("pubchem_openeye_can_smiles", "")

            num_atoms = mol.GetNumAtoms()
            num_bonds = mol.GetNumBonds()
            num_rings = mol.GetRingInfo().NumRings() if mol.GetRingInfo() else 0

            # 2D coordinates extraction
            if mol.GetNumConformers() == 0:
                try:
                    rdDepictor.Compute2DCoords(mol)
                except Exception:
                    pass

            conf = mol.GetConformer() if mol.GetNumConformers() > 0 else None
            atoms: List[Dict[str, Any]] = []
            for atom_idx, atom in enumerate(mol.GetAtoms()):
                sym = atom.GetSymbol()
                if conf:
                    pos = conf.GetAtomPosition(atom_idx)
                    x, y, z = round(float(pos.x), 3), round(float(pos.y), 3), round(float(pos.z), 3)
                else:
                    x, y, z = 0.0, 0.0, 0.0
                atoms.append({
                    "index": atom_idx + 1,
                    "symbol": sym,
                    "atomic_num": atom.GetAtomicNum(),
                    "formal_charge": atom.GetFormalCharge(),
                    "x": x,
                    "y": y,
                    "z": z,
                })

            bonds: List[Dict[str, Any]] = []
            for bond in mol.GetBonds():
                bonds.append({
                    "source": bond.GetBeginAtomIdx() + 1,
                    "target": bond.GetEndAtomIdx() + 1,
                    "type": int(bond.GetBondTypeAsDouble()),
                    "is_aromatic": bool(bond.GetIsAromatic()),
                })

            title = mol.GetProp("_Name") if mol.HasProp("_Name") and mol.GetProp("_Name").strip() else (
                props.get("pubchem_iupac_name") or props.get("compound_title") or f"Compound #{idx+1}"
            )
            compound_id = props.get("pubchem_compound_cid") or props.get("cd_id") or f"CID-{idx+1}"

            rec = {
                "compound_id": compound_id,
                "title": title,
                "formula": formula,
                "molecular_weight": mol_wt,
                "log_p": log_p,
                "h_bond_donors": num_hbd,
                "h_bond_acceptors": num_hba,
                "rotatable_bonds": rotatable_bonds,
                "tpsa": tpsa,
                "smiles": smiles,
                "atom_count": num_atoms,
                "bond_count": num_bonds,
                "ring_count": num_rings,
                **props,
            }
            records.append(rec)

            if len(molecules_data) < 20:
                molecules_data.append({
                    "id": compound_id,
                    "title": title,
                    "formula": formula,
                    "molecular_weight": mol_wt,
                    "log_p": log_p,
                    "tpsa": tpsa,
                    "smiles": smiles,
                    "atoms": atoms,
                    "bonds": bonds,
                    "properties": props,
                })

        schema = [
            {"name": "compound_id", "type": "string"},
            {"name": "title", "type": "string"},
            {"name": "formula", "type": "string"},
            {"name": "molecular_weight", "type": "float64"},
            {"name": "log_p", "type": "float64"},
            {"name": "h_bond_donors", "type": "int64"},
            {"name": "h_bond_acceptors", "type": "int64"},
            {"name": "rotatable_bonds", "type": "int64"},
            {"name": "tpsa", "type": "float64"},
            {"name": "smiles", "type": "string"},
            {"name": "atom_count", "type": "int64"},
            {"name": "bond_count", "type": "int64"},
            {"name": "ring_count", "type": "int64"},
        ]

        return {
            "format": "scientific_sdf",
            "schema": schema,
            "total_rows": len(mols),
            "total_columns": len(schema),
            "preview_rows": records,
            "molecules_data": molecules_data,
        }

    def to_arrow(self, file_path: str) -> pa.Table:
        preview = self.parse_preview(file_path, limit=2000)
        return pa.Table.from_pylist(preview["preview_rows"])
