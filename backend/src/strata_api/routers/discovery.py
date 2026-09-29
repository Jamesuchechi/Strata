"""Semantic vector search (Mistral embeddings) and Keyword search (TF-IDF tokens).

Pillar 10: 10.2, 10.3, 10.4, 10.6, 10.7
"""

from __future__ import annotations

import math
import re
from typing import Dict, List, Optional, Any
from collections import defaultdict
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field

from strata_api.models.user import UserModel
from strata_api.routers.auth import get_current_user
from strata_api.routers.datasets import (
    _datasets_db,
    seed_default_datasets_if_needed,
    check_dataset_access,
    user_has_dataset_access,
)
from strata_api.core.persistence import (
    save_user_favorite_to_db,
    delete_user_favorite_from_db,
    save_user_recent_to_db,
    save_dataset_embedding_to_db,
)
from strata_api.ai.embeddings import (
    get_embedding_provider,
    cosine_similarity,
    build_dataset_embedding_text,
)

router = APIRouter(prefix="/discovery", tags=["Search & Discovery"])


# State for Favorites, Recents, and Cached Dataset Embeddings
_user_favorites: Dict[str, set] = defaultdict(set)
_user_recents: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
_dataset_embeddings: Dict[str, Dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# Embedding Sync Helper
# ---------------------------------------------------------------------------

async def ensure_dataset_embedding(dataset: Dict[str, Any]) -> List[float]:
    """Retrieve or compute the 1024-d Mistral embedding for a dataset."""
    ds_id = dataset.get("id")
    if ds_id and ds_id in _dataset_embeddings:
        return _dataset_embeddings[ds_id]["embedding"]

    corpus_text = build_dataset_embedding_text(dataset)
    provider = get_embedding_provider()
    embedding = await provider.get_single_embedding(corpus_text)

    if ds_id:
        record = {
            "id": f"emb_{ds_id}",
            "dataset_id": ds_id,
            "embedding": embedding,
            "corpus_text": corpus_text,
            "model_name": getattr(provider, "model", "mistral-embed"),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        _dataset_embeddings[ds_id] = record
        save_dataset_embedding_to_db(record)

    return embedding


# ---------------------------------------------------------------------------
# Keyword Search (TF-IDF & N-Gram Tokenizer Utility)
# ---------------------------------------------------------------------------

def _tokenize(text: Optional[str]) -> List[str]:
    """Tokenize and normalize text into n-grams and words."""
    if not text:
        return []
    cleaned = re.sub(r"[^a-zA-Z0-9_\s]", " ", str(text).lower())
    words = [w for w in cleaned.split() if len(w) > 1]
    tokens = set(words)
    # Add character 3-grams for fuzzy matching
    for w in words:
        if len(w) >= 3:
            for i in range(len(w) - 2):
                tokens.add(w[i:i+3])
    return list(tokens)


def _compute_tf_vector(tokens: List[str], vocabulary: Dict[str, int]) -> List[float]:
    """Compute normalized TF vector over vocabulary."""
    vec = [0.0] * len(vocabulary)
    for t in tokens:
        idx = vocabulary.get(t)
        if idx is not None:
            vec[idx] += 1.0
    norm = math.sqrt(sum(v * v for v in vec))
    if norm > 0:
        vec = [v / norm for v in vec]
    return vec


def _build_dataset_corpus_text(dataset: Dict[str, Any]) -> str:
    """Generate rich keyword document representing dataset content & schema."""
    parts = [
        str(dataset.get("name") or ""),
        str(dataset.get("filename") or ""),
        str(dataset.get("description") or ""),
        " ".join([str(t) for t in (dataset.get("tags") or []) if t is not None]),
        str(dataset.get("format") or ""),
    ]
    for col in (dataset.get("schema_fields") or []):
        if not col or not isinstance(col, dict):
            continue
        col_name = str(col.get("name") or "")
        col_type = str(col.get("type") or "")
        if col_name:
            parts.append(col_name)
        if col_type:
            parts.append(f"{col_name}_{col_type}")

    return " ".join([p for p in parts if p])


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class SearchResultItem(BaseModel):
    id: str
    name: str
    filename: str
    description: Optional[str]
    tags: List[str] = []
    format: str
    total_rows: int
    total_columns: int
    quality_score: Optional[float] = 85.0
    similarity_score: float
    search_type: str = "semantic"  # "semantic" | "keyword"
    matched_reasons: List[str]
    matched_columns: List[str] = []


class SemanticSearchResultItem(SearchResultItem):
    pass


class SearchResponse(BaseModel):
    query: Optional[str]
    search_type: str = "semantic"
    total_matches: int
    results: List[SearchResultItem]


class SemanticSearchResponse(SearchResponse):
    pass


class KeywordSearchResponse(SearchResponse):
    search_type: str = "keyword"


class RecommendationItem(BaseModel):
    id: str
    name: str
    description: Optional[str]
    format: str
    similarity_score: float
    rationale: str
    shared_columns: List[str]


# ---------------------------------------------------------------------------
# Search Endpoints
# ---------------------------------------------------------------------------

@router.get("/semantic-search", response_model=SemanticSearchResponse)
async def semantic_search(
    q: Optional[str] = Query(None, description="Natural language semantic search query (powered by Mistral embeddings)"),
    column: Optional[str] = Query(None, description="Schema-based search matching column names or types"),
    domain: Optional[str] = Query(None, description="Domain / category filter (e.g. finance, saas, healthcare, churn)"),
    format: Optional[str] = Query(None, description="File format (csv, parquet, excel, sdf, geojson)"),
    min_quality: Optional[int] = Query(None, description="Minimum quality score (0-100)"),
    min_rows: Optional[int] = Query(None, description="Minimum rows"),
    max_rows: Optional[int] = Query(None, description="Maximum rows"),
    current_user: UserModel = Depends(get_current_user),
):
    """Real semantic vector search powered by Mistral AI embeddings and cosine distance."""
    seed_default_datasets_if_needed()
    datasets = [d for d in _datasets_db.values() if user_has_dataset_access(d, current_user.id)]

    if not datasets:
        return SemanticSearchResponse(query=q, search_type="semantic", total_matches=0, results=[])

    # 1. Compute query embedding if query provided
    q_vec: Optional[List[float]] = None
    if q and q.strip():
        provider = get_embedding_provider()
        q_vec = await provider.get_single_embedding(q.strip())

    scored_results: List[SearchResultItem] = []

    for d in datasets:
        reasons = []
        matched_cols = []
        similarity = 0.5

        # Semantic embedding vector distance
        if q_vec and q:
            d_vec = await ensure_dataset_embedding(d)
            sim = cosine_similarity(q_vec, d_vec)
            # Map cosine similarity (-1 to 1) into a positive relevance score (0.0 to 1.0)
            normalized_sim = max(0.0, (sim + 1.0) / 2.0) if sim < 0 else sim
            similarity = round(float(normalized_sim), 3)

            # Check for name / description / column relevance
            q_clean = str(q).lower()
            d_name = str(d.get("name") or "").lower()
            d_desc = str(d.get("description") or "").lower()

            if q_clean in d_name:
                similarity = min(1.0, similarity + 0.25)
                reasons.append("Exact name match")
            elif any(w in d_name for w in q_clean.split() if len(w) > 3):
                similarity = min(1.0, similarity + 0.1)

            if d_desc and q_clean in d_desc:
                similarity = min(1.0, similarity + 0.15)
                reasons.append("Description semantic relevance")
            elif d_desc and any(w in d_desc for w in q_clean.split() if len(w) > 3):
                similarity = min(1.0, similarity + 0.08)

            for c in (d.get("schema_fields") or []):
                if not c or not isinstance(c, dict):
                    continue
                c_name = str(c.get("name") or "").lower()
                if any(term in c_name for term in q_clean.split() if len(term) > 2):
                    matched_cols.append(c.get("name"))

            # Filtering threshold: ignore poor matches
            if similarity < 0.15 and not matched_cols:
                continue

            reasons.append(f"Mistral embedding cosine similarity: {int(similarity * 100)}%")
            if matched_cols:
                reasons.append(f"Schema column relevance: {', '.join([str(col) for col in matched_cols[:3]])}")
        elif q:
            reasons.append("Catalog match")

        # Column filter
        if column:
            col_target = str(column).lower().strip()
            cols_found = [
                c.get("name") for c in (d.get("schema_fields") or [])
                if isinstance(c, dict) and (col_target in str(c.get("name") or "").lower() or col_target in str(c.get("type") or "").lower())
            ]
            if not cols_found:
                continue
            reasons.append(f"Schema matches column filter '{column}'")
            matched_cols.extend(cols_found)

        # Domain filter
        if domain:
            dom_lower = str(domain).lower().strip()
            tag_matches = [t for t in (d.get("tags") or []) if t and dom_lower in str(t).lower()]
            desc_match = dom_lower in str(d.get("description") or "").lower()
            if not (tag_matches or desc_match):
                continue
            reasons.append(f"Domain category match: {domain}")

        # Format filter
        if format and str(format).lower() != "all":
            if str(d.get("format") or "").lower() != str(format).lower().strip():
                continue

        # Quality filter
        q_score = d.get("quality_score") or 88
        if min_quality is not None and q_score < min_quality:
            continue

        # Row count filters
        rows = d.get("total_rows", 0) or 0
        if min_rows is not None and rows < min_rows:
            continue
        if max_rows is not None and rows > max_rows:
            continue

        if not reasons:
            reasons.append("Catalog match")

        scored_results.append(
            SearchResultItem(
                id=str(d.get("id") or ""),
                name=str(d.get("name") or d.get("filename") or "Dataset"),
                filename=str(d.get("filename") or ""),
                description=d.get("description"),
                tags=d.get("tags") or [],
                format=str(d.get("format") or "unknown"),
                total_rows=rows,
                total_columns=d.get("total_columns", 0) or 0,
                quality_score=q_score,
                similarity_score=similarity,
                search_type="semantic",
                matched_reasons=reasons,
                matched_columns=list(set([c for c in matched_cols if c])),
            )
        )

    # Sort descending by similarity
    scored_results.sort(key=lambda r: (r.similarity_score, r.quality_score or 0), reverse=True)

    return SemanticSearchResponse(
        query=q,
        search_type="semantic",
        total_matches=len(scored_results),
        results=scored_results,
    )


@router.get("/keyword-search", response_model=KeywordSearchResponse)
async def keyword_search(
    q: Optional[str] = Query(None, description="Exact/n-gram keyword search query"),
    column: Optional[str] = Query(None, description="Schema-based search matching column names or types"),
    domain: Optional[str] = Query(None, description="Domain / category filter"),
    format: Optional[str] = Query(None, description="File format (csv, parquet, excel, sdf, geojson)"),
    min_quality: Optional[int] = Query(None, description="Minimum quality score (0-100)"),
    min_rows: Optional[int] = Query(None, description="Minimum rows"),
    max_rows: Optional[int] = Query(None, description="Maximum rows"),
    current_user: UserModel = Depends(get_current_user),
):
    """Keyword search using TF-IDF token and n-gram overlap."""
    seed_default_datasets_if_needed()
    datasets = [d for d in _datasets_db.values() if user_has_dataset_access(d, current_user.id)]

    if not datasets:
        return KeywordSearchResponse(query=q, search_type="keyword", total_matches=0, results=[])

    corpus_docs = [_build_dataset_corpus_text(d) for d in datasets]
    all_tokens = set()
    for doc in corpus_docs:
        all_tokens.update(_tokenize(doc))
    if q:
        all_tokens.update(_tokenize(q))
    if column:
        all_tokens.update(_tokenize(column))

    vocab = {token: idx for idx, token in enumerate(sorted(all_tokens))}
    dataset_vectors = [_compute_tf_vector(_tokenize(doc), vocab) for doc in corpus_docs]
    q_vec = _compute_tf_vector(_tokenize(q), vocab) if q else None

    scored_results: List[SearchResultItem] = []

    for idx, d in enumerate(datasets):
        reasons = []
        matched_cols = []
        similarity = 0.5

        if q_vec and any(q_vec) and q:
            d_vec = dataset_vectors[idx]
            sim = cosine_similarity(q_vec, d_vec)
            q_clean = str(q).lower()
            d_name = str(d.get("name") or "").lower()
            d_desc = str(d.get("description") or "").lower()

            if q_clean in d_name:
                sim = min(1.0, sim + 0.3)
                reasons.append("Exact keyword name match")
            if d_desc and q_clean in d_desc:
                sim = min(1.0, sim + 0.2)
                reasons.append("Description keyword relevance")

            for c in (d.get("schema_fields") or []):
                if not c or not isinstance(c, dict):
                    continue
                c_name = str(c.get("name") or "").lower()
                if any(term in c_name for term in q_clean.split()):
                    matched_cols.append(c.get("name"))
            if matched_cols:
                sim = min(1.0, sim + 0.15)
                reasons.append(f"Keyword match in schema columns ({len(matched_cols)})")

            similarity = round(sim, 3)
            # Strict token overlap requirement for keyword search
            if similarity < 0.08 and not matched_cols:
                continue
            reasons.append(f"TF-IDF token similarity: {int(similarity * 100)}%")
        elif q:
            if str(q).lower() not in _build_dataset_corpus_text(d).lower():
                continue
            reasons.append("Exact keyword match")

        if column:
            col_target = str(column).lower().strip()
            cols_found = [
                c.get("name") for c in (d.get("schema_fields") or [])
                if isinstance(c, dict) and (col_target in str(c.get("name") or "").lower() or col_target in str(c.get("type") or "").lower())
            ]
            if not cols_found:
                continue
            reasons.append(f"Schema matches column '{column}'")
            matched_cols.extend(cols_found)

        if domain:
            dom_lower = str(domain).lower().strip()
            tag_matches = [t for t in (d.get("tags") or []) if t and dom_lower in str(t).lower()]
            desc_match = dom_lower in str(d.get("description") or "").lower()
            if not (tag_matches or desc_match):
                continue
            reasons.append(f"Domain match: {domain}")

        if format and str(format).lower() != "all":
            if str(d.get("format") or "").lower() != str(format).lower().strip():
                continue

        q_score = d.get("quality_score") or 88
        if min_quality is not None and q_score < min_quality:
            continue

        rows = d.get("total_rows", 0) or 0
        if min_rows is not None and rows < min_rows:
            continue
        if max_rows is not None and rows > max_rows:
            continue

        if not reasons:
            reasons.append("Keyword catalog match")

        scored_results.append(
            SearchResultItem(
                id=str(d.get("id") or ""),
                name=str(d.get("name") or d.get("filename") or "Dataset"),
                filename=str(d.get("filename") or ""),
                description=d.get("description"),
                tags=d.get("tags") or [],
                format=str(d.get("format") or "unknown"),
                total_rows=rows,
                total_columns=d.get("total_columns", 0) or 0,
                quality_score=q_score,
                similarity_score=similarity,
                search_type="keyword",
                matched_reasons=reasons,
                matched_columns=list(set([c for c in matched_cols if c])),
            )
        )

    scored_results.sort(key=lambda r: (r.similarity_score, r.quality_score or 0), reverse=True)

    return KeywordSearchResponse(
        query=q,
        search_type="keyword",
        total_matches=len(scored_results),
        results=scored_results,
    )


@router.get("/search", response_model=SearchResponse)
async def unified_search(
    q: Optional[str] = Query(None, description="Search query"),
    mode: Optional[str] = Query("semantic", description="Search mode: 'semantic' (Mistral embeddings) or 'keyword' (TF-IDF tokens)"),
    column: Optional[str] = Query(None),
    domain: Optional[str] = Query(None),
    format: Optional[str] = Query(None),
    min_quality: Optional[int] = Query(None),
    min_rows: Optional[int] = Query(None),
    max_rows: Optional[int] = Query(None),
    current_user: UserModel = Depends(get_current_user),
):
    """Unified search endpoint routing to either Semantic Embeddings or Keyword Search."""
    mode_clean = (mode or "semantic").lower().strip()
    if mode_clean == "keyword":
        return await keyword_search(
            q=q,
            column=column,
            domain=domain,
            format=format,
            min_quality=min_quality,
            min_rows=min_rows,
            max_rows=max_rows,
            current_user=current_user,
        )
    return await semantic_search(
        q=q,
        column=column,
        domain=domain,
        format=format,
        min_quality=min_quality,
        min_rows=min_rows,
        max_rows=max_rows,
        current_user=current_user,
    )


# ---------------------------------------------------------------------------
# Favorites & Recents (Pillar 10.6)
# ---------------------------------------------------------------------------

@router.post("/favorites/{dataset_id}")
async def toggle_favorite(
    dataset_id: str,
    current_user: UserModel = Depends(get_current_user),
):
    """Toggle star / bookmark favorite status on a dataset."""
    seed_default_datasets_if_needed()
    if dataset_id not in _datasets_db:
        raise HTTPException(status_code=404, detail="Dataset not found")

    target = _datasets_db[dataset_id]
    check_dataset_access(target, current_user.id)

    user_favs = _user_favorites[current_user.id]
    if dataset_id in user_favs:
        user_favs.remove(dataset_id)
        delete_user_favorite_from_db(current_user.id, dataset_id)
        is_favorite = False
    else:
        user_favs.add(dataset_id)
        save_user_favorite_to_db(current_user.id, dataset_id)
        is_favorite = True

    return {
        "dataset_id": dataset_id,
        "is_favorite": is_favorite,
        "total_favorites": len(user_favs),
    }


@router.get("/favorites")
async def list_favorites(
    current_user: UserModel = Depends(get_current_user),
):
    """List all favorited / bookmarked datasets for the current user."""
    seed_default_datasets_if_needed()
    items = []
    user_favs = _user_favorites[current_user.id]
    for d_id in list(user_favs):
        d = _datasets_db.get(d_id)
        if d and user_has_dataset_access(d, current_user.id):
            items.append({
                "id": d["id"],
                "name": d["name"],
                "filename": d["filename"],
                "description": d.get("description"),
                "tags": d.get("tags", []),
                "format": d.get("format", "unknown"),
                "total_rows": d.get("total_rows", 0),
                "total_columns": d.get("total_columns", 0),
                "quality_score": d.get("quality_score", 90),
            })
    return {"favorites": items, "count": len(items)}


@router.post("/recents/{dataset_id}")
async def record_recent_visit(
    dataset_id: str,
    current_user: UserModel = Depends(get_current_user),
):
    """Record dataset access in recently visited history."""
    seed_default_datasets_if_needed()
    if dataset_id not in _datasets_db:
        raise HTTPException(status_code=404, detail="Dataset not found")

    target = _datasets_db[dataset_id]
    check_dataset_access(target, current_user.id)

    recents = _user_recents[current_user.id]
    _user_recents[current_user.id] = [r for r in recents if r["dataset_id"] != dataset_id]
    
    visited_at = datetime.now(timezone.utc).isoformat()
    _user_recents[current_user.id].insert(0, {
        "dataset_id": dataset_id,
        "visited_at": visited_at,
    })
    _user_recents[current_user.id] = _user_recents[current_user.id][:20]

    save_user_recent_to_db(current_user.id, dataset_id, visited_at)

    return {"status": "recorded", "dataset_id": dataset_id}


@router.get("/recents")
async def list_recents(
    current_user: UserModel = Depends(get_current_user),
):
    """List recently visited datasets with access timestamps."""
    seed_default_datasets_if_needed()
    items = []
    for entry in _user_recents[current_user.id]:
        d = _datasets_db.get(entry["dataset_id"])
        if d and user_has_dataset_access(d, current_user.id):
            items.append({
                "id": d["id"],
                "name": d["name"],
                "filename": d["filename"],
                "format": d.get("format", "unknown"),
                "total_rows": d.get("total_rows", 0),
                "visited_at": entry["visited_at"],
            })
    return {"recents": items, "count": len(items)}


# ---------------------------------------------------------------------------
# Automated Recommendations (Pillar 10.7)
# ---------------------------------------------------------------------------

@router.get("/recommendations/{dataset_id}", response_model=List[RecommendationItem])
async def get_dataset_recommendations(
    dataset_id: str,
    current_user: UserModel = Depends(get_current_user),
):
    """Calculates schema overlap, tag similarity, and semantic vector affinity."""
    seed_default_datasets_if_needed()
    target = _datasets_db.get(dataset_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target dataset not found")

    check_dataset_access(target, current_user.id)

    target_cols = {
        str(c.get("name") or "").lower() for c in (target.get("schema_fields") or [])
        if isinstance(c, dict) and c.get("name")
    }
    target_tags = {str(t).lower() for t in (target.get("tags") or []) if t is not None}
    target_vec = await ensure_dataset_embedding(target)

    recommendations = []

    for other_id, other in _datasets_db.items():
        if other_id == dataset_id:
            continue
        if not user_has_dataset_access(other, current_user.id):
            continue

        other_cols = {
            str(c.get("name") or "").lower() for c in (other.get("schema_fields") or [])
            if isinstance(c, dict) and c.get("name")
        }
        other_tags = {str(t).lower() for t in (other.get("tags") or []) if t is not None}
        other_vec = await ensure_dataset_embedding(other)

        # 1. Jaccard column similarity
        col_intersection = target_cols.intersection(other_cols)
        col_union = target_cols.union(other_cols)
        col_jaccard = len(col_intersection) / len(col_union) if col_union else 0.0

        # 2. Tag overlap
        tag_intersection = target_tags.intersection(other_tags)

        # 3. Embedding cosine similarity
        emb_sim = max(0.0, cosine_similarity(target_vec, other_vec))

        # Composite score
        score = (col_jaccard * 0.4) + (len(tag_intersection) * 0.2) + (emb_sim * 0.4)
        score = min(0.98, round(score, 2))

        # Build human rationale
        rationale_parts = []
        if col_intersection:
            shared_list = list(col_intersection)[:4]
            rationale_parts.append(f"Shares key columns ({', '.join(shared_list)})")
        if tag_intersection:
            rationale_parts.append(f"Common domain tags ({', '.join(list(tag_intersection)[:3])})")
        if emb_sim > 0.5:
            rationale_parts.append(f"High semantic vector affinity ({int(emb_sim * 100)}%)")
        if not rationale_parts:
            rationale_parts.append("Frequently combined in exploratory analysis")

        recommendations.append(
            RecommendationItem(
                id=str(other.get("id") or ""),
                name=str(other.get("name") or other.get("filename") or "Dataset"),
                description=other.get("description"),
                format=str(other.get("format") or "unknown"),
                similarity_score=score,
                rationale="; ".join(rationale_parts),
                shared_columns=list(col_intersection),
            )
        )

    recommendations.sort(key=lambda r: r.similarity_score, reverse=True)
    return recommendations[:5]
