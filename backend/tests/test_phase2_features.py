"""Unit tests for Phase 2 endpoints: Versioning enhancements, Advanced Diffs, Collaboration, Search, and Billing."""

import io
import pytest
from fastapi.testclient import TestClient
from strata_api.main import create_app

client = TestClient(create_app())


def test_phase2_versioning_and_diff_flow():
    # 1. Register a commit
    commit_req = {
        "dataset_name": "scores.csv",
        "version_tag": "v1.0.0",
        "message": "Initial baseline scores",
        "author": "James Uchechi",
        "delta_rows": "+4 rows",
        "delta_columns": "+4 cols",
    }
    commit_res = client.post("/api/diff/commits", json=commit_req)
    assert commit_res.status_code == 200
    commit_v1_obj = commit_res.json()
    commit_v1 = commit_v1_obj["id"]

    # Check tags, pins, semver, permissions, metadata endpoints
    # Add tag
    tag_res = client.post(
        f"/api/diff/commits/{commit_v1}/tags",
        json={"tag": "v1.0.0-gold"}
    )
    assert tag_res.status_code == 200
    assert "v1.0.0-gold" in tag_res.json()["commit"]["tags"]

    # Toggle pin
    pin_res = client.post(
        f"/api/diff/commits/{commit_v1}/pin",
        json={"is_pinned": True}
    )
    assert pin_res.status_code == 200
    assert pin_res.json()["commit"]["is_pinned"] is True

    # Bump SemVer
    semver_res = client.post(
        f"/api/diff/commits/{commit_v1}/bump-semver",
        json={"bump_type": "minor"}
    )
    assert semver_res.status_code == 200
    assert semver_res.json()["commit"]["version"] == "v1.1.0"

    # Update permissions
    perm_res = client.put(
        f"/api/diff/commits/{commit_v1}/permissions",
        json={"access_level": "private_draft"}
    )
    assert perm_res.status_code == 200
    assert perm_res.json()["commit"]["access_level"] == "private_draft"

    # Update metadata
    meta_res = client.put(
        f"/api/diff/commits/{commit_v1}/metadata",
        json={"metadata": {"pipeline": "nightly-etl", "verified": "true"}}
    )
    assert meta_res.status_code == 200
    assert meta_res.json()["commit"]["custom_metadata"]["pipeline"] == "nightly-etl"

    # 2. Register second commit
    commit_req2 = {
        "dataset_name": "scores.csv",
        "parent_hash": commit_v1,
        "version_tag": "v1.1.0",
        "message": "Updated scores with European cohort",
        "author": "James Uchechi",
        "delta_rows": "+1 rows",
        "delta_columns": "+1 cols",
    }
    commit_res2 = client.post("/api/diff/commits", json=commit_req2)
    assert commit_res2.status_code == 200
    commit_v2_obj = commit_res2.json()
    commit_v2 = commit_v2_obj["id"]

    # Detailed compare
    diff_res = client.get(f"/api/diff/detailed_compare?base_id={commit_v1}&target_id={commit_v2}")
    assert diff_res.status_code == 200
    diff_data = diff_res.json()
    assert "distribution_shifts" in diff_data
    assert "categorical_domain_shifts" in diff_data
    assert "missing_and_duplicates" in diff_data

    # Export report (Markdown and JSON)
    report_md = client.get(f"/api/diff/export_report?base_id={commit_v1}&target_id={commit_v2}&format=markdown")
    assert report_md.status_code == 200
    assert report_md.headers["content-type"].startswith("text/markdown")
    assert b"Strata Dataset Diff Audit Report" in report_md.content

    report_json = client.get(f"/api/diff/export_report?base_id={commit_v1}&target_id={commit_v2}&format=json")
    assert report_json.status_code == 200
    assert report_json.headers["content-type"].startswith("application/json")


def test_phase2_collaboration_and_billing_flow():
    # 1. Workspaces
    ws_res = client.get("/api/workspaces")
    assert ws_res.status_code == 200
    workspaces = ws_res.json()
    assert len(workspaces) >= 1
    ws_id = workspaces[0]["id"]

    # 2. Workspace members
    members_res = client.get(f"/api/workspaces/{ws_id}/members")
    assert members_res.status_code == 200
    members_data = members_res.json()
    assert len(members_data["members"]) >= 1

    # 3. Create Invite
    invite_res = client.post(
        f"/api/workspaces/{ws_id}/invites",
        json={"email": "newanalyst@acme.corp", "role": "Analyst"}
    )
    assert invite_res.status_code == 200
    invite_data = invite_res.json()
    assert "invitation" in invite_data
    assert "invite_token" in invite_data["invitation"]
    assert "invite_url" in invite_data["invitation"]

    # 4. Activity feed
    act_res = client.get(f"/api/workspaces/{ws_id}/activity")
    assert act_res.status_code == 200
    activities = act_res.json()
    assert isinstance(activities, list)

    # 5. Billing usage
    usage_res = client.get("/api/billing/usage")
    assert usage_res.status_code == 200
    usage = usage_res.json()
    assert "tier" in usage
    assert "storage_used_bytes" in usage
    assert "storage_limit_bytes" in usage

    # 6. Billing upgrade
    upgrade_res = client.post(
        "/api/billing/upgrade",
        json={"tier": "pro"}
    )
    assert upgrade_res.status_code == 200
    assert upgrade_res.json()["plan"]["tier"] == "pro"

    # 7. Seed sample benchmark datasets
    seed_res = client.post("/api/billing/seed-samples")
    assert seed_res.status_code == 200
    seeded = seed_res.json()
    assert "seeded_datasets" in seeded
    assert isinstance(seeded["seeded_datasets"], list)


def test_phase2_datasets_search_flow():
    search_res = client.get("/api/datasets/search?q=sample&sort_by=updated_desc")
    assert search_res.status_code == 200
    data = search_res.json()
    assert "results" in data
    assert "total_results" in data
    assert "facets" in data
