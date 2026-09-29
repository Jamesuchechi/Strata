"""Mistral Embeddings provider and vector similarity utility.

Uses Mistral's embedding API (model: mistral-embed, 1024 dimensions) to
embed dataset metadata, descriptions, schemas, and user search queries.
"""

from __future__ import annotations

import logging
import math
import re
from typing import Any, Dict, List, Optional
import httpx

from strata_api.config import settings

logger = logging.getLogger(__name__)

MISTRAL_EMBEDDING_DIM = 1024
MISTRAL_EMBEDDINGS_URL = "https://api.mistral.ai/v1/embeddings"


def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Compute cosine similarity between two float vectors."""
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0
    dot = 0.0
    norm_a = 0.0
    norm_b = 0.0
    for a, b in zip(vec_a, vec_b):
        dot += a * b
        norm_a += a * a
        norm_b += b * b
    if norm_a <= 0.0 or norm_b <= 0.0:
        return 0.0
    sim = dot / (math.sqrt(norm_a) * math.sqrt(norm_b))
    return max(-1.0, min(1.0, sim))


def build_dataset_embedding_text(dataset: Dict[str, Any]) -> str:
    """Construct a dense semantic document representation for a dataset."""
    name = dataset.get("name") or dataset.get("filename") or "Dataset"
    filename = dataset.get("filename") or ""
    description = dataset.get("description") or ""
    tags = " ".join(dataset.get("tags") or [])
    format_str = dataset.get("format") or ""

    schema_cols = []
    for col in dataset.get("schema_fields") or []:
        cname = col.get("name", "")
        ctype = col.get("type", "")
        schema_cols.append(f"{cname} ({ctype})")
    schema_str = ", ".join(schema_cols)

    parts = [
        f"Title: {name}",
        f"Filename: {filename}",
        f"Description: {description}",
        f"Domain Tags: {tags}",
        f"Format: {format_str}",
        f"Schema Columns: {schema_str}",
    ]
    return "\n".join(parts)


def _hash_token(token: str, dim: int) -> int:
    """Stable integer hash for a token across Python processes."""
    import hashlib
    digest = hashlib.sha256(token.encode("utf-8")).digest()
    return int.from_bytes(digest[:4], "big") % dim


def _deterministic_semantic_embedding(text: str, dim: int = MISTRAL_EMBEDDING_DIM) -> List[float]:
    """Generate a deterministic normalized dense vector for offline/test fallback.
    
    Uses sub-word character n-grams and stable hashing to produce consistent dense vectors
    with semantic proximity for related tokens when API keys are absent.
    """
    cleaned = re.sub(r"[^a-zA-Z0-9_\s]", " ", text.lower())
    words = cleaned.split()
    vec = [0.0] * dim

    for w_idx, word in enumerate(words):
        # Hash full word
        h_word = _hash_token(word, dim)
        vec[h_word] += 2.0 / (w_idx + 1) ** 0.5
        # Sub-word 3-grams
        for i in range(len(word) - 2):
            ng = word[i:i+3]
            h_ng = _hash_token(ng, dim)
            vec[h_ng] += 1.0

    # Unit normalize
    norm = math.sqrt(sum(v * v for v in vec))
    if norm > 0:
        vec = [v / norm for v in vec]
    else:
        vec[0] = 1.0
    return vec


class MistralEmbeddingProvider:
    """Embedding client for Mistral's mistral-embed API."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "mistral-embed",
        timeout: float = 15.0,
    ):
        self.api_key = api_key or settings.MISTRAL_API_KEY
        self.model = model
        self.timeout = timeout

    async def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embedding vectors for a batch of text strings."""
        if not texts:
            return []

        # If no API key configured, use deterministic fallback
        if not self.api_key:
            logger.info("MISTRAL_API_KEY is not configured; using dense semantic fallback embedding")
            return [_deterministic_semantic_embedding(t) for t in texts]

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "input": texts,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(MISTRAL_EMBEDDINGS_URL, headers=headers, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    raw_data = data.get("data", [])
                    # Sort by index if provided
                    raw_data.sort(key=lambda x: x.get("index", 0))
                    embeddings = [item["embedding"] for item in raw_data if "embedding" in item]
                    if len(embeddings) == len(texts):
                        return embeddings
                logger.warning(
                    "Mistral embeddings returned HTTP %d: %s; falling back to dense embedding",
                    resp.status_code,
                    resp.text[:200],
                )
        except Exception as exc:
            logger.warning("Mistral embeddings request failed (%s); falling back to dense embedding", exc)

        return [_deterministic_semantic_embedding(t) for t in texts]

    async def get_single_embedding(self, text: str) -> List[float]:
        """Generate embedding vector for a single text string."""
        results = await self.get_embeddings([text])
        return results[0] if results else _deterministic_semantic_embedding(text)


_default_embedding_provider: Optional[MistralEmbeddingProvider] = None


def get_embedding_provider() -> MistralEmbeddingProvider:
    """Get singleton instance of MistralEmbeddingProvider."""
    global _default_embedding_provider
    if _default_embedding_provider is None:
        _default_embedding_provider = MistralEmbeddingProvider()
    return _default_embedding_provider
