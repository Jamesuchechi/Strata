"""Unit tests for Semantic Vector Search, Public Showcase & Sharing.
Pillars 10 & 11: 10.2, 10.3, 10.4, 10.6, 10.7, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7
"""

import pytest
from httpx import AsyncClient, ASGITransport
from strata_api.main import create_app
from strata_api.routers.datasets import seed_default_datasets_if_needed

app = create_app()


@pytest.fixture(autouse=True)
def setup_datasets():
    seed_default_datasets_if_needed()


@pytest.mark.asyncio
async def test_semantic_vector_search():
    """Test natural language vector search and scoring over dataset content (10.4)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get(
            "/api/discovery/semantic-search",
            params={"q": "customer churn rate and monthly charges tenure"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_matches"] > 0
        top = data["results"][0]
        assert "churn" in top["name"].lower() or "churn" in (top["description"] or "").lower()
        assert top["similarity_score"] > 0.0
        assert any("similarity" in r.lower() or "exact" in r.lower() for r in top["matched_reasons"])


@pytest.mark.asyncio
async def test_schema_column_search():
    """Test schema-based column name and type search (10.2)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get(
            "/api/discovery/semantic-search",
            params={"column": "customer_id"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_matches"] >= 1
        for res in data["results"]:
            assert any("customer_id" in col.lower() for col in res["matched_columns"])


@pytest.mark.asyncio
async def test_favorites_and_recents():
    """Test favorites toggle and recents history tracking (10.6)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Star / Favorite
        star_resp = await ac.post("/api/discovery/favorites/churn_demo")
        assert star_resp.status_code == 200
        star_data = star_resp.json()
        assert star_data["is_favorite"] is True

        fav_list_resp = await ac.get("/api/discovery/favorites")
        assert fav_list_resp.status_code == 200
        fav_ids = [d["id"] for d in fav_list_resp.json()["favorites"]]
        assert "churn_demo" in fav_ids

        # Unstar
        unstar_resp = await ac.post("/api/discovery/favorites/churn_demo")
        assert unstar_resp.json()["is_favorite"] is False

        # 2. Record Recent visit
        rec_resp = await ac.post("/api/discovery/recents/churn_demo")
        assert rec_resp.status_code == 200

        recent_list = await ac.get("/api/discovery/recents")
        assert recent_list.status_code == 200
        recent_ids = [d["id"] for d in recent_list.json()["recents"]]
        assert "churn_demo" in recent_ids


@pytest.mark.asyncio
async def test_dataset_recommendations():
    """Test automated 'Teams that used this also explored' recommendations (10.7)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/discovery/recommendations/churn_demo")
        assert resp.status_code == 200
        recs = resp.json()
        assert isinstance(recs, list)
        for rec in recs:
            assert "similarity_score" in rec
            assert "rationale" in rec


@pytest.mark.asyncio
async def test_showcase_gallery_and_filters():
    """Test public showcase gallery listing, domain filter, and sorting (11.2, 11.6)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Full list
        resp = await ac.get("/api/showcase")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 4
        assert len(data["datasets"]) >= 4

        # Domain filter
        geo_resp = await ac.get("/api/showcase", params={"domain": "Geospatial"})
        assert geo_resp.status_code == 200
        geo_data = geo_resp.json()
        assert geo_data["total"] >= 1
        assert "climate" in geo_data["datasets"][0]["id"]


@pytest.mark.asyncio
async def test_showcase_star_download_and_citations():
    """Test starring, download tracking, and academic citations (11.4, 11.6)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        dataset_id = "showcase_climate_risk"

        # Star toggle
        star_resp = await ac.post(f"/api/showcase/{dataset_id}/star")
        assert star_resp.status_code == 200
        assert "total_stars" in star_resp.json()

        # Download tracking
        dl_resp = await ac.post(f"/api/showcase/{dataset_id}/download")
        assert dl_resp.status_code == 200
        assert dl_resp.json()["status"] == "ready"

        # Citation generation
        cite_resp = await ac.get(f"/api/showcase/{dataset_id}/citation")
        assert cite_resp.status_code == 200
        cites = cite_resp.json()
        assert "@misc{" in cites["bibtex"]
        assert "10.5281/strata" in cites["doi"]
        assert "Earth Dynamics Lab" in cites["apa"]

        # Embed snippet generator
        embed_resp = await ac.get(f"/api/showcase/{dataset_id}/embed-config")
        assert embed_resp.status_code == 200
        embeds = embed_resp.json()
        assert "<iframe" in embeds["iframe"]
        assert "/embed/showcase_climate_risk" in embeds["embed_url"]


@pytest.mark.asyncio
async def test_standard_licenses():
    """Test standardized license catalog retrieval (11.5)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/showcase/licenses")
        assert resp.status_code == 200
        licenses = resp.json()["licenses"]
        license_ids = [l["id"] for l in licenses]
        assert "CC-BY-4.0" in license_ids
        assert "MIT" in license_ids
        assert "Apache-2.0" in license_ids
        assert "ODC-ODbL" in license_ids


@pytest.mark.asyncio
async def test_showcase_dataset_forking():
    """Test one-click public dataset forking into active user catalog (11.7)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        dataset_id = "showcase_fintech_fraud"
        resp = await ac.post(f"/api/showcase/{dataset_id}/fork")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "forked"
        assert "new_dataset_id" in data
        assert data["fork_count"] >= 1
        assert "fintech" in data["dataset"]["tags"] or "forked" in data["dataset"]["tags"]
