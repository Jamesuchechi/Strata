"""Public dataset showcase, embed widgets, academic citations, license selector, and dataset forking.
Pillar 11: 11.2, 11.3, 11.4, 11.5, 11.6, 11.7
"""

import os
import shutil
import hashlib
from typing import Dict, List, Optional, Any, Set
from collections import defaultdict
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field

from strata_api.models.user import UserModel
from strata_api.routers.auth import get_current_user, get_optional_current_user
from strata_api.routers.datasets import (
    _datasets_db,
    register_dataset_in_store,
    get_storage_dir,
    seed_default_datasets_if_needed,
)
from strata_api.core.persistence import (
    save_showcase_item_to_db,
    save_user_starred_showcase_to_db,
    delete_user_starred_showcase_from_db,
)

router = APIRouter(prefix="/showcase", tags=["Public Showcase & Sharing"])


# ---------------------------------------------------------------------------
# Standard Licenses Catalog (Pillar 11.5)
# ---------------------------------------------------------------------------

LICENSES_CATALOG = [
    {
        "id": "CC-BY-4.0",
        "name": "Creative Commons Attribution 4.0 International",
        "type": "Permissive / Open Data",
        "url": "https://creativecommons.org/licenses/by/4.0/",
        "description": "Allows sharing and adapting material as long as appropriate credit is given.",
        "commercial_use": True,
    },
    {
        "id": "MIT",
        "name": "MIT License",
        "type": "Software & Code",
        "url": "https://opensource.org/licenses/MIT",
        "description": "Extremely permissive software and dataset reuse license.",
        "commercial_use": True,
    },
    {
        "id": "Apache-2.0",
        "name": "Apache License 2.0",
        "type": "Permissive / Patent Grants",
        "url": "https://www.apache.org/licenses/LICENSE-2.0",
        "description": "Permissive open license with explicit contributor patent grants.",
        "commercial_use": True,
    },
    {
        "id": "CC0-1.0",
        "name": "Creative Commons CC0 1.0 Universal (Public Domain)",
        "type": "Public Domain Dedication",
        "url": "https://creativecommons.org/publicdomain/zero/1.0/",
        "description": "Waives all copyright and related rights worldwide. Free for any use without attribution.",
        "commercial_use": True,
    },
    {
        "id": "ODC-PDDL",
        "name": "Open Data Commons Public Domain Dedication and License",
        "type": "Open Data Dedicated",
        "url": "https://opendatacommons.org/licenses/pddl/",
        "description": "Specialized open data dedication placing the dataset in the public domain.",
        "commercial_use": True,
    },
    {
        "id": "ODC-ODbL",
        "name": "Open Data Commons Open Database License (ODbL)",
        "type": "Share-Alike Attribution",
        "url": "https://opendatacommons.org/licenses/odbl/",
        "description": "Allows sharing, modifying, and producing works from database with attribution and share-alike terms.",
        "commercial_use": True,
    },
]

# ---------------------------------------------------------------------------
# Public Showcase Registry (Dynamically populated from real published datasets)
# ---------------------------------------------------------------------------

_showcase_registry: Dict[str, Dict[str, Any]] = {}

# User starred showcase items scoped per user_id
_user_starred_showcase: Dict[str, Set[str]] = defaultdict(set)


class PublishShowcaseRequest(BaseModel):
    dataset_id: str
    domain: str = "General Science"
    license: str = "CC-BY-4.0"
    tags: List[str] = Field(default_factory=list)
    description: Optional[str] = None
    doi: Optional[str] = None



# ---------------------------------------------------------------------------
# Citation Formatter (Pillar 11.4)
# ---------------------------------------------------------------------------

def _generate_citations(item: Dict[str, Any]) -> Dict[str, str]:
    """Generate standardized academic and professional citations."""
    title = item.get("title", "Dataset")
    author = item.get("author", "Strata Community")
    year = 2026
    doi = item.get("doi", f"10.5281/strata.{item['id']}")
    url = f"https://strata.data/showcase/{item['id']}"

    bibtex = f"""@misc{{{item['id']},
  author       = {{{author}}},
  title        = {{{{{title}}}}},
  year         = {{{year}}},
  publisher    = {{Strata Open Data Hub}},
  version      = {{v1.0}},
  doi          = {{{doi}}},
  url          = {{{url}}}
}}"""

    apa = f"{author} ({year}). {title} (Version 1.0) [Data set]. Strata Open Data Hub. https://doi.org/{doi}"
    ieee = f'{author}, "{title}," Strata Open Data Hub, 2026. doi: {doi}.'
    harvard = f"{author}, {year}. {title}. [dataset] Strata Open Data Hub. Available at: <{url}> [Accessed {datetime.now(timezone.utc).strftime('%d %b %Y')}]."
    chicago = f'{author}. "{title}." Strata Open Data Hub, {year}. https://doi.org/{doi}.'

    return {
        "doi": doi,
        "bibtex": bibtex,
        "apa": apa,
        "ieee": ieee,
        "harvard": harvard,
        "chicago": chicago,
    }


