"""Acceptance test suite for Phase A, Item A1: Authentication and Ownership Enforcement.

Verifies:
1. Every router rejects unauthenticated requests with HTTP 401.
2. User B cannot access, mutate, delete, or inspect User A's resources (returns HTTP 403 Forbidden).
3. Public-by-design endpoints (showcase catalog, license catalog, shared token links) remain accessible without auth.
"""

import io
import pytest
from httpx import AsyncClient, ASGITransport
from fastapi.testclient import TestClient

from strata_api.main import app
from strata_api.routers.datasets import register_dataset_in_store, get_storage_dir, _datasets_db
from strata_api.routers.pipelines import _pipelines_db
from strata_api.versioning.registry import record_commit
from tests.conftest import (
    TEST_USER_A_ID,
    TEST_USER_B_ID,
    AUTH_HEADERS_A,
    AUTH_HEADERS_B,
    TEST_TOKEN_A,
    TEST_TOKEN_B,
)


@pytest.fixture
def seeded_user_a_resources():
    """Register explicit private resources owned by User A for cross-user isolation tests."""
    # 1. Dataset owned by User A
    ds_id = "ds_user_a_private"
    file_path = f"{get_storage_dir()}/user_a_private.csv"
    with open(file_path, "w") as f:
        f.write("id,secret_data,val\n1,classified,100\n2,confidential,200\n")

    reg = register_dataset_in_store(
        file_path=file_path,
        filename="user_a_private.csv",
        content_hash="hash_user_a_private_001",
        description="Confidential private dataset of User A",
        custom_id=ds_id,
        owner_id=TEST_USER_A_ID,
    )

    # 2. Commit owned by User A
    commit = record_commit(
        version_hash="commit_hash_user_a_001",
        dataset_name="user_a_private.csv",
        version_tag="v1.0.0",
        message="Confidential commit for User A",
        author="user_a@strata.ai",
        owner_id=TEST_USER_A_ID,
    )

    # 3. Pipeline owned by User A
    pipe_id = "pipe_user_a_private"
    _pipelines_db[pipe_id] = {
        "id": pipe_id,
        "name": "User A Proprietary Pipeline",
        "description": "Private pipeline",
        "target_dataset_id": ds_id,
        "schedule": "0 0 * * *",
        "trigger": "manual",
        "is_active": True,
        "timeout_seconds": 60,
        "max_memory_mb": 256,
        "owner_id": TEST_USER_A_ID,
        "steps": [{"step_id": "s1", "name": "noop", "type": "filter", "condition": "val > 0"}],
        "created_at": "2026-09-24T00:00:00Z",
        "last_run_at": None,
        "last_status": "never_run",
    }

    return {
        "dataset_id": ds_id,
        "dataset_name": "user_a_private.csv",
        "commit_id": commit["id"],
        "pipeline_id": pipe_id,
    }


# ===========================================================================
# 1. Test 401 Unauthorized across all routers without Bearer Token
# ===========================================================================

