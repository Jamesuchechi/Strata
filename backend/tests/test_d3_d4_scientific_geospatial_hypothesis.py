"""Acceptance tests for Phase D Task D3 (Scientific & Geospatial Parsing) and Task D4 (Hypothesis Testing)."""

import json
import os
import tempfile
import pytest
import numpy as np
import pandas as pd
from scipy import stats
from fastapi.testclient import TestClient

from strata_api.main import create_app
from strata_api.parsers.scientific import ScientificParser
from strata_api.parsers.geospatial import GeospatialParser
from strata_api.parsers import get_parser_for_file
from strata_api.routers.datasets import _datasets_db
from tests.conftest import AUTH_HEADERS_A, TEST_USER_A_ID

client = TestClient(create_app(), headers=AUTH_HEADERS_A)


# ---------------------------------------------------------------------------
# Sample Test Fixtures
# ---------------------------------------------------------------------------

# Real PubChem-style SDF record (Aspirin & Paracetamol / Acetaminophen)
SAMPLE_PUBCHEM_SDF = """2244
  -OEChem-09292610442D

 13 13  0     0  0  0  0  0  0999 V2000
    2.8660    0.0000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0
    2.0000    0.5000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    2.0000    1.5000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0
    1.1340    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    0.2679    0.5000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
   -0.5981    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
   -0.5981   -1.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    0.2679   -1.5000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.1340   -1.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    0.2679    1.5000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
   -0.5981    2.0000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0
    1.1340    2.0000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0
   -1.4641    0.5000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
  2  3  2  0  0  0  0
  2  4  1  0  0  0  0
  4  5  2  0  0  0  0
  5  6  1  0  0  0  0
  6  7  2  0  0  0  0
  7  8  1  0  0  0  0
  8  9  2  0  0  0  0
  9  4  1  0  0  0  0
  5 10  1  0  0  0  0
 10 11  2  0  0  0  0
 10 12  1  0  0  0  0
  6 13  1  0  0  0  0
M  END
> <PUBCHEM_COMPOUND_CID>
2244

> <PUBCHEM_MOLECULAR_FORMULA>
C9H8O4

> <PUBCHEM_MOLECULAR_WEIGHT>
180.16

> <PUBCHEM_IUPAC_NAME>
2-acetyloxybenzoic acid

> <PUBCHEM_OPENEYE_CAN_SMILES>
CC(=O)OC1=CC=CC=C1C(=O)O

$$$$
1983
  -OEChem-09292610442D

 11 11  0     0  0  0  0  0  0999 V2000
    2.8660    0.0000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0
    2.0000    0.5000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    2.0000    1.5000    0.0000 N   0  0  0  0  0  0  0  0  0  0  0  0
    1.1340    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    0.2679    0.5000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
   -0.5981    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
   -0.5981   -1.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    0.2679   -1.5000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.1340   -1.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
   -1.4641   -1.5000    0.0000 O   0  0  0  0  0  0  0  0  0  0  0  0
    1.1340    2.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  2  0  0  0  0
  2  3  1  0  0  0  0
  2 11  1  0  0  0  0
  3  4  1  0  0  0  0
  4  5  2  0  0  0  0
  5  6  1  0  0  0  0
  6  7  2  0  0  0  0
  7  8  1  0  0  0  0
  8  9  2  0  0  0  0
  9  4  1  0  0  0  0
  7 10  1  0  0  0  0
M  END
> <PUBCHEM_COMPOUND_CID>
1983

> <PUBCHEM_MOLECULAR_FORMULA>
C8H9NO2

> <PUBCHEM_MOLECULAR_WEIGHT>
151.16

> <PUBCHEM_IUPAC_NAME>
N-(4-hydroxyphenyl)acetamide

> <PUBCHEM_OPENEYE_CAN_SMILES>
CC(=O)NC1=CC=C(C=C1)O

$$$$
"""

# Multi-geometry GeoJSON sample with Polygon, Point, and LineString
SAMPLE_GEOJSON = {
    "type": "FeatureCollection",
    "crs": {
        "type": "name",
        "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}
    },
    "features": [
        {
            "type": "Feature",
            "properties": {"name": "Central Park", "category": "Park", "area_sqkm": 3.41},
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [-73.9818, 40.7681],
                        [-73.9582, 40.8005],
                        [-73.9493, 40.7968],
                        [-73.9730, 40.7644],
                        [-73.9818, 40.7681],
                    ]
                ]
            }
        },
        {
            "type": "Feature",
            "properties": {"name": "Empire State Building", "category": "Landmark", "height_m": 381},
            "geometry": {
                "type": "Point",
                "coordinates": [-73.9857, 40.7484]
            }
        },
        {
            "type": "Feature",
            "properties": {"name": "Broadway Transit Corridor", "category": "Transit", "lanes": 2},
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [-73.9851, 40.7589],
                    [-73.9872, 40.7530],
                    [-73.9890, 40.7470],
                ]
            }
        }
    ]
}


