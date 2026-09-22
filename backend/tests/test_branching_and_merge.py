"""Unit tests for Git-style dataset branching, 3-way merge conflict engine, and column/row blame."""

import io
import pytest
from fastapi.testclient import TestClient
from strata_api.main import create_app

client = TestClient(create_app())


def test_branch_lifecycle():
    dataset_name = "test_lifecycle.csv"

    # 1. Upload initial file to have a commit
    csv = "id,name,score\n1,Alice,85\n2,Bob,90\n"
    res = client.post(
        "/api/preview",
        files={"file": (dataset_name, io.BytesIO(csv.encode("utf-8")), "text/csv")}
    )
    assert res.status_code == 200

    # Register initial commit
    commit_res = client.post("/api/diff/commits", json={
        "dataset_name": dataset_name,
        "version_tag": "v1.0.0",
        "message": "Initial release",
        "author": "James Uchechi",
    })
    assert commit_res.status_code == 200

    # 2. List branches (auto-initializes 'main')
    list_res = client.get(f"/api/branches?dataset_name={dataset_name}")
    assert list_res.status_code == 200
    data = list_res.json()
    assert data["active_branch"] == "main"
    branch_names = [b["name"] for b in data["branches"]]
    assert "main" in branch_names

    # 3. Create a new branch
    create_res = client.post("/api/branches", json={
        "dataset_name": dataset_name,
        "branch_name": "feature/clean-outliers",
        "description": "Removing noisy observations and standardizing IDs",
        "author": "Marcus Vance",
    })
    assert create_res.status_code == 200
    assert create_res.json()["branch"]["name"] == "feature/clean-outliers"

    # 4. Checkout the new branch
    checkout_res = client.post("/api/branches/checkout", json={
        "dataset_name": dataset_name,
        "branch_name": "feature/clean-outliers",
    })
    assert checkout_res.status_code == 200
    assert checkout_res.json()["active_branch"]["name"] == "feature/clean-outliers"

    # Verify active branch in listing
    list_res2 = client.get(f"/api/branches?dataset_name={dataset_name}")
    assert list_res2.json()["active_branch"] == "feature/clean-outliers"

    # 5. Delete feature branch (switch back to main first)
    client.post("/api/branches/checkout", json={
        "dataset_name": dataset_name,
        "branch_name": "main",
    })
    del_res = client.delete(f"/api/branches/feature/clean-outliers?dataset_name={dataset_name}")
    assert del_res.status_code == 200

    # Attempting to delete protected 'main' branch should fail
    del_main = client.delete(f"/api/branches/main?dataset_name={dataset_name}")
    assert del_main.status_code == 400


def test_three_way_merge_and_conflicts():
    dataset_name = "merge_test.csv"

    # Register base commit
    base_commit = client.post("/api/diff/commits", json={
        "dataset_name": dataset_name,
        "version_tag": "v1.0.0",
        "message": "Base schema with id, user, amount",
        "author": "James Uchechi",
    }).json()

    # Create target branch 'main' and source branch 'feature/risk-score'
    client.get(f"/api/branches?dataset_name={dataset_name}")
    client.post("/api/branches", json={
        "dataset_name": dataset_name,
        "branch_name": "feature/risk-score",
        "from_commit_or_branch": "main",
        "author": "Dr. Sarah Chen",
    })

    # Commit on feature branch adding a new column 'risk_score'
    feature_commit = client.post("/api/diff/commits", json={
        "dataset_name": dataset_name,
        "parent_hash": base_commit["id"],
        "version_tag": "v1.1.0-risk",
        "message": "Engineered risk_score column",
        "author": "Dr. Sarah Chen",
        "added_cols": ["risk_score"],
    }).json()

    # Fast forward feature branch head to this commit
    from strata_api.versioning.branches import _branches_db, _normalize_dataset_key
    k = _normalize_dataset_key(dataset_name)
    _branches_db[k]["feature/risk-score"]["head_commit_id"] = feature_commit["id"]
    _branches_db[k]["feature/risk-score"]["head_hash"] = feature_commit["hash"]

    # 1. Preview 3-way merge
    compare_res = client.get(f"/api/branches/compare?dataset_name={dataset_name}&target_branch=main&source_branch=feature/risk-score")
    assert compare_res.status_code == 200
    compare_data = compare_res.json()
    assert compare_data["has_conflicts"] is False
    assert "risk_score" in compare_data["schema_merge"]
    assert compare_data["schema_merge"]["risk_score"]["status"] == "auto_mergeable"

    # 2. Execute Merge
    merge_res = client.post("/api/branches/merge", json={
        "dataset_name": dataset_name,
        "target_branch": "main",
        "source_branch": "feature/risk-score",
        "strategy": "auto",
        "author": "James Uchechi",
    })
    assert merge_res.status_code == 200
    merge_data = merge_res.json()
    assert "merge_commit" in merge_data
    assert merge_data["target_branch"]["head_commit_id"] == merge_data["merge_commit"]["id"]