# ---------------------------------------------------------------------------
# Embed Config Generator (Pillar 11.3)
# ---------------------------------------------------------------------------

def _generate_embed_snippets(item: Dict[str, Any], theme: str = "light", show_schema: bool = True) -> Dict[str, str]:
    """Generate responsive embed widget codes for blogs, docs, and websites."""
    embed_url = f"https://strata.data/embed/{item['id']}?theme={theme}&schema={str(show_schema).lower()}"
    
    iframe_html = (
        f'<iframe\n'
        f'  src="{embed_url}"\n'
        f'  title="{item.get("title", "Strata Dataset Preview")}"\n'
        f'  width="100%"\n'
        f'  height="520"\n'
        f'  frameborder="0"\n'
        f'  allow="clipboard-write"\n'
        f'  style="border: 1px solid #E8E4DF; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);"\n'
        f'></iframe>'
    )

    react_jsx = (
        f'<div className="w-full my-6 rounded-xl overflow-hidden border border-[#E8E4DF] shadow-sm">\n'
        f'  <iframe\n'
        f'    src="{embed_url}"\n'
        f'    className="w-full h-[520px] border-none"\n'
        f'    title="{item.get("title")}"\n'
        f'  />\n'
        f'</div>'
    )

    markdown = f'[![Strata Dataset: {item.get("title")}](https://strata.data/badges/{item["id"]}.svg)]({embed_url})'

    return {
        "embed_url": embed_url,
        "iframe": iframe_html,
        "react": react_jsx,
        "markdown": markdown,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/publish")
async def publish_dataset_to_showcase(
    req: PublishShowcaseRequest,
    current_user: UserModel = Depends(get_current_user),
):
    """Publish a real workspace dataset to the Public Showcase & Hub (Pillar 11.2)."""
    seed_default_datasets_if_needed()
    record = _datasets_db.get(req.dataset_id)
    if not record:
        for r in _datasets_db.values():
            if (
                r.get("id") == req.dataset_id
                or r.get("filename") == req.dataset_id
                or r.get("name") == req.dataset_id
                or r.get("view_name") == req.dataset_id
                or (r.get("content_hash") and r["content_hash"].startswith(req.dataset_id))
            ):
                record = r
                break
    if not record:
        raise HTTPException(status_code=404, detail=f"Dataset '{req.dataset_id}' not found in workspace.")


    showcase_id = f"showcase_{record['id']}"
    author_name = getattr(current_user, "full_name", None) or getattr(current_user, "email", None) or "Strata Community"


    schema_fields = record.get("schema_fields", [])
    sample_rows = record.get("preview_rows", [])[:20]
    view_name = record.get("view_name", "dataset_view")
    sample_query = f"SELECT * FROM {view_name} LIMIT 10;"
    tags = list(set((req.tags or []) + (record.get("tags") or [])))

    raw_quality = record.get("full_quality")
    if isinstance(raw_quality, dict):
        q_score = float(raw_quality.get("overall_score") or raw_quality.get("score") or 95.0)
    elif raw_quality is not None:
        try:
            q_score = float(raw_quality)
        except (ValueError, TypeError):
            q_score = 95.0
    else:
        q_score = float(record.get("quality_score", 95.0))

    title = record.get("name") or record.get("filename") or str(record.get("id", "dataset"))
    slug = title.lower().replace(" ", "-").replace(".", "-")

    item = {
        "id": showcase_id,
        "title": title,
        "slug": slug,
        "domain": req.domain or "General Science",
        "description": req.description or record.get("description") or f"Public dataset '{title}' published via Strata.",
        "author": author_name,
        "author_avatar": None,
        "author_verified": True,
        "format": record.get("format", "parquet"),
        "license": req.license or "CC-BY-4.0",
        "doi": req.doi or f"10.5281/strata.{record['id']}",
        "tags": tags,
        "total_rows": record.get("total_rows", 0),
        "total_columns": record.get("total_columns", 0),
        "size_bytes": record.get("size_bytes", 0),
        "quality_score": q_score,
        "stars": 0,
        "downloads": 0,
        "forks": 0,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "schema_fields": schema_fields,
        "sample_rows": sample_rows,
        "sample_query": sample_query,
        "dataset_id": record["id"],
        "owner_id": current_user.id,
    }


    _showcase_registry[showcase_id] = item
    save_showcase_item_to_db(item)

    return {
        "status": "published",
        "message": f"Dataset '{item['title']}' has been published to the Public Showcase!",
        "showcase_id": showcase_id,
        "dataset": item,
    }


# Public-by-design endpoint:
# Open data showcase catalog allowing public visitors and researchers to discover
# community and benchmark datasets without an active user session.
@router.get("")
async def list_showcase_datasets(
    domain: Optional[str] = Query(None, description="Filter by domain category"),
    tag: Optional[str] = Query(None, description="Filter by tag"),
    q: Optional[str] = Query(None, description="Search query across titles and descriptions"),
    sort_by: str = Query("trending", description="Sort by: trending, stars, downloads, recent, quality"),
    current_user: Optional[UserModel] = Depends(get_optional_current_user),
):
    """List public showcase datasets with filtering and sort controls (Pillar 11.2, 11.6)."""
    items = list(_showcase_registry.values())

    # Filtering
    if domain and domain.lower() != "all":
        items = [i for i in items if domain.lower() in i.get("domain", "").lower()]
    if tag:
        items = [i for i in items if any(tag.lower() in t.lower() for t in i.get("tags", []))]
    if q:
        q_clean = q.lower().strip()
        items = [
            i for i in items
            if q_clean in i.get("title", "").lower()
            or q_clean in i.get("description", "").lower()
            or any(q_clean in t.lower() for t in i.get("tags", []))
        ]

    # Sorting
    if sort_by == "stars":
        items.sort(key=lambda x: x.get("stars", 0), reverse=True)
    elif sort_by == "downloads":
        items.sort(key=lambda x: x.get("downloads", 0), reverse=True)
    elif sort_by == "quality":
        items.sort(key=lambda x: x.get("quality_score", 0), reverse=True)
    elif sort_by == "recent":
        items.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
    else:  # trending composite score
        items.sort(key=lambda x: (x.get("stars", 0) * 2 + x.get("downloads", 0)), reverse=True)

    # Attach is_starred
    user_stars = _user_starred_showcase[current_user.id] if current_user else set()
    enriched = []
    for item in items:
        copy_item = dict(item)
        copy_item["is_starred"] = item["id"] in user_stars
        enriched.append(copy_item)

    domains = ["All"]
    for i in _showcase_registry.values():
        d = i.get("domain")
        if d and d not in domains:
            domains.append(d)

    return {
        "total": len(enriched),
        "domains": domains,
        "datasets": enriched,
    }


# Public-by-design endpoint:
# Reference open-source and open-data license directory for public documentation and compliance lookup.
@router.get("/licenses")
async def get_licenses_catalog():
    """List standardized open licenses with usage permissions (Pillar 11.5)."""
    return {"licenses": LICENSES_CATALOG}


# Public-by-design endpoint:
# Public dossier for open datasets allowing public inspection of schema, sample preview, and citations.
@router.get("/{dataset_id}")
async def get_showcase_dataset(
    dataset_id: str,
    current_user: Optional[UserModel] = Depends(get_optional_current_user),
):
    """Detailed showcase page dossier with schema, sample preview, citations, and stats."""
    item = _showcase_registry.get(dataset_id)
    if not item:
        raise HTTPException(status_code=404, detail="Showcase dataset not found")

    citations = _generate_citations(item)
    embeds = _generate_embed_snippets(item)
    user_stars = _user_starred_showcase[current_user.id] if current_user else set()

    return {
        "dataset": {
            **item,
            "is_starred": dataset_id in user_stars,
        },
        "citations": citations,
        "embeds": embeds,
    }


@router.post("/{dataset_id}/star")
async def toggle_showcase_star(
    dataset_id: str,
    current_user: UserModel = Depends(get_current_user),
):
    """Star / bookmark a public showcase dataset (requires authentication)."""
    item = _showcase_registry.get(dataset_id)
    if not item:
        raise HTTPException(status_code=404, detail="Showcase dataset not found")

    user_stars = _user_starred_showcase[current_user.id]
    if dataset_id in user_stars:
        user_stars.remove(dataset_id)
        item["stars"] = max(0, item.get("stars", 1) - 1)
        delete_user_starred_showcase_from_db(current_user.id, dataset_id)
        save_showcase_item_to_db(item)
        is_starred = False
    else:
        user_stars.add(dataset_id)
        item["stars"] = item.get("stars", 0) + 1
        save_user_starred_showcase_to_db(current_user.id, dataset_id)
        save_showcase_item_to_db(item)
        is_starred = True

    return {
        "dataset_id": dataset_id,
        "is_starred": is_starred,
        "total_stars": item["stars"],
    }


@router.post("/{dataset_id}/download")
async def track_download(
    dataset_id: str,
    current_user: UserModel = Depends(get_current_user),
):
    """Increment download statistics and provide direct download payload info (requires authentication)."""
    item = _showcase_registry.get(dataset_id)
    if not item:
        raise HTTPException(status_code=404, detail="Showcase dataset not found")

    item["downloads"] = item.get("downloads", 0) + 1
    save_showcase_item_to_db(item)

    return {
        "status": "ready",
        "dataset_id": dataset_id,
        "total_downloads": item["downloads"],
        "format": item.get("format", "csv"),
        "download_url": f"/api/showcase/{dataset_id}/export",
        "message": f"Download tracking recorded for '{item.get('title')}'.",
    }



# Public-by-design endpoint:
# Academic citation generator in standard citation formats (BibTeX, APA, IEEE, etc.) for open research.
@router.get("/{dataset_id}/citation")
async def get_citation(dataset_id: str):
    """Automatic academic citation generation (BibTeX, APA, IEEE, Harvard, Chicago) (Pillar 11.4)."""
    item = _showcase_registry.get(dataset_id)
    if not item:
        raise HTTPException(status_code=404, detail="Showcase dataset not found")

    return _generate_citations(item)


# Public-by-design endpoint:
# Generates embed HTML/React code snippets for publicly embedding showcase dataset widgets.
@router.get("/{dataset_id}/embed-config")
async def get_embed_config(
    dataset_id: str,
    theme: str = Query("light", description="light or dark"),
    show_schema: bool = Query(True, description="Whether to include schema tab in embed"),
):
    """Generate responsive embed widget snippets (Pillar 11.3)."""
    item = _showcase_registry.get(dataset_id)
    if not item:
        raise HTTPException(status_code=404, detail="Showcase dataset not found")

    return _generate_embed_snippets(item, theme=theme, show_schema=show_schema)


@router.post("/{dataset_id}/fork")
async def fork_showcase_dataset(
    dataset_id: str,
    current_user: UserModel = Depends(get_current_user),
):
    """One-click public dataset forking into personal or team workspace (Pillar 11.7).
    Clones schema, sample data, and initializes a default version branch in Strata.
    """
    seed_default_datasets_if_needed()
    item = _showcase_registry.get(dataset_id)
    if not item:
        raise HTTPException(status_code=404, detail="Showcase dataset not found")

    storage_dir = get_storage_dir()
    source_record = _datasets_db.get(item.get("dataset_id", ""))
    if source_record and os.path.exists(source_record.get("file_path", "")):
        source_ext = os.path.splitext(source_record["filename"])[1] or f".{source_record.get('format', 'parquet')}"
        new_dataset_id = f"fork_{item['id']}_{int(datetime.now(timezone.utc).timestamp())}"
        target_filename = f"Fork_{source_record['filename']}"
        target_path = os.path.join(storage_dir, f"{new_dataset_id}{source_ext}")
        shutil.copyfile(source_record["file_path"], target_path)
    else:
        new_dataset_id = f"fork_{item['id']}_{int(datetime.now(timezone.utc).timestamp())}"
        target_filename = f"{new_dataset_id}.csv"
        target_path = os.path.join(storage_dir, target_filename)
        import polars as pl
        sample_rows = item.get("sample_rows", [])
        if sample_rows:
            df = pl.DataFrame(sample_rows)
            df.write_csv(target_path)
        else:
            with open(target_path, "w") as f:
                f.write("id,sample_value\n1,dummy\n")

    content_hash = hashlib.sha256(open(target_path, "rb").read()).hexdigest()


    # Register into user catalog (_datasets_db) with ownership assigned to current_user.id
    new_reg = register_dataset_in_store(
        file_path=target_path,
        filename=target_filename,
        content_hash=content_hash,
        description=f"Forked from public showcase: '{item.get('title')}'. Original Author: {item.get('author')}.",
        tags=item.get("tags", []) + ["forked", "showcase"],
        custom_id=new_dataset_id,
        owner_id=current_user.id,
    )

    # Increment fork count on showcase item
    item["forks"] = item.get("forks", 0) + 1
    save_showcase_item_to_db(item)

    return {
        "status": "forked",
        "message": f"Successfully forked '{item.get('title')}' into your workspace!",
        "new_dataset_id": new_dataset_id,
        "fork_count": item["forks"],
        "dataset": new_reg,
    }

