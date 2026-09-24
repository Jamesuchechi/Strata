"""Public dataset showcase, embed widgets, academic citations, license selector, and dataset forking.
Pillar 11: 11.2, 11.3, 11.4, 11.5, 11.6, 11.7
"""

import os
import shutil
import hashlib
from typing import Dict, List, Optional, Any
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
# Curated Public Showcase Registry (Pillars 11.2, 11.6)
# ---------------------------------------------------------------------------

_showcase_registry: Dict[str, Dict[str, Any]] = {
    "showcase_climate_risk": {
        "id": "showcase_climate_risk",
        "title": "Global Severe Weather & Climate Risk Index (1980–2024)",
        "slug": "global-severe-weather-climate-risk",
        "domain": "Geospatial & Climate",
        "description": "High-resolution geospatial registry of extreme climate events, regional temperature anomalies, economic damage, and disaster vulnerability scores.",
        "author": "Dr. Helena Vance, Earth Dynamics Lab",
        "author_avatar": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100",
        "author_verified": True,
        "format": "parquet",
        "license": "CC-BY-4.0",
        "doi": "10.5281/strata.climate.84920",
        "tags": ["climate", "geospatial", "weather", "risk", "environment"],
        "total_rows": 142850,
        "total_columns": 14,
        "size_bytes": 18450000,
        "quality_score": 98,
        "stars": 412,
        "downloads": 3840,
        "forks": 158,
        "updated_at": "2026-03-14T09:20:00Z",
        "schema_fields": [
            {"name": "event_id", "type": "VARCHAR", "description": "Unique climate hazard identifier"},
            {"name": "latitude", "type": "DOUBLE", "description": "Centroid latitude in WGS84"},
            {"name": "longitude", "type": "DOUBLE", "description": "Centroid longitude in WGS84"},
            {"name": "country_iso", "type": "VARCHAR", "description": "ISO 3166-1 alpha-3 territory code"},
            {"name": "hazard_type", "type": "VARCHAR", "description": "Drought, Flood, Tropical Cyclone, Wildfire, Heatwave"},
            {"name": "anomaly_celsius", "type": "DOUBLE", "description": "Surface temperature deviation from 1951-1980 baseline"},
            {"name": "estimated_damage_usd_m", "type": "DOUBLE", "description": "Economic asset loss in millions USD"},
            {"name": "vulnerability_index", "type": "DOUBLE", "description": "Standardized ND-GAIN infrastructure vulnerability (0-1)"},
            {"name": "year", "type": "BIGINT", "description": "Observation year"},
        ],
        "sample_rows": [
            {"event_id": "EV-2024-FL-001", "latitude": 45.4215, "longitude": -75.6972, "country_iso": "CAN", "hazard_type": "Flood", "anomaly_celsius": 1.84, "estimated_damage_usd_m": 420.5, "vulnerability_index": 0.28, "year": 2024},
            {"event_id": "EV-2024-WF-089", "latitude": -33.8688, "longitude": 151.2093, "country_iso": "AUS", "hazard_type": "Wildfire", "anomaly_celsius": 2.45, "estimated_damage_usd_m": 1280.0, "vulnerability_index": 0.35, "year": 2024},
            {"event_id": "EV-2023-HW-142", "latitude": 37.9838, "longitude": 23.7275, "country_iso": "GRC", "hazard_type": "Heatwave", "anomaly_celsius": 3.10, "estimated_damage_usd_m": 155.2, "vulnerability_index": 0.42, "year": 2023},
            {"event_id": "EV-2023-TC-201", "latitude": 14.5995, "longitude": 120.9842, "country_iso": "PHL", "hazard_type": "Tropical Cyclone", "anomaly_celsius": 1.22, "estimated_damage_usd_m": 890.4, "vulnerability_index": 0.74, "year": 2023},
        ],
        "sample_query": "SELECT hazard_type, country_iso, AVG(estimated_damage_usd_m) as avg_loss_usd_m\nFROM climate_risk\nWHERE year >= 2020\nGROUP BY hazard_type, country_iso\nORDER BY avg_loss_usd_m DESC\nLIMIT 10;",
    },
    "showcase_fintech_fraud": {
        "id": "showcase_fintech_fraud",
        "title": "Synthetic High-Frequency Fintech Transaction Fraud Benchmark",
        "slug": "fintech-transaction-fraud-benchmark",
        "domain": "Fintech & Security",
        "description": "Statistically calibrated financial ledger with multi-factor fraud signatures, velocity spikes, card-not-present signals, and chargeback outcomes.",
        "author": "Marcus Sterling, Quantitative Integrity Group",
        "author_avatar": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100",
        "author_verified": True,
        "format": "parquet",
        "license": "Apache-2.0",
        "doi": "10.5281/strata.fintech.99214",
        "tags": ["fintech", "fraud", "finance", "transactions", "aml", "classification"],
        "total_rows": 250000,
        "total_columns": 11,
        "size_bytes": 22300000,
        "quality_score": 96,
        "stars": 628,
        "downloads": 5210,
        "forks": 242,
        "updated_at": "2026-03-18T14:45:00Z",
        "schema_fields": [
            {"name": "tx_id", "type": "VARCHAR", "description": "Unique SHA256 hashed transaction identifier"},
            {"name": "timestamp", "type": "TIMESTAMP", "description": "UTC transaction execution timestamp"},
            {"name": "amount_usd", "type": "DOUBLE", "description": "Authorized transaction value in USD"},
            {"name": "merchant_category", "type": "VARCHAR", "description": "Electronics, Luxury, Grocery, Gaming, Crypto"},
            {"name": "card_present", "type": "BOOLEAN", "description": "Physical terminal EMV chip verification flag"},
            {"name": "device_risk_score", "type": "DOUBLE", "description": "Fingerprint risk telemetry (0.0 to 1.0)"},
            {"name": "ip_country_match", "type": "BOOLEAN", "description": "Geo-IP billing address alignment"},
            {"name": "is_fraudulent", "type": "BIGINT", "description": "Ground truth fraud label (0=Legitimate, 1=Confirmed Fraud)"},
        ],
        "sample_rows": [
            {"tx_id": "tx_9f81a702b", "timestamp": "2026-03-18T10:14:02Z", "amount_usd": 1420.50, "merchant_category": "Crypto", "card_present": False, "device_risk_score": 0.88, "ip_country_match": False, "is_fraudulent": 1},
            {"tx_id": "tx_3b11894ec", "timestamp": "2026-03-18T10:15:33Z", "amount_usd": 45.20, "merchant_category": "Grocery", "card_present": True, "device_risk_score": 0.05, "ip_country_match": True, "is_fraudulent": 0},
            {"tx_id": "tx_c478120fa", "timestamp": "2026-03-18T10:16:19Z", "amount_usd": 890.00, "merchant_category": "Electronics", "card_present": False, "device_risk_score": 0.72, "ip_country_match": True, "is_fraudulent": 1},
            {"tx_id": "tx_7e93012bb", "timestamp": "2026-03-18T10:17:45Z", "amount_usd": 12.50, "merchant_category": "Coffee", "card_present": True, "device_risk_score": 0.02, "ip_country_match": True, "is_fraudulent": 0},
        ],
        "sample_query": "SELECT merchant_category, COUNT(*) as total_tx, SUM(is_fraudulent) as fraud_count, ROUND(AVG(is_fraudulent) * 100, 2) as fraud_rate_pct\nFROM fintech_fraud\nGROUP BY merchant_category\nORDER BY fraud_rate_pct DESC;",
    },
    "showcase_fda_molecules": {
        "id": "showcase_fda_molecules",
        "title": "Bioactive Drug Discovery Molecules & Protein Binding Assays",
        "slug": "bioactive-drug-discovery-molecules",
        "domain": "Healthcare & Chemistry",
        "description": "Curated chemical library of 28,000 small molecules with verified SMILES, IUPAC descriptors, LogP, molecular weight, hydrogen bond donors, and bioactivity.",
        "author": "Dr. Sarah Lin, Computational Therapeutics Hub",
        "author_avatar": "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100",
        "author_verified": True,
        "format": "sdf",
        "license": "MIT",
        "doi": "10.5281/strata.pharma.41092",
        "tags": ["chemistry", "sdf", "pharma", "molecules", "bioinformatics", "drug-discovery"],
        "total_rows": 28400,
        "total_columns": 10,
        "size_bytes": 14500000,
        "quality_score": 99,
        "stars": 349,
        "downloads": 2490,
        "forks": 110,
        "updated_at": "2026-03-20T11:00:00Z",
        "schema_fields": [
            {"name": "chembl_id", "type": "VARCHAR", "description": "ChEMBL compound access code"},
            {"name": "smiles", "type": "VARCHAR", "description": "Simplified molecular-input line-entry specification"},
            {"name": "mw_daltons", "type": "DOUBLE", "description": "Molecular weight in g/mol"},
            {"name": "alogp", "type": "DOUBLE", "description": "Calculated octanol-water partition coefficient"},
            {"name": "hba_count", "type": "BIGINT", "description": "Hydrogen bond acceptors count"},
            {"name": "hbd_count", "type": "BIGINT", "description": "Hydrogen bond donors count"},
            {"name": "psa_angstrom2", "type": "DOUBLE", "description": "Polar surface area in square angstroms"},
            {"name": "target_protein", "type": "VARCHAR", "description": "Primary enzymatic target protein"},
            {"name": "binding_affinity_nm", "type": "DOUBLE", "description": "IC50 / Kd binding concentration in nM"},
        ],
        "sample_rows": [
            {"chembl_id": "CHEMBL25", "smiles": "c1ccccc1NC(=O)C", "mw_daltons": 135.17, "alogp": 1.16, "hba_count": 1, "hbd_count": 1, "psa_angstrom2": 29.10, "target_protein": "COX-2", "binding_affinity_nm": 42.5},
            {"chembl_id": "CHEMBL112", "smiles": "CC(=O)Oc1ccccc1C(=O)O", "mw_daltons": 180.16, "alogp": 1.31, "hba_count": 3, "hbd_count": 1, "psa_angstrom2": 63.60, "target_protein": "COX-1", "binding_affinity_nm": 18.0},
            {"chembl_id": "CHEMBL501", "smiles": "CN1CCN(CC1)C(=O)c2cc3ccccc3[nH]2", "mw_daltons": 243.31, "alogp": 0.85, "hba_count": 3, "hbd_count": 1, "psa_angstrom2": 35.80, "target_protein": "5-HT2A", "binding_affinity_nm": 8.4},
        ],
        "sample_query": "SELECT target_protein, COUNT(*) as compounds_tested, ROUND(AVG(binding_affinity_nm), 2) as mean_affinity_nm\nFROM drug_molecules\nWHERE alogp BETWEEN 0.5 AND 3.5\nGROUP BY target_protein\nORDER BY mean_affinity_nm ASC;",
    },
    "showcase_ecommerce_cohorts": {
        "id": "showcase_ecommerce_cohorts",
        "title": "Direct-to-Consumer Customer Cohort LTV & Attribution Ledger",
        "slug": "dtc-customer-cohort-ltv-attribution",
        "domain": "E-Commerce & Retail",
        "description": "Multi-year transactional cohort dataset tracking CAC payback, first-order basket sizes, repurchase intervals, channel CAC, and lifetime margin.",
        "author": "E-Commerce Growth Consortium",
        "author_avatar": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100",
        "author_verified": False,
        "format": "csv",
        "license": "ODC-ODbL",
        "doi": "10.5281/strata.growth.77102",
        "tags": ["ecommerce", "cohorts", "ltv", "marketing", "retail", "cac"],
        "total_rows": 95000,
        "total_columns": 10,
        "size_bytes": 11200000,
        "quality_score": 94,
        "stars": 285,
        "downloads": 2180,
        "forks": 98,
        "updated_at": "2026-03-12T16:30:00Z",
        "schema_fields": [
            {"name": "user_id", "type": "VARCHAR", "description": "Customer identifier"},
            {"name": "acquisition_cohort", "type": "VARCHAR", "description": "First purchase month (YYYY-MM)"},
            {"name": "channel", "type": "VARCHAR", "description": "Acquisition marketing channel (Paid Search, Organic, TikTok, Email)"},
            {"name": "initial_order_value", "type": "DOUBLE", "description": "First order gross revenue in USD"},
            {"name": "repurchase_count_12m", "type": "BIGINT", "description": "Number of repeat orders within 12 months"},
            {"name": "ltv_12m_usd", "type": "DOUBLE", "description": "Total gross revenue generated in 12 months"},
            {"name": "net_margin_pct", "type": "DOUBLE", "description": "Contribution margin percentage after COGS and shipping"},
        ],
        "sample_rows": [
            {"user_id": "USR-8490", "acquisition_cohort": "2025-01", "channel": "Paid Search", "initial_order_value": 78.50, "repurchase_count_12m": 3, "ltv_12m_usd": 245.00, "net_margin_pct": 0.42},
            {"user_id": "USR-8491", "acquisition_cohort": "2025-01", "channel": "TikTok", "initial_order_value": 34.00, "repurchase_count_12m": 0, "ltv_12m_usd": 34.00, "net_margin_pct": 0.38},
            {"user_id": "USR-8492", "acquisition_cohort": "2025-02", "channel": "Organic", "initial_order_value": 112.00, "repurchase_count_12m": 5, "ltv_12m_usd": 590.00, "net_margin_pct": 0.51},
        ],
        "sample_query": "SELECT acquisition_cohort, channel, AVG(initial_order_value) as avg_aov, AVG(ltv_12m_usd) as avg_12m_ltv\nFROM ecommerce_cohorts\nGROUP BY acquisition_cohort, channel\nORDER BY acquisition_cohort DESC;",
    },
}

# User starred showcase items scoped per user_id
_user_starred_showcase: Dict[str, set] = defaultdict(set)


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

    return {
        "total": len(enriched),
        "domains": ["All", "Geospatial & Climate", "Fintech & Security", "Healthcare & Chemistry", "E-Commerce & Retail"],
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
    new_dataset_id = f"fork_{item['id']}_{int(datetime.now(timezone.utc).timestamp())}"
    target_filename = f"{new_dataset_id}.csv"
    target_path = os.path.join(storage_dir, target_filename)

    # Write sample rows to local CSV file
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