# ---------------------------------------------------------------------------
# D3: Scientific & Geospatial Parsing Acceptance Tests
# ---------------------------------------------------------------------------

def test_d3_scientific_parser_rdkit():
    """Acceptance test: parse real PubChem SDF sample via RDKit and assert compound count and physicochemical descriptors."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".sdf", delete=False) as f:
        f.write(SAMPLE_PUBCHEM_SDF)
        temp_sdf_path = f.name

    try:
        parser = get_parser_for_file(temp_sdf_path)
        assert isinstance(parser, ScientificParser)

        res = parser.parse_preview(temp_sdf_path)
        assert res["format"] == "scientific_sdf"
        assert res["total_rows"] == 2
        assert len(res["preview_rows"]) == 2

        # Verify compound 1 (Aspirin - CID 2244)
        c1 = res["preview_rows"][0]
        assert c1["compound_id"] == "2244"
        assert "C9H8O4" in c1["formula"]
        assert 180.0 <= c1["molecular_weight"] <= 180.3
        assert c1["atom_count"] > 0
        assert c1["bond_count"] > 0
        assert c1["log_p"] != 0.0 or c1["tpsa"] > 0.0

        # Verify compound 2 (Paracetamol - CID 1983)
        c2 = res["preview_rows"][1]
        assert c2["compound_id"] == "1983"
        assert "C8H9NO2" in c2["formula"]
        assert 151.0 <= c2["molecular_weight"] <= 151.3

        # Verify RDKit 2D structure extraction for visualization
        mol_data = res["molecules_data"]
        assert len(mol_data) == 2
        assert len(mol_data[0]["atoms"]) == c1["atom_count"]
        assert len(mol_data[0]["bonds"]) == c1["bond_count"]
        assert all("x" in a and "y" in a and "symbol" in a for a in mol_data[0]["atoms"])

        # Arrow table conversion
        arrow_tbl = parser.to_arrow(temp_sdf_path)
        assert arrow_tbl.num_rows == 2
    finally:
        if os.path.exists(temp_sdf_path):
            os.remove(temp_sdf_path)


def test_d3_geospatial_parser_geopandas_shapely():
    """Acceptance test: parse real multi-geometry GeoJSON sample with GeoPandas and Shapely."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".geojson", delete=False) as f:
        json.dump(SAMPLE_GEOJSON, f)
        temp_geo_path = f.name

    try:
        parser = get_parser_for_file(temp_geo_path)
        assert isinstance(parser, GeospatialParser)

        res = parser.parse_preview(temp_geo_path)
        assert res["format"] == "geojson"
        assert res["total_rows"] == 3

        # Verify Geo metadata & Shapely validation
        geo_meta = res["geo_metadata"]
        assert geo_meta["valid_geometries_count"] == 3
        assert "Polygon" in geo_meta["geom_type_counts"]
        assert "Point" in geo_meta["geom_type_counts"]
        assert "LineString" in geo_meta["geom_type_counts"]

        # Verify bounding box computation
        bounds = geo_meta["bounds"]
        assert bounds[0] < -73.94 and bounds[2] > -73.99  # Longitude bounds around Manhattan
        assert bounds[1] > 40.70 and bounds[3] < 40.85   # Latitude bounds around Manhattan

        # Verify preview rows & attributes
        rows = res["preview_rows"]
        assert len(rows) == 3
        park_row = next(r for r in rows if r.get("name") == "Central Park")
        assert park_row["geom_type"] == "Polygon"
        assert park_row["is_valid"] is True
        assert park_row["area_sqkm"] == 3.41

        # Arrow table conversion
        arrow_tbl = parser.to_arrow(temp_geo_path)
        assert arrow_tbl.num_rows == 3
    finally:
        if os.path.exists(temp_geo_path):
            os.remove(temp_geo_path)


# ---------------------------------------------------------------------------
# D4: Real Hypothesis Testing Acceptance Tests (SciPy Integration)
# ---------------------------------------------------------------------------