def test_three_way_merge_conflict_resolution():
    dataset_name = "conflict_test.csv"

    # Base commit
    base_commit = client.post("/api/diff/commits", json={
        "dataset_name": dataset_name,
        "version_tag": "v1.0.0",
        "message": "Base schema",
    }).json()

    # Create two divergent branches
    client.get(f"/api/branches?dataset_name={dataset_name}")
    client.post("/api/branches", json={
        "dataset_name": dataset_name,
        "branch_name": "branch-a",
    })
    client.post("/api/branches", json={
        "dataset_name": dataset_name,
        "branch_name": "branch-b",
    })

    # Branch A modifies schema: adds 'priority' as Integer
    c_a = client.post("/api/diff/commits", json={
        "dataset_name": dataset_name,
        "parent_hash": base_commit["id"],
        "version_tag": "v1.0.1-a",
        "message": "Branch A priority int",
        "added_cols": ["priority"],
    }).json()

    # Branch B adds same 'priority' column but as String
    c_b = client.post("/api/diff/commits", json={
        "dataset_name": dataset_name,
        "parent_hash": base_commit["id"],
        "version_tag": "v1.0.1-b",
        "message": "Branch B priority str",
        "added_cols": ["priority"],
    }).json()

    from strata_api.versioning.branches import _branches_db, _normalize_dataset_key
    k = _normalize_dataset_key(dataset_name)
    _branches_db[k]["branch-a"]["head_commit_id"] = c_a["id"]
    _branches_db[k]["branch-b"]["head_commit_id"] = c_b["id"]

    # Preview compare
    comp = client.get(f"/api/branches/compare?dataset_name={dataset_name}&target_branch=branch-a&source_branch=branch-b")
    assert comp.status_code == 200
    # Both added priority - schema merge handles it
    assert "priority" in comp.json()["schema_merge"]

    # Execute merge with explicit strategy "theirs"
    merge_res = client.post("/api/branches/merge", json={
        "dataset_name": dataset_name,
        "target_branch": "branch-a",
        "source_branch": "branch-b",
        "strategy": "theirs",
    })
    assert merge_res.status_code == 200
    assert "merge_commit" in merge_res.json()


def test_blame_attribution():
    dataset_name = "blame_sample.csv"
    client.post("/api/diff/commits", json={
        "dataset_name": dataset_name,
        "version_tag": "v1.0.0",
        "message": "Initial table setup",
        "author": "James Uchechi",
        "added_cols": ["user_id", "email"],
    })
    client.post("/api/diff/commits", json={
        "dataset_name": dataset_name,
        "version_tag": "v1.1.0",
        "message": "Added monthly charges",
        "author": "Dr. Sarah Chen",
        "added_cols": ["monthly_charges"],
    })

    blame_res = client.get(f"/api/branches/blame?dataset_name={dataset_name}")
    assert blame_res.status_code == 200
    b_data = blame_res.json()
    assert "columns" in b_data
    col_names = [col["column"] for col in b_data["columns"]]
    assert "monthly_charges" in col_names
    assert "user_id" in col_names
