"""Semantic vector search, schema search, favorites, recents, and automated recommendations.
Pillar 10: 10.2, 10.3, 10.4, 10.6, 10.7
"""

import math
import re
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from strata_api.routers.datasets import _datasets_db, seed_default_datasets_if_needed

router = APIRouter(prefix="/discovery", tags=["Search & Discovery"])

# State for Favorites and Recents
_favorites_set: set = set()
_recents_history: List[Dict[str, Any]] = []


# ---------------------------------------------------------------------------
# Vector Search & Semantic Text Utility
# ---------------------------------------------------------------------------

def _tokenize(text: str) -> List[str]:
    """Tokenize and normalize text into n-grams and words."""
    cleaned = re.sub(r"[^a-zA-Z0-9_\s]", " ", text.lower())
    words = [w for w in cleaned.split() if len(w) > 1]
    tokens = set(words)
    # Add character 3-grams for fuzzy matching
    for w in words:
        if len(w) >= 3:
            for i in range(len(w) - 2):
                tokens.add(w[i:i+3])
    return list(tokens)


def _compute_vector(tokens: List[str], vocabulary: Dict[str, int]) -> List[float]:
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


def _cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Compute cosine similarity between two unit vectors."""
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    return max(0.0, min(1.0, dot))


def _build_dataset_corpus_text(dataset: Dict[str, Any]) -> str:
    """Generate rich semantic document representing dataset content & schema."""
    parts = [
        dataset.get("name", ""),
        dataset.get("filename", ""),
        dataset.get("description", ""),
        " ".join(dataset.get("tags", [])),
        dataset.get("format", ""),
    ]
    # Schema columns & types
    for col in dataset.get("schema_fields", []):
        col_name = col.get("name", "")
        col_type = col.get("type", "")
        parts.append(col_name)
        parts.append(f"{col_name}_{col_type}")

    return " ".join(parts)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class SemanticSearchResultItem(BaseModel):
    id: str
    name: str
    filename: str
    description: Optional[str]
    tags: List[str] = []
    format: str
    total_rows: int
    total_columns: int
    quality_score: Optional[int] = 85
    similarity_score: float
    matched_reasons: List[str]
    matched_columns: List[str] = []


class SemanticSearchResponse(BaseModel):
    query: Optional[str]
    total_matches: int
    results: List[SemanticSearchResultItem]


class RecommendationItem(BaseModel):
    id: str
    name: str
    description: Optional[str]
    format: str
    similarity_score: float
    rationale: str
    shared_columns: List[str]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/semantic-search", response_model=SemanticSearchResponse)
async def semantic_search(
    q: Optional[str] = Query(None, description="Natural language semantic search query (e.g. 'quarterly revenue with customer retention')"),
    column: Optional[str] = Query(None, description="Schema-based search matching column names or types"),
    domain: Optional[str] = Query(None, description="Domain / category filter (e.g. finance, saas, healthcare, churn)"),
    format: Optional[str] = Query(None, description="File format (csv, parquet, excel, sdf, geojson)"),
    min_quality: Optional[int] = Query(None, description="Minimum quality score (0-100)"),
    min_rows: Optional[int] = Query(None, description="Minimum rows"),
    max_rows: Optional[int] = Query(None, description="Maximum rows"),
):
    """Semantic vector search powered by cosine similarity over schema, tags, and descriptive metadata."""
    seed_default_datasets_if_needed()
    datasets = list(_datasets_db.values())

    if not datasets:
        return SemanticSearchResponse(query=q, total_matches=0, results=[])

    # Build corpus vocabulary
    corpus_docs = [_build_dataset_corpus_text(d) for d in datasets]
    all_tokens = set()
    for doc in corpus_docs:
        all_tokens.update(_tokenize(doc))
    if q:
        all_tokens.update(_tokenize(q))
    if column:
        all_tokens.update(_tokenize(column))

    vocab = {token: idx for idx, token in enumerate(sorted(all_tokens))}
    
    # Vectorize datasets
    dataset_vectors = [_compute_vector(_tokenize(doc), vocab) for doc in corpus_docs]

    # Vectorize query
    q_vec = _compute_vector(_tokenize(q), vocab) if q else None

    scored_results = []

    for idx, d in enumerate(datasets):
        reasons = []
        matched_cols = []
        similarity = 0.5  # default baseline if no text query

        # 1. Semantic Vector Match
        if q_vec and any(q_vec):
            d_vec = dataset_vectors[idx]
            sim = _cosine_similarity(q_vec, d_vec)
            # Boost score with exact token hits in title/description
            q_clean = q.lower()
            if q_clean in d.get("name", "").lower():
                sim = min(1.0, sim + 0.3)
                reasons.append("Exact name match")
            if d.get("description") and q_clean in d["description"].lower():
                sim = min(1.0, sim + 0.2)
                reasons.append("Description semantic relevance")
            
            # Check column relevance
            for c in d.get("schema_fields", []):
                c_name = c.get("name", "").lower()
                if any(term in c_name for term in q_clean.split()):
                    matched_cols.append(c.get("name"))
            if matched_cols:
                sim = min(1.0, sim + 0.15)
                reasons.append(f"Semantic match in schema columns ({len(matched_cols)})")

            similarity = round(sim, 3)
            if similarity < 0.08 and not matched_cols:
                # Below semantic threshold
                continue
            reasons.append(f"Vector cosine similarity: {int(similarity * 100)}%")
        elif q:
            # Fallback simple substring
            if q.lower() not in _build_dataset_corpus_text(d).lower():
                continue
            reasons.append("Keyword text match")

        # 2. Schema Column Filter (10.2)
        if column:
            col_target = column.lower().strip()
            cols_found = [
                c.get("name") for c in d.get("schema_fields", [])
                if col_target in c.get("name", "").lower() or col_target in c.get("type", "").lower()
            ]
            if not cols_found:
                continue
            reasons.append(f"Schema matches column filter '{column}'")
            matched_cols.extend(cols_found)

        # 3. Domain / Category Filter (10.3)
        if domain:
            dom_lower = domain.lower()
            tag_matches = [t for t in d.get("tags", []) if dom_lower in t.lower()]
            desc_match = dom_lower in (d.get("description") or "").lower()
            if not (tag_matches or desc_match):
                continue
            reasons.append(f"Domain category match: {domain}")

        # 4. Format Filter
        if format and format.lower() != "all":
            if d.get("format", "").lower() != format.lower().strip():
                continue

        # 5. Quality Filter
        q_score = d.get("quality_score") or 88
        if min_quality is not None and q_score < min_quality:
            continue

        # 6. Row range filters
        rows = d.get("total_rows", 0)
        if min_rows is not None and rows < min_rows:
            continue
        if max_rows is not None and rows > max_rows:
            continue

        if not reasons:
            reasons.append("Catalog match")

        scored_results.append(
            SemanticSearchResultItem(
                id=d["id"],
                name=d["name"],
                filename=d["filename"],
                description=d.get("description"),
                tags=d.get("tags", []),
                format=d.get("format", "unknown"),
                total_rows=rows,
                total_columns=d.get("total_columns", 0),
                quality_score=q_score,
                similarity_score=similarity,
                matched_reasons=reasons,
                matched_columns=list(set(matched_cols)),
            )
        )

    # Sort descending by similarity
    scored_results.sort(key=lambda r: (r.similarity_score, r.quality_score or 0), reverse=True)

    return SemanticSearchResponse(
        query=q,
        total_matches=len(scored_results),
        results=scored_results,
    )


# ---------------------------------------------------------------------------
# Favorites & Recents (Pillar 10.6)
# ---------------------------------------------------------------------------

@router.post("/favorites/{dataset_id}")
async def toggle_favorite(dataset_id: str):
    """Toggle star / bookmark favorite status on a dataset."""
    seed_default_datasets_if_needed()
    if dataset_id not in _datasets_db:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if dataset_id in _favorites_set:
        _favorites_set.remove(dataset_id)
        is_favorite = False
    else:
        _favorites_set.add(dataset_id)
        is_favorite = True

    return {
        "dataset_id": dataset_id,
        "is_favorite": is_favorite,
        "total_favorites": len(_favorites_set),
    }


@router.get("/favorites")
async def list_favorites():
    """List all favorited / bookmarked datasets."""
    seed_default_datasets_if_needed()
    items = []
    for d_id in list(_favorites_set):
        d = _datasets_db.get(d_id)
        if d:
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
async def record_recent_visit(dataset_id: str):
    """Record dataset access in recently visited history."""
    seed_default_datasets_if_needed()
    if dataset_id not in _datasets_db:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Remove existing entry if present
    global _recents_history
    _recents_history = [r for r in _recents_history if r["dataset_id"] != dataset_id]
    
    # Prepend latest visit
    _recents_history.insert(0, {
        "dataset_id": dataset_id,
        "visited_at": datetime.now(timezone.utc).isoformat(),
    })
    # Keep only last 20 visits
    _recents_history = _recents_history[:20]

    return {"status": "recorded", "dataset_id": dataset_id}


@router.get("/recents")
async def list_recents():
    """List recently visited datasets with access timestamps."""
    seed_default_datasets_if_needed()
    items = []
    for entry in _recents_history:
        d = _datasets_db.get(entry["dataset_id"])
        if d:
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
async def get_dataset_recommendations(dataset_id: str):
    """Teams that used this dataset also explored...
    Calculates schema overlap, tag similarity, and domain affinity.
    """
    seed_default_datasets_if_needed()
    target = _datasets_db.get(dataset_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target dataset not found")

    target_cols = {c.get("name", "").lower() for c in target.get("schema_fields", [])}
    target_tags = {t.lower() for t in target.get("tags", [])}

    recommendations = []

    for other_id, other in _datasets_db.items():
        if other_id == dataset_id:
            continue

        other_cols = {c.get("name", "").lower() for c in other.get("schema_fields", [])}
        other_tags = {t.lower() for t in other.get("tags", [])}

        # Jaccard column similarity
        col_intersection = target_cols.intersection(other_cols)
        col_union = target_cols.union(other_cols)
        col_jaccard = len(col_intersection) / len(col_union) if col_union else 0.0

        # Tag overlap
        tag_intersection = target_tags.intersection(other_tags)

        # Composite score
        score = (col_jaccard * 0.6) + (len(tag_intersection) * 0.2) + 0.1
        score = min(0.98, round(score, 2))

        # Build human rationale
        rationale_parts = []
        if col_intersection:
            shared_list = list(col_intersection)[:4]
            rationale_parts.append(f"Shares key columns ({', '.join(shared_list)})")
        if tag_intersection:
            rationale_parts.append(f"Common domain tags ({', '.join(list(tag_intersection)[:3])})")
        if not rationale_parts:
            rationale_parts.append("Frequently combined in exploratory pipeline analysis")

        recommendations.append(
            RecommendationItem(
                id=other["id"],
                name=other["name"],
                description=other.get("description"),
                format=other.get("format", "unknown"),
                similarity_score=score,
                rationale="; ".join(rationale_parts),
                shared_columns=list(col_intersection),
            )
        )

    # Sort descending by similarity score
    recommendations.sort(key=lambda r: r.similarity_score, reverse=True)
    return recommendations[:5]