@pytest.mark.asyncio
async def test_401_unauthenticated_requests_across_all_routers(seeded_user_a_resources):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ds_id = seeded_user_a_resources["dataset_id"]
        ds_name = seeded_user_a_resources["dataset_name"]
        commit_id = seeded_user_a_resources["commit_id"]
        pipe_id = seeded_user_a_resources["pipeline_id"]

        # 1. Auth router
        r1 = await ac.get("/api/auth/me")
        assert r1.status_code == 401

        # 2. Datasets router
        r2 = await ac.get("/api/datasets")
        assert r2.status_code == 401
        r2_del = await ac.delete(f"/api/datasets/{ds_id}")
        assert r2_del.status_code == 401

        # 3. Preview router
        r3 = await ac.post("/api/preview", files={"file": ("test.csv", b"a,b\n1,2", "text/csv")})
        assert r3.status_code == 401

        # 4. Query router
        r4 = await ac.post("/api/query", json={"view_name": "some_view", "sql": "SELECT 1;"})
        assert r4.status_code == 401

        # 5. Billing router
        r5 = await ac.get("/api/billing/usage")
        assert r5.status_code == 401

        # 6. Security router
        r6 = await ac.get("/api/security/audit-logs")
        assert r6.status_code == 401

        # 7. Collaboration router
        r7 = await ac.get("/api/workspaces")
        assert r7.status_code == 401

        # 8. Pipelines router
        r8 = await ac.get("/api/pipelines")
        assert r8.status_code == 401
        r8_run = await ac.post(f"/api/pipelines/{pipe_id}/run")
        assert r8_run.status_code == 401

        # 9. Lineage router
        r9 = await ac.get("/api/lineage/graph")
        assert r9.status_code == 401

        # 10. Branches router
        r10 = await ac.get(f"/api/branches?dataset_name={ds_name}")
        assert r10.status_code == 401

        # 11. Discovery router
        r11 = await ac.get("/api/discovery/semantic-search?q=test")
        assert r11.status_code == 401
        r11_fav = await ac.post(f"/api/discovery/favorites/{ds_id}")
        assert r11_fav.status_code == 401

        # 12. Integrations router
        r12 = await ac.get("/api/integrations/status")
        assert r12.status_code == 401

        # 13. EDA router
        r13 = await ac.get(f"/api/eda/{ds_id}")
        assert r13.status_code == 401

        # 14. Diff router
        r14 = await ac.get("/api/diff/commits")
        assert r14.status_code == 401
        r14_rb = await ac.post(f"/api/diff/commits/{commit_id}/rollback")
        assert r14_rb.status_code == 401

        # 15. AutoML router
        r15 = await ac.post("/api/automl/train", json={"dataset_id": ds_id, "target_column": "val"})
        assert r15.status_code == 401

        # 16. Showcase router (authenticated endpoints)
        r16_star = await ac.post("/api/showcase/showcase_climate_risk/star")
        assert r16_star.status_code == 401
        r16_fork = await ac.post("/api/showcase/showcase_climate_risk/fork")
        assert r16_fork.status_code == 401


# ===========================================================================
# 2. Test 403 Forbidden when User B tries to access User A's resources
# ===========================================================================

@pytest.mark.asyncio
async def test_403_user_isolation_prevent_cross_tenant_access(seeded_user_a_resources):
    """User B with a valid Bearer token cannot access, query, mutate, or delete User A's resources."""
    transport = ASGITransport(app=app)
    # ac_b authenticated as User B
    async with AsyncClient(transport=transport, base_url="http://test", headers=AUTH_HEADERS_B) as ac_b:
        ds_id = seeded_user_a_resources["dataset_id"]
        ds_name = seeded_user_a_resources["dataset_name"]
        commit_id = seeded_user_a_resources["commit_id"]
        pipe_id = seeded_user_a_resources["pipeline_id"]

        # 1. User B cannot preview User A's dataset
        r_preview = await ac_b.get(f"/api/datasets/{ds_id}")
        assert r_preview.status_code == 403, f"Expected 403, got {r_preview.status_code}"

        # 2. User B cannot delete User A's dataset
        r_del = await ac_b.delete(f"/api/datasets/{ds_id}")
        assert r_del.status_code == 403, f"Expected 403, got {r_del.status_code}"

        # 3. User B cannot transform User A's dataset
        r_transform = await ac_b.post(f"/api/datasets/{ds_id}/transform", json={"operations": []})
        assert r_transform.status_code == 403, f"Expected 403, got {r_transform.status_code}"

        # 4. User B cannot create share link for User A's dataset
        r_share = await ac_b.post(f"/api/datasets/{ds_id}/share")
        assert r_share.status_code == 403, f"Expected 403, got {r_share.status_code}"

        # 5. User B cannot query User A's dataset view
        view_name = _datasets_db[ds_id].get("view_name")
        r_query = await ac_b.post("/api/query", json={"view_name": view_name, "sql": f"SELECT * FROM {view_name}"})
        assert r_query.status_code == 403, f"Expected 403, got {r_query.status_code}"

        # 6. User B cannot view branches of User A's dataset
        r_branches = await ac_b.get(f"/api/branches?dataset_name={ds_name}")
        assert r_branches.status_code == 403, f"Expected 403, got {r_branches.status_code}"

        # 7. User B cannot create branch on User A's dataset
        r_create_branch = await ac_b.post("/api/branches", json={"dataset_name": ds_name, "branch_name": "rogue-branch"})
        assert r_create_branch.status_code == 403, f"Expected 403, got {r_create_branch.status_code}"

        # 8. User B cannot run EDA on User A's dataset
        r_eda = await ac_b.get(f"/api/eda/{ds_id}")
        assert r_eda.status_code == 403, f"Expected 403, got {r_eda.status_code}"

        # 9. User B cannot run AutoML on User A's dataset
        r_automl = await ac_b.post("/api/automl/train", json={"dataset_id": ds_id, "target_column": "val"})
        assert r_automl.status_code == 403, f"Expected 403, got {r_automl.status_code}"

        # 10. User B cannot rollback User A's commit
        r_rb = await ac_b.post(f"/api/diff/commits/{commit_id}/rollback")
        assert r_rb.status_code == 403, f"Expected 403, got {r_rb.status_code}"

        # 11. User B cannot tag User A's commit
        r_tag = await ac_b.post(f"/api/diff/commits/{commit_id}/tags", json={"tag": "rogue_tag"})
        assert r_tag.status_code == 403, f"Expected 403, got {r_tag.status_code}"

        # 12. User B cannot pin User A's commit
        r_pin = await ac_b.post(f"/api/diff/commits/{commit_id}/pin", json={"is_pinned": True})
        assert r_pin.status_code == 403, f"Expected 403, got {r_pin.status_code}"

        # 13. User B cannot trigger User A's pipeline
        r_run_pipe = await ac_b.post(f"/api/pipelines/{pipe_id}/run")
        assert r_run_pipe.status_code == 403, f"Expected 403, got {r_run_pipe.status_code}"

        # 14. User B cannot favorite User A's dataset
        r_fav = await ac_b.post(f"/api/discovery/favorites/{ds_id}")
        assert r_fav.status_code == 403, f"Expected 403, got {r_fav.status_code}"

        # 15. User B cannot mask-export User A's dataset
        r_mask = await ac_b.post("/api/security/mask-export", json={"dataset_id": ds_id, "mask_rules": ["secret_data"]})
        assert r_mask.status_code == 403, f"Expected 403, got {r_mask.status_code}"

        # 16. User B cannot get code templates referencing User A's private dataset
        r_tmpl = await ac_b.get(f"/api/integrations/code-templates?dataset_name={ds_name}")
        assert r_tmpl.status_code == 403, f"Expected 403, got {r_tmpl.status_code}"


