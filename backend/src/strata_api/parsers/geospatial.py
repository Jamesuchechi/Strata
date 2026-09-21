"""Geospatial vector format parser (GeoJSON)."""

import json
from typing import Any, Dict, List
import pyarrow as pa
from strata_api.parsers.base import BaseParser


class GeospatialParser(BaseParser):
    """Parser for geospatial layers (GeoJSON)."""

    def parse_preview(self, file_path: str, limit: int = 200) -> Dict[str, Any]:
        """Parse GeoJSON feature collection and extract feature properties, coordinates, and bounding box."""
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            data = json.load(f)

        features = data.get("features", [])
        if not features and data.get("type") in ("Feature", "Point", "Polygon"):
            features = [data]

        rows = []
        schema_fields = set()
        geometries: List[Dict[str, Any]] = []

        min_lon, min_lat = 180.0, 90.0
        max_lon, max_lat = -180.0, -90.0
        total_points = 0

        for idx, feat in enumerate(features[:limit]):
            props = feat.get("properties", {}) or {}
            geom = feat.get("geometry") or {}
            geom_type = geom.get("type", "Unknown")
            coords = geom.get("coordinates", [])

            # Flatten coordinates to compute bounding box
            def update_bounds(c):
                nonlocal min_lon, min_lat, max_lon, max_lat, total_points
                if isinstance(c, (list, tuple)) and len(c) >= 2 and isinstance(c[0], (int, float)):
                    lon, lat = float(c[0]), float(c[1])
                    min_lon = min(min_lon, lon)
                    max_lon = max(max_lon, lon)
                    min_lat = min(min_lat, lat)
                    max_lat = max(max_lat, lat)
                    total_points += 1
                elif isinstance(c, (list, tuple)):
                    for sub in c:
                        update_bounds(sub)

            update_bounds(coords)

            row = {
                "feature_id": idx + 1,
                "geom_type": geom_type,
                **props,
            }
            schema_fields.update(row.keys())
            rows.append(row)

            if len(geometries) < 50:
                geometries.append({
                    "id": idx + 1,
                    "type": geom_type,
                    "coordinates": coords,
                    "properties": props,
                })

        schema = [{"name": field, "type": "string" if field != "feature_id" else "int64"} for field in sorted(schema_fields)]

        center_lat = (min_lat + max_lat) / 2 if total_points > 0 else 0.0
        center_lon = (min_lon + max_lon) / 2 if total_points > 0 else 0.0

        return {
            "format": "geojson",
            "type": data.get("type", "FeatureCollection"),
            "schema": schema,
            "total_rows": len(features),
            "total_columns": len(schema),
            "preview_rows": rows,
            "geo_metadata": {
                "bounds": [min_lon, min_lat, max_lon, max_lat] if total_points > 0 else [-180, -90, 180, 90],
                "center": [center_lon, center_lat],
                "sample_geometries": geometries,
            },
        }

    def to_arrow(self, file_path: str) -> pa.Table:
        preview = self.parse_preview(file_path, limit=2000)
        return pa.Table.from_pylist(preview["preview_rows"])
