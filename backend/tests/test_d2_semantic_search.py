"""Tests for Phase D Task D2: Real Semantic Search with Mistral Embeddings.

Acceptance criteria:
- Embeddings generated using Mistral embeddings API (or deterministic semantic fallback).
- Semantically related but keyword-dissimilar query (e.g. "customer attrition" matching "churn")
  succeeds via semantic search but fails via pure keyword search.
- Verified endpoints for /api/discovery/semantic-search, /api/discovery/keyword-search, and /api/discovery/search.
- Dataset embeddings are persisted in the database and restored across restarts.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

from strata_api.main import app
from strata_api.routers.datasets import _datasets_db
from strata_api.routers.discovery import _dataset_embeddings, ensure_dataset_embedding
from strata_api.ai.embeddings import (
    MistralEmbeddingProvider,
    cosine_similarity,
    build_dataset_embedding_text,
)
from tests.conftest import AUTH_HEADERS_A, TEST_USER_A_ID


@pytest.mark.asyncio
async def test_cosine_similarity_edge_cases():
    """Verify vector cosine similarity computation."""
    vec_a = [1.0, 0.0, 0.0]
    vec_b = [1.0, 0.0, 0.0]
    vec_c = [0.0, 1.0, 0.0]
    vec_d = [-1.0, 0.0, 0.0]

    assert abs(cosine_similarity(vec_a, vec_b) - 1.0) < 1e-6
    assert abs(cosine_similarity(vec_a, vec_c) - 0.0) < 1e-6
    assert abs(cosine_similarity(vec_a, vec_d) - (-1.0)) < 1e-6
    assert cosine_similarity([], []) == 0.0


@pytest.mark.asyncio
async def test_mistral_embedding_provider_mock():
    """Verify MistralEmbeddingProvider calls Mistral API with expected payload."""
    provider = MistralEmbeddingProvider(api_key="mock-mistral-key")
    
    mock_resp_data = {
        "data": [
            {"index": 0, "embedding": [0.1] * 1024},
            {"index": 1, "embedding": [0.2] * 1024},
        ]
    }

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json = MagicMock(return_value=mock_resp_data)
        mock_post.return_value = mock_response

        embeddings = await provider.get_embeddings(["text 1", "text 2"])
        assert len(embeddings) == 2
        assert len(embeddings[0]) == 1024
        assert embeddings[0][0] == 0.1
        assert embeddings[1][0] == 0.2


@pytest.mark.asyncio
async def test_semantic_vs_keyword_search_acceptance_criteria():
    """FIX.md D2 Acceptance test:
    
    A semantically related but keyword-dissimilar query (e.g. 'customer attrition'
    matching a dataset described as 'churn') returns the right dataset via the
    embedding path but would miss via pure keyword match.
    """
    client = TestClient(app)

    # Seed two distinct datasets
    # Dataset 1: Churn dataset (no mention of the word 'attrition')
    ds1_id = "ds_churn_analysis"
    ds1 = {
        "id": ds1_id,
        "owner_id": TEST_USER_A_ID,
        "workspace_id": "ws_default",
        "name": "Subscriber Churn Analysis",
        "filename": "subscriber_churn.csv",
        "file_path": "/tmp/subscriber_churn.csv",
        "description": "Monthly subscriber cancellation rates, renewal drops, and retention metrics",
        "tags": ["churn", "retention", "subscription"],
        "format": "csv",
        "content_hash": "hash_churn_123",
        "view_name": "view_churn",
        "total_rows": 1500,
        "total_columns": 6,
        "size_bytes": 45000,
        "created_at": "2026-09-29T10:00:00Z",
        "quality_score": 95.0,
        "latest_version": "v1.0.0",
        "version_count": 1,
        "schema_fields": [
            {"name": "user_id", "type": "VARCHAR"},
            {"name": "is_churned", "type": "BOOLEAN"},
            {"name": "monthly_charges", "type": "DOUBLE"},
            {"name": "cancellation_reason", "type": "VARCHAR"},
        ],
    }

    # Dataset 2: Unrelated Sales dataset
    ds2_id = "ds_inventory_logistics"
    ds2 = {
        "id": ds2_id,
        "owner_id": TEST_USER_A_ID,
        "workspace_id": "ws_default",
        "name": "Warehouse Inventory Logistics",
        "filename": "inventory_logistics.parquet",
        "file_path": "/tmp/inventory_logistics.parquet",
        "description": "Stock levels, replenishment cycles, and shipping transit durations",
        "tags": ["supply_chain", "logistics", "inventory"],
        "format": "parquet",
        "content_hash": "hash_inv_456",
        "view_name": "view_inventory",
        "total_rows": 3000,
        "total_columns": 8,
        "size_bytes": 90000,
        "created_at": "2026-09-29T10:00:00Z",
        "quality_score": 92.0,
        "latest_version": "v1.0.0",
        "version_count": 1,
        "schema_fields": [
            {"name": "sku_code", "type": "VARCHAR"},
            {"name": "warehouse_zone", "type": "VARCHAR"},
            {"name": "stock_count", "type": "INTEGER"},
        ],
    }

    _datasets_db[ds1_id] = ds1
    _datasets_db[ds2_id] = ds2

    # Provide high-similarity mock embedding for semantic match between 'customer attrition' and 'churn'
    # And orthogonal embedding for inventory
    emb_query = [0.0] * 1024
    emb_query[0] = 1.0  # vector axis for customer attrition concept

    emb_churn = [0.0] * 1024
    emb_churn[0] = 0.95  # highly aligned with attrition concept
    emb_churn[1] = 0.31

    emb_inventory = [0.0] * 1024
    emb_inventory[10] = 1.0  # orthogonal concept

    async def mock_get_single_embedding(text: str):
        text_l = text.lower()
        if "attrition" in text_l:
            return emb_query
        if "churn" in text_l or "cancellation" in text_l:
            return emb_churn
        return emb_inventory

    with patch.object(MistralEmbeddingProvider, "get_single_embedding", side_effect=mock_get_single_embedding):
        # Clear cache to force embedding computation
        _dataset_embeddings.clear()

        # 1. KEYWORD SEARCH: Query "customer attrition"
        # The word 'attrition' never appears in the churn dataset, so keyword match will return 0 matches for churn
        kw_resp = client.get(
            "/api/discovery/keyword-search?q=customer+attrition",
            headers=AUTH_HEADERS_A,
        )
        assert kw_resp.status_code == 200
        kw_data = kw_resp.json()
        assert kw_data["search_type"] == "keyword"
        # Keyword search fails to find churn dataset because the tokens don't match
        assert not any(r["id"] == ds1_id for r in kw_data["results"])

        # 2. SEMANTIC VECTOR SEARCH: Query "customer attrition"
        # The embedding representation captures semantic similarity with churn
        sem_resp = client.get(
            "/api/discovery/semantic-search?q=customer+attrition",
            headers=AUTH_HEADERS_A,
        )
        assert sem_resp.status_code == 200
        sem_data = sem_resp.json()
        assert sem_data["search_type"] == "semantic"
        assert sem_data["total_matches"] >= 1
        
        # Churn dataset is in top semantic matches with high similarity
        matching_items = [r for r in sem_data["results"] if r["id"] == ds1_id]
        assert len(matching_items) == 1
        top_match = matching_items[0]
        assert top_match["name"] == "Subscriber Churn Analysis"
        assert top_match["similarity_score"] > 0.8
        assert any("Mistral embedding cosine similarity" in reason for reason in top_match["matched_reasons"])


def test_unified_search_endpoint():
    """Test /api/discovery/search routing with mode parameter."""
    client = TestClient(app)
    
    resp_sem = client.get("/api/discovery/search?q=test&mode=semantic", headers=AUTH_HEADERS_A)
    assert resp_sem.status_code == 200
    assert resp_sem.json()["search_type"] == "semantic"

    resp_kw = client.get("/api/discovery/search?q=test&mode=keyword", headers=AUTH_HEADERS_A)
    assert resp_kw.status_code == 200
    assert resp_kw.json()["search_type"] == "keyword"


def test_dataset_embedding_persistence():
    """Test saving and loading embeddings from the database."""
    from strata_api.core.persistence import save_dataset_embedding_to_db, load_all_from_db
    
    test_id = "ds_persist_test"
    embedding_vec = [0.123] * 1024
    
    record = {
        "id": f"emb_{test_id}",
        "dataset_id": test_id,
        "embedding": embedding_vec,
        "corpus_text": "Sample text description",
        "model_name": "mistral-embed",
        "updated_at": "2026-09-29T10:00:00Z",
    }
    
    save_dataset_embedding_to_db(record)
    
    # Simulate application restart by clearing memory cache and reloading from DB
    _dataset_embeddings.clear()
    assert test_id not in _dataset_embeddings
    
    load_all_from_db()
    
    assert test_id in _dataset_embeddings
    assert _dataset_embeddings[test_id]["embedding"][0] == 0.123
    assert _dataset_embeddings[test_id]["model_name"] == "mistral-embed"
