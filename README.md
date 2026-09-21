# Strata

*Version control for data. The AI-native Data Science Studio & GitHub for datasets.*

> Working name — subject to change. See `PRODUCT.md` for full positioning.

Strata is an all-in-one AI-native workspace and version control system for data. It treats datasets the way Git treats code — immutable versions, rich diffs, lineage tracing, and auditability — while providing a complete interactive studio for the day-to-day work of data science: universal previews, visual exploratory data analysis (EDA), conversational querying, data wrangling recipes, and baseline machine learning.

## Why this exists

Data science and analytics teams struggle with fragmented workflows:
- **Scattered tooling:** Data exploration happens in Excel or Jupyter, versioning in ad-hoc cloud folders (`final_v3_ACTUALLY_final.csv`), quality checks in isolated libraries (Great Expectations), dashboards in BI tools (Tableau), and model tracking in separate MLOps platforms.
- **Lost context & lineage:** Teams routinely lose track of which dataset version produced which model, dashboard, or insight.
- **Friction in exploration:** Previewing and analyzing non-trivial files (multi-sheet Excel, multi-gigabyte Parquets, scientific formats like PubChem `.sdf`, or geospatial GeoJSON) usually requires writing repetitive boilerplate code before seeing a single row.

Strata unifies storage, version control, interactive multi-format exploration, AI-assisted analysis, and baseline modeling into a single cohesive platform built from the notebook and browser outward.

## What it does

### 1. Universal Preview & Multi-Format Inspector
- **Instant preview without code:** Drop in CSV, TSV, multi-sheet Excel (`.xlsx`, `.xls`), Parquet, Feather, Arrow, JSON/JSONL, SQLite, GeoJSON, and scientific/bio formats (PubChem `.sdf`, `.mol`, FASTA).
- **Virtual 1M+ row grid:** Blazing-fast client-side virtualization with instant sorting, column filtering, data type inference, and value distribution summaries.

### 2. Interactive Visual EDA & Chart Canvas
- **No-code chart builder:** Drag-and-drop shelf interface to build scatter plots, histograms, boxplots, heatmaps, and pairplots powered by DuckDB-Wasm and Vega/Plotly.
- **Automated exploratory dossier:** One-click generation of missingness heatmaps, correlation matrices, and distribution shift analyses.

### 3. In-App Conversational Data Analyst & Code Interpreter
- **Natural language to verified analysis:** Ask questions in plain English (*"Show average churn rate grouped by tenure and region"*).
- **Grounded execution:** The AI writes and runs DuckDB SQL or Python code against actual data, computes statistical tests (t-tests, ANOVA, chi-square), and returns verified charts with clear explanations.

### 4. Visual Data Wrangling & Transform Recipes
- Point-and-click data cleaning (imputation, deduplication, regex extraction, outlier trimming, one-hot encoding).
- Every visual transform step is recorded as an immutable recipe that emits clean, exportable Python (Polars/Pandas) or SQL code.

### 5. AutoML Sandbox & Model Explainability
- Run 60-second baseline predictive models (LightGBM, XGBoost, Random Forest, Ridge/Logistic).
- Diagnostic dashboard: Feature importance, SHAP summary waterfall plots, confusion matrices, ROC-AUC curves, and train/test leakage warnings.

### 6. Git-Style Version Control, Diffing & Lineage
- **Immutable versioning:** Content-addressed snapshots on every meaningful change with full commit history.
- **Rich data diffing:** Compare any two versions across schema, row count, nullability delta, distribution shifts, and cell-level primary-key diffs.
- **End-to-end lineage:** Visual DAG tracking data provenance from raw files through transforms to trained models and dashboards.

### 7. Interactive Dashboards & Executive Storytelling
- Pin queries, charts, and AI summaries into interactive dashboards with parameter controls.
- Export as shareable web links, interactive HTML, or presentation-ready PDF reports.

### 8. Python SDK & CLI (`strata`)
- Full programmatic control directly from Jupyter, Colab, or pipelines: `import strata as st; dataset = st.Dataset("churn").load()`.

---

## Documentation map

| Doc | Covers |
|---|---|
| `BLUEPRINT.md` | Full long-term feature vision — 25 pillars spanning ingestion, previewing, EDA, AI analysis, AutoML, dashboards, versioning, and governance. |
| `PRODUCT.md` | Vision, target personas, positioning vs. DVC/lakeFS/Hex/Deepnote/Tableau, pricing direction, and success metrics. |
| `ARCHITECTURE.md` | System design, hybrid DuckDB-Wasm + FastAPI + Postgres stack, execution sandboxes, data flow, and phased scaling. |
| `TODO.md` | Phased build plan — a lean checklist referencing `BLUEPRINT.md` items, tracking build order and validation milestones. |
| `SECURITY.md` | Auth model, encryption, sandboxed execution, PII handling, and privacy boundaries for AI models. |
| `DOCUMENTATION.md` | User-facing documentation skeleton (SDK reference, CLI, Universal Previewer, EDA studio, AutoML, concepts). |

---

## Stack (V1)

- **Frontend:** Next.js / React, TailwindCSS/Vanilla CSS, Virtualized Data Grid, Vega-Lite / Plotly
- **In-Browser Compute:** DuckDB-Wasm & Apache Arrow (sub-second queries on datasets up to 150MB+ with zero server overhead)
- **API Backend:** FastAPI (Python) with DuckDB & Polars integration
- **Database:** PostgreSQL (metadata, version graph, lineage edges)
- **Object Storage:** S3-compatible (MinIO / Cloudflare R2 / AWS S3)
- **Async Workers & Sandboxes:** Celery + Redis for async profiling jobs; isolated Python runner for AutoML and Code Interpreter execution

---

## Status

Pre-build. Currently in **Phase 0 (Proof of Concept)** — validating the universal previewer, interactive virtual grid, and AI conversational data analysis engine. See `TODO.md` for the live checklist.

## License

Apache 2.0 (see `LICENSE`).

landing page concept

https://claude.ai/artifact/1qq8bif6bybY8nK1t3xh8i