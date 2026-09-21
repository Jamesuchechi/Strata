"""Geospatial vector format parser (GeoJSON)."""

import json
from typing import Any, Dict
import pyarrow as pa
from strata_api.parsers.base import BaseParser


class GeospatialParser(BaseParser):
    """Parser for geospatial layers (GeoJSON)."""

    def parse_preview(self, file_path: str, limit: int = 100) -> Dict[str, Any]:
        """Parse GeoJSON feature collection and extract feature properties."""
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            data = json.load(f)

        features = data.get("features", [])[:limit]
        rows = []
        schema_fields = set()

        for idx, feat in enumerate(features):
            props = feat.get("properties", {}) or {}
            geom_type = feat.get("geometry", {}).get("type", "Unknown") if feat.get("geometry") else "None"
            row = {"id": idx + 1, "geom_type": geom_type, **props}
            schema_fields.update(row.keys())
            rows.append(row)

        schema = [{"name": field, "type": "string"} for field in sorted(schema_fields)]

        return {
            "format": "geojson",
            "type": data.get("type", "FeatureCollection"),
            "schema": schema,
            "total_features": len(features),
            "preview_rows": rows,
        }

    def to_arrow(self, file_path: str) -> pa.Table:
        preview = self.parse_preview(file_path, limit=1000)
        return pa.Table.from_pylist(preview["preview_rows"])