# ===========================================================================
# 3. User A CAN access their own resources (200 OK)
# ===========================================================================

@pytest.mark.asyncio
async def test_200_user_a_accesses_own_resources(seeded_user_a_resources):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", headers=AUTH_HEADERS_A) as ac_a:
        ds_id = seeded_user_a_resources["dataset_id"]
        ds_name = seeded_user_a_resources["dataset_name"]

        # Preview
        r_preview = await ac_a.get(f"/api/datasets/{ds_id}")
        assert r_preview.status_code == 200


        # EDA
        r_eda = await ac_a.get(f"/api/eda/{ds_id}")
        assert r_eda.status_code == 200

        # Code templates
        r_tmpl = await ac_a.get(f"/api/integrations/code-templates?dataset_name={ds_name}")
        assert r_tmpl.status_code == 200

        # Favorites
        r_fav = await ac_a.post(f"/api/discovery/favorites/{ds_id}")
        assert r_fav.status_code == 200


# ===========================================================================
# 4. Public-by-Design Endpoints (Open without Authentication)
# ===========================================================================

@pytest.mark.asyncio
async def test_public_endpoints_accessible_without_auth():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Public showcase catalog
        r_catalog = await ac.get("/api/showcase")
        assert r_catalog.status_code == 200
        assert r_catalog.json()["total"] >= 1

        # Public licenses directory
        r_lic = await ac.get("/api/showcase/licenses")
        assert r_lic.status_code == 200
        assert len(r_lic.json()["licenses"]) >= 5

        # Public showcase item detail
        r_item = await ac.get("/api/showcase/showcase_climate_risk")
        assert r_item.status_code == 200
        assert "dataset" in r_item.json()

        # Public citation generation
        r_cit = await ac.get("/api/showcase/showcase_climate_risk/citation")
        assert r_cit.status_code == 200
        assert "bibtex" in r_cit.json()

        # Public embed configuration
        r_emb = await ac.get("/api/showcase/showcase_climate_risk/embed-config")
        assert r_emb.status_code == 200
        assert "iframe" in r_emb.json()

        # Public health check
        r_health = await ac.get("/api/health")
        assert r_health.status_code == 200
