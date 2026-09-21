# Product

## Vision

A unified, AI-native platform where datasets are treated the way Git treats code — versioned, diffable, auditable, collaborative, and reproducible — while providing the complete suite of interactive data science and analytics tools: universal multi-format previews, visual EDA, conversational analysis, wrangling recipes, and baseline machine learning.

**Positioning: "The AI-Native Data Science Studio & GitHub for Datasets."**
Not just a storage repository or passive archive, but an active, intelligent workspace where data scientists, analysts, and researchers conduct end-to-end exploratory data analysis and modeling on top of an immutable version-controlled backbone.

---

## Who this is for

| Persona | Pain today | Why Strata |
|---|---|---|
| **Solo Data Scientist / ML Engineer** | `final_v3_ACTUALLY_final.csv`, fragmented scripts for EDA, no memory of what changed between model iterations | Instant multi-format preview, automated EDA, baseline AutoML, and automatic versioning + diffing in one place. |
| **Data & Business Analyst** | Forced to use Excel for quick views and Tableau for charts; complex SQL queries require constant context switching | Universal previewer for Excel/CSV/Parquet, no-code chart builder, conversational AI analyst that generates verified SQL and charts. |
| **Small ML Team (no dedicated MLOps)** | DVC + Great Expectations + Jupyter + W&B + a wiki duct-taped together | A single unified canvas: version control, lineage, automated quality checks, and shared collaborative dashboards. |
| **Scientific & Domain Researcher (Bio, Chem, Geo)** | Incompatible, messy formats (PubChem `.sdf`, GeoJSON, Excel workbooks) requiring bespoke scripts just to inspect rows | Native multi-format parser, spatial/chemical visualization preview, reproducible pipelines, and one-click citation generation. |
| **Bootcamp Grad / Portfolio Builder** | Needs clean, shareable, interactive, reproducible datasets and project dashboards for interviews | Public interactive dataset pages, live interactive previews, and citation-ready lineage graphs. |

---

## Competitive landscape

| Tool | Strength | Gap Strata targets |
|---|---|---|
| **DVC / lakeFS** | Robust low-level Git-native versioning | Infrastructure-only; no interactive visual exploration, no universal previewer, no AI data analyst, steep CLI learning curve. |
| **Hex / Deepnote** | Excellent collaborative SQL/Python notebooks | Notebook-centric rather than dataset-centric; lacks native dataset-level Git versioning, automated quality profiling, and automated diffing. |
| **Tableau / PowerBI** | Mature enterprise BI dashboards | Heavy, siloed from Python/notebook workflows, lacks version control, high cost, poor handling of raw/messy working datasets. |
| **Hugging Face Datasets** | World-class ML dataset sharing & distribution | Geared toward public distribution, not private messy working datasets, in-depth EDA, or iterative data cleaning. |
| **Weights & Biases Artifacts** | Great experiment↔artifact linking | Versioning is an auxiliary feature of an experiment tracker; no interactive data studio, no no-code wrangling, no conversational analyst. |
| **Great Expectations** | Deep programmatic assertion rules | Requires users to know in advance what to check; no AI-native profiling or visual discovery of unexpected anomalies. |

**The Strata Advantage:**
Strata bridges the gap between **version control (Git/DVC)** and **interactive data science workspaces (Hex/Tableau/Code Interpreter)**. Users don't need to choose between rigorous versioning and fluid exploratory analysis — Strata provides both in a unified interface.

---

## Core value proposition

> *"Explore, analyze, clean, model, and version your data — all in one AI-native workspace, without losing track of a single change or leaving your flow."*

---

## Success metrics (once live)

- **Activation:** % of signups who upload/preview a dataset and run an interactive analysis or query within their first 5 minutes.
- **Workflow Depth:** % of sessions utilizing the visual chart canvas, data wrangling recipes, or conversational AI analyst.
- **Retention Loop:** % of users who create a second version or export a transformation recipe for an uploaded dataset.
- **AI Analyst Trust:** % of AI-generated queries, insights, and suggested fixes accepted or executed by users.
- **SDK / Notebook Adoption:** % of active datasets accessed programmatically via Python SDK (`strata`) alongside web UI usage.

---

## Pricing direction

- **Free / Community:** Capped storage, full universal previewer, interactive virtual grid, in-browser DuckDB-Wasm queries, community dataset sharing.
- **Pro:** Expanded cloud storage, server-side compute for large datasets, advanced AutoML sandboxes, and complete AI Data Analyst capabilities.
- **Team:** Shared workspaces, role-based access control, collaborative live dashboards, version approvals, and team lineage tracking.
- **Usage-based Compute:** Pay-as-you-go GPU/compute resources for heavy machine learning and massive dataset transformations.

---

## What Strata is explicitly not

- **Not a production transactional database (OLTP):** Strata analyzes, transforms, and versions analytical datasets; it does not replace Postgres or MySQL for application backends.
- **Not a rigid, slow enterprise data catalog:** Strata is built for builders, data scientists, and analysts who want instant speed and fluid interaction, not bureaucratic compliance-first software.