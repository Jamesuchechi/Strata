"""Geospatial vector format parser (GeoJSON, Shapefile, GeoPackage) using GeoPandas and Shapely."""

import json
from typing import Any, Dict, List
import pyarrow as pa
import geopandas as gpd
import shapely.geometry
from strata_api.parsers.base import BaseParser


class GeospatialParser(BaseParser):
    """Parser for geospatial layers (GeoJSON, Shapefiles, GeoPackage) via GeoPandas and Shapely."""

    def parse_preview(self, file_path: str, limit: int = 200) -> Dict[str, Any]:
        """Parse geospatial vector layers with CRS validation, boundary calculation, and geometry validation."""
        gdf = gpd.read_file(file_path)

        total_features = len(gdf)
        crs_str = gdf.crs.to_string() if gdf.crs else "EPSG:4326"

        # Check geometry validity with Shapely
        has_geometry = hasattr(gdf, "geometry") and gdf.geometry is not None and not gdf.empty
        valid_count = int(gdf.geometry.is_valid.sum()) if has_geometry else 0
        empty_count = int(gdf.geometry.is_empty.sum()) if has_geometry else 0

        # Calculate bounding box
        if not gdf.empty and hasattr(gdf, "total_bounds") and gdf.total_bounds is not None:
            tb = gdf.total_bounds
            bounds = [round(float(tb[0]), 6), round(float(tb[1]), 6), round(float(tb[2]), 6), round(float(tb[3]), 6)]
        else:
            bounds = [-180.0, -90.0, 180.0, 90.0]

        center_lon = round((bounds[0] + bounds[2]) / 2.0, 6)
        center_lat = round((bounds[1] + bounds[3]) / 2.0, 6)

        # Geometry breakdown
        geom_type_counts = {}
        if hasattr(gdf, "geom_type") and gdf.geom_type is not None:
            for gt, cnt in gdf.geom_type.value_counts().items():
                geom_type_counts[str(gt)] = int(cnt)

        sample_geometries: List[Dict[str, Any]] = []
        preview_rows: List[Dict[str, Any]] = []
        schema_fields = set(["feature_id", "geom_type", "geom_wkt", "is_valid"])

        subset = gdf.head(limit)
        for idx, row in subset.iterrows():
            geom = row.geometry if hasattr(row, "geometry") else None
            geom_type = geom.geom_type if geom is not None else "Unknown"
            is_valid = bool(geom.is_valid) if geom is not None else False
            wkt_str = geom.wkt[:100] + ("..." if len(geom.wkt) > 100 else "") if geom is not None else ""

            # Extract properties (excluding geometry column)
            props: Dict[str, Any] = {}
            for col_name, val in row.items():
                col_key = str(col_name)
                if col_key == "geometry":
                    continue
                if hasattr(val, "isoformat"):
                    props[col_key] = val.isoformat()
                elif isinstance(val, (int, float, bool, str)) or val is None:
                    props[col_key] = val
                else:
                    props[col_key] = str(val)

            row_dict = {
                "feature_id": int(idx) + 1 if isinstance(idx, (int, float)) else str(idx),
                "geom_type": geom_type,
                "geom_wkt": wkt_str,
                "is_valid": is_valid,
                **props,
            }
            schema_fields.update(row_dict.keys())
            preview_rows.append(row_dict)

            if len(sample_geometries) < 50:
                geom_mapping = shapely.geometry.mapping(geom) if geom is not None and not geom.is_empty else None
                sample_geometries.append({
                    "id": row_dict["feature_id"],
                    "type": geom_type,
                    "is_valid": is_valid,
                    "coordinates": geom_mapping.get("coordinates") if geom_mapping else [],
                    "properties": props,
                })

        schema = [
            {"name": field, "type": "int64" if field == "feature_id" else ("bool" if field == "is_valid" else "string")}
            for field in sorted(schema_fields)
        ]

        return {
            "format": "geojson",
            "schema": schema,
            "total_rows": total_features,
            "total_columns": len(schema),
            "preview_rows": preview_rows,
            "geo_metadata": {
                "crs": crs_str,
                "bounds": bounds,
                "center": [center_lon, center_lat],
                "valid_geometries_count": valid_count,
                "empty_geometries_count": empty_count,
                "geom_type_counts": geom_type_counts,
                "sample_geometries": sample_geometries,
            },
        }

    def to_arrow(self, file_path: str) -> pa.Table:
        preview = self.parse_preview(file_path, limit=2000)
        return pa.Table.from_pylist(preview["preview_rows"])