@pytest.fixture
def hypothesis_test_dataset():
    """Create and register a test dataset with known statistical properties."""
    np.random.seed(42)
    n = 100
    # Group A: Normal(50, 5), Group B: Normal(65, 6) -> Highly significant difference
    group = ["Group_A"] * (n // 2) + ["Group_B"] * (n // 2)
    score = list(np.random.normal(50, 5, n // 2)) + list(np.random.normal(65, 6, n // 2))
    # Categorical association
    satisfaction = ["High" if s > 58 else "Low" for s in score]
    department = ["Engineering" if g == "Group_A" else "Marketing" for g in group]
    # Continuous correlation (X and Y with linear relationship)
    hours = np.linspace(10, 50, n)
    performance = 2.5 * hours + np.random.normal(0, 5, n)
    pre_score = np.random.normal(40, 4, n)
    post_score = pre_score + np.random.normal(8, 2, n)

    df = pd.DataFrame({
        "employee_id": range(1, n + 1),
        "group": group,
        "score": score,
        "satisfaction": satisfaction,
        "department": department,
        "hours": hours,
        "performance": performance,
        "pre_score": pre_score,
        "post_score": post_score,
    })

    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
        df.to_csv(f.name, index=False)
        csv_path = f.name

    ds_id = "test_hyp_ds_001"
    _datasets_db[ds_id] = {
        "id": ds_id,
        "name": "Hypothesis Evaluation Dataset",
        "filename": "hypothesis_data.csv",
        "file_path": csv_path,
        "format": "csv",
        "owner_id": TEST_USER_A_ID,
        "content_hash": "hyp_hash_123",
        "total_rows": n,
        "total_columns": 9,
        "schema_fields": [{"name": c, "type": "string" if df[c].dtype == object else "float64"} for c in df.columns],
        "preview_rows": df.head(20).to_dict(orient="records"),
    }

    yield ds_id, df

    if os.path.exists(csv_path):
        os.remove(csv_path)
    _datasets_db.pop(ds_id, None)


def test_d4_hypothesis_two_sample_ttest(hypothesis_test_dataset):
    """Test Welch's Two-Sample t-test via SciPy."""
    ds_id, df = hypothesis_test_dataset

    resp = client.post(
        f"/api/eda/{ds_id}/hypothesis-test",
        json={
            "test_type": "ttest",
            "target_col": "score",
            "group_col": "group",
        }
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["test_name"] == "Two-Sample Welch's t-test"
    assert data["is_significant"] is True
    assert data["p_value"] < 0.001
    assert "Statistically significant difference detected" in data["takeaway"]

    # Verify matching scipy.stats output directly
    g_a = df[df["group"] == "Group_A"]["score"]
    g_b = df[df["group"] == "Group_B"]["score"]
    scipy_stat, scipy_pval = stats.ttest_ind(g_a, g_b, equal_var=False)
    assert np.isclose(data["statistic"], scipy_stat, atol=1e-3)
    assert np.isclose(data["p_value"], scipy_pval, atol=1e-4)


def test_d4_hypothesis_one_way_anova(hypothesis_test_dataset):
    """Test One-Way ANOVA F-test via SciPy."""
    ds_id, df = hypothesis_test_dataset

    resp = client.post(
        f"/api/eda/{ds_id}/hypothesis-test",
        json={
            "test_type": "anova",
            "target_col": "score",
            "group_col": "group",
        }
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["test_name"] == "One-Way ANOVA (F-Test)"
    assert data["is_significant"] is True
    assert data["p_value"] < 0.001


def test_d4_hypothesis_chi_square(hypothesis_test_dataset):
    """Test Chi-Square test of independence via SciPy."""
    ds_id, df = hypothesis_test_dataset

    resp = client.post(
        f"/api/eda/{ds_id}/hypothesis-test",
        json={
            "test_type": "chi2",
            "target_col": "satisfaction",
            "col2": "department",
        }
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["test_name"] == "Chi-Square Test of Independence"
    assert data["degrees_of_freedom"] == 1
    assert "p_value" in data
    assert isinstance(data["statistic"], float)


def test_d4_hypothesis_linear_regression(hypothesis_test_dataset):
    """Test OLS Linear Regression via SciPy linregress."""
    ds_id, df = hypothesis_test_dataset

    resp = client.post(
        f"/api/eda/{ds_id}/hypothesis-test",
        json={
            "test_type": "regression",
            "target_col": "performance",
            "col2": "hours",
        }
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["test_name"] == "Ordinary Least Squares (OLS) Linear Regression"
    assert data["is_significant"] is True
    assert data["r_squared"] > 0.8  # Strong linear slope
    assert 2.0 <= data["slope"] <= 3.0
    assert data["p_value"] < 0.001


def test_d4_hypothesis_paired_ttest(hypothesis_test_dataset):
    """Test Paired samples t-test via SciPy."""
    ds_id, df = hypothesis_test_dataset

    resp = client.post(
        f"/api/eda/{ds_id}/hypothesis-test",
        json={
            "test_type": "paired_ttest",
            "target_col": "post_score",
            "col2": "pre_score",
        }
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["test_name"] == "Paired Samples t-test"
    assert data["is_significant"] is True
    assert data["mean_difference"] > 6.0
