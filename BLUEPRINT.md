# Strata — Full Product Blueprint
*(Working name — "The AI-Native Data Science Studio & GitHub for Datasets")*

> This is a living scope document, not a build order. It tracks the complete functional spectrum of Strata across 25 core pillars. It exists so that throughout the engineering roadmap, you can reference the full architecture and feature relationships rather than reinventing specs mid-build. Treat this document as append-only — new feature ideas are categorized into their respective pillars before implementation.

---

## 1. Vision

A unified platform where datasets are treated the way Git treats code: versioned, diffable, auditable, collaborative, and reproducible — combined with a state-of-the-art interactive studio for the day-to-day work of data science: universal previews, visual exploratory data analysis (EDA), conversational querying, data wrangling recipes, and baseline machine learning.

**Positioning: "The AI-Native Data Science Studio & GitHub for Datasets."**
Version control and diffing form the immutable spine; the AI-native profiling and conversational analysis layer provides the wedge; the universal preview, interactive EDA, AutoML, and dashboard canvas make it the daily workspace for data teams.

---

## 2. Who this is for

- **Solo Data Scientists & ML Engineers:** Eliminating `final_v3_ACTUALLY_final.csv`, organizing messy exploratory scripts, and tying model weights directly to dataset versions.
- **Data & Business Analysts:** Instant zero-code exploration of CSV, Excel, and Parquet files, drag-and-drop chart creation, and natural language querying with verified SQL.
- **Small to Mid-Sized ML Teams:** Replacing fragmented stacks (DVC + Great Expectations + W&B + Hex + wikis) with one cohesive, collaborative workspace.
- **Researchers & Domain Scientists (Bio, Chem, Geo):** Native parsing and visualization for specialized scientific files (PubChem `.sdf`, GeoJSON, Excel workbooks), reproducible pipelines, and citation generators.
- **Portfolio Builders & Students:** Creating interactive, shareable dataset portfolios with live previews, automated EDA, and lineage stories.

---

## 3. Product Pillars

1. Ingestion & Storage
2. Versioning
3. Diffing & Comparison
4. Data Profiling & Quality
5. AI Layer (The Core Differentiator)
6. Lineage & Reproducibility
7. Pipelines & Transformations
8. Python SDK / CLI (`strata`)
9. Collaboration & Access Control
10. Search & Discovery
11. Sharing & Public Datasets
12. Integrations
13. Notebooks / Compute Environment
14. Notifications & Activity
15. Billing & Plans
16. Security & Compliance
17. Admin, Observability & Platform Ops
18. Onboarding & Docs
19. Marketplace (Long-Term)
20. Enterprise & Governance (Long-Term)
21. **Universal Preview & Multi-Format Inspector** *(New)*
22. **Interactive Visual EDA & Drag-and-Drop Chart Studio** *(New)*
23. **In-App Code Interpreter & Conversational Data Analyst** *(New)*
24. **AutoML, Feature Engineering & Predictive Diagnostics** *(New)*
25. **Interactive Dashboards & Executive Storytelling** *(New)*
26. **Post-Remediation Enhancements — Strengthening the Existing Suite** *(New — do after `fix.md` is complete)*
27. **Extended Capabilities — Deliberately Out of Current Scope** *(New — long-term, evaluate later)*

---

## 4. Full Feature Master List

### Pillar 1 — Ingestion & Storage
1.1 Upload via web (drag-drop, multi-file batch, directory upload)  
1.2 Upload via CLI (`strata upload`)  
1.3 Upload via SDK (`Dataset.upload()`)  
1.4 Upload via URL (HTTP/HTTPS, S3 URL, Google Drive link)  
1.5 Cloud storage connectors (S3 bucket, GCS, Azure Blob, Supabase Storage)  
1.6 Streaming upload for multi-gigabyte files (chunked, resumable)  
1.7 Native format support: CSV, TSV, Parquet, Feather, Arrow, Excel (`.xlsx`, `.xls` multi-sheet), JSON/JSONL, SQLite, Avro, ORC  
1.8 Scientific & specialized format ingestion: PubChem (`.sdf`, `.mol`), FASTA/FASTQ, PDB, GeoJSON, Shapefile, GeoParquet  
1.9 Auto-detection of file encoding, delimiters, headers, and compression (gzip, bzip2, zip, tar)  
1.10 Database connector snapshots (Postgres, MySQL, Snowflake, BigQuery, ClickHouse, DuckDB)  
1.11 API and webhook push ingestion on recurring cadences  
1.12 Content-based deduplication check on upload (warn or reuse existing blob)  
1.13 Storage tiering (hot storage for active versions, cold/glacier archive for historical)  
1.14 Configurable storage backend (S3, Cloudflare R2, MinIO, Google Cloud Storage)  
1.15 Per-dataset and per-workspace storage quota tracking  
1.16 Multi-format co-storage (store raw file while maintaining optimized Parquet/Arrow views)  
1.17 Partitioned dataset support (Hive-style partitioned datasets by date or region)  
1.18 Automated retention & cleanup policies for stale versions  

### Pillar 2 — Versioning
2.1 Content-addressed immutable versions (cryptographic hash over data)  
2.2 Explicit commit messaging (`strata.commit(message="Cleaned outliers")`)  
2.3 Auto-versioning on transform/wrangling execution  
2.4 Version tags and release aliases (`prod`, `staging`, `v1.2.0`, `experiment-7`)  
2.5 Branching — fork a dataset to experiment with transformations without altering main  
2.6 Merge branches with schema and row-conflict detection  
2.7 Visual commit graph timeline (interactive DAG of dataset versions)  
2.8 One-click rollback and checkout to any prior version  
2.9 Comprehensive version metadata: rows, columns, byte size, schema hash, author, timestamp, parent pointer  
2.10 Semantic versioning alongside cryptographic hash pointers  
2.11 Pin protected versions to guard against garbage collection  
2.12 Arbitrary version comparison (diff any two versions across the DAG)  
2.13 Column and row blame view — identify which commit introduced a specific column or data pattern  
2.14 Version-level access control (e.g. private draft versions, public production releases)  
2.15 Automatic version trigger on detected schema migrations  
2.16 Automated garbage collection for unpinned, orphaned versions  
2.17 Custom key-value version metadata (e.g., training accuracy score, source pipeline ID)  

### Pillar 3 — Diffing & Comparison
3.1 Row-count delta (added, removed, net change)  
3.2 Column-count delta (added, dropped, renamed)  
3.3 Schema diff (type mutations, nullability shifts, precision changes)  
3.4 Cell-level value diff on primary-key matched rows (color-coded side-by-side inspection)  
3.5 Statistical distribution diff (mean, median, variance, IQR shift per column)  
3.6 Missing-value delta (% nulls before vs. after)  
3.7 Duplicate-row delta  
3.8 Visual git-style diff UI with side-by-side and unified views  
3.9 Exportable diff report (Markdown, PDF, JSON)  
3.10 Diff between an active dataset and an external uploaded file  
3.11 Automated diff alerts (e.g. alert if row count drops > 10% or key metrics drift)  
3.12 Smart column-rename detection (distinguish renames from drops + additions)  
3.13 Categorical domain shifts (new or missing categorical values)  
3.14 Embedding & vector distribution drift for unstructured data  

### Pillar 4 — Data Profiling & Quality
4.1 Instant automated profiling on ingest (rows, columns, data types, memory consumption)  
4.2 Numeric statistics: min, max, mean, median, standard deviation, quartiles, skewness  
4.3 Categorical statistics: unique count, top frequencies, cardinality ratio, value distributions  
4.4 Missing value patterns (matrix visualizations, co-occurrence of missingness)  
4.5 Duplicate detection (exact duplicate rows and fuzzy matching)  
4.6 Outlier detection (IQR, Z-score, Isolation Forests)  
4.7 Correlation matrix & collinearity warnings (Pearson, Spearman, Cramér's V)  
4.8 Type mismatch and casting alerts (e.g., numeric values stored in text columns)  
4.9 Automated PII detection (emails, phones, SSNs, credit cards, physical addresses)  
4.10 Low-information column detection (constant, near-constant, zero-variance columns)  
4.11 High-cardinality flags (accidental ID columns passed as categorical features)  
4.12 Impossible-value validation (negative ages, future timestamps, invalid coordinates)  
4.13 Class imbalance detection for target prediction columns  
4.14 Dataset drift & population stability index (PSI) between consecutive versions  
4.15 Composite, explainable data quality score (0–100 with actionable sub-scores)  
4.16 User-defined custom assertions (e.g., `expect_column_values_to_be_between(0, 100)`)  
4.17 Scheduled automated quality re-checks for upstream data feeds  
4.18 Exportable interactive profiling report (self-contained HTML / PDF)  

### Pillar 5 — AI Layer (The Core Differentiator)
5.1 Plain-English automated dataset narrative summary (*"This dataset tracks 45,000 customer subscriptions..."*)  
5.2 Plain-English anomaly and quality issue explanations (*"Why this matters and how to address it"*)  
5.3 One-click suggested cleaning recipes (imputation, deduplication, normalization)  
5.4 Semantic feature engineering suggestions based on column contexts  
5.5 Deep semantic type inference (currency, ISO country code, geolocation, timestamp with timezone)  
5.6 Natural-language dataset querying (*"Show all orders above $500 placed on weekends in Texas"*)  
5.7 Conversational data assistant grounded in actual data with zero-hallucination verification  
5.8 Automated data dictionary generation from column headers and representative samples  
5.9 Root-cause anomaly explanations (*"Churn spiked in March due to a 40% failure rate in EU payment gateways"*)  
5.10 Smart join-key suggestions across disparate datasets  
5.11 Recommended train/validation/test split strategies based on target column distribution  
5.12 Target leakage & data snooping detection  
5.13 AI-assisted schema mapping for drifted re-ingestions  
5.14 Confidence scoring and rationale breakdown for every AI recommendation  
5.15 Full audit trail: log all prompts, executed code, and reasoning steps behind every AI action  

### Pillar 6 — Lineage & Reproducibility
6.1 Parent/child dependency tracking across all transformations  
6.2 Interactive lineage DAG visualization (Raw Files → Cleaned Sets → Features → Trained Models → Reports)  
6.3 Backward lineage tracing: inspect any metric or model back to its original raw source  
6.4 Forward impact analysis: preview downstream consequences before modifying or deleting a dataset  
6.5 Experiment & model registration: link dataset version hashes directly to model checkpoints and MLflow/W&B runs  
6.6 Complete execution environment capture (library versions, code commit, hardware profile)  
6.7 One-click reproduction: rerun a full transformation graph from original raw inputs  
6.8 Lineage export in standard formats (OpenLineage, JSON DAG, GraphViz)  
6.9 Lineage-aware deletion protection (block deletion if active downstream assets depend on the version)  

### Pillar 7 — Pipelines & Transformations
7.1 Drag-and-drop visual pipeline builder  
7.2 Code-first pipeline definition (Python decorators / Polars expressions)  
7.3 Built-in transformation library: filtering, joining, aggregations, one-hot encoding, quantile clipping  
7.4 Scheduled pipeline triggers (cron schedules, webhook triggers, event-driven on new upload)  
7.5 Versioned pipelines (pipeline definitions are versioned alongside dataset outputs)  
7.6 Pipeline execution history, step-by-step logs, and intermediate artifact inspection  
7.7 Conditional branching logic in transformation graphs  
7.8 Reusable pipeline templates for common ETL and feature engineering tasks  
7.9 Automated retry logic, failure alerting, and dead-letter queues  
7.10 Dry-run execution mode with sample output previews before committing changes  

### Pillar 8 — Python SDK / CLI (`strata`)
8.1 `pip install strata`  
8.2 Dataset upload: `strata.Dataset("churn").upload("./data.parquet")`  
8.3 Dataset loading: `df = strata.Dataset("churn").load(version="prod")` (returns Pandas or Polars DataFrame)  
8.4 Version committing: `dataset.commit(message="Applied imputation", tags=["cleaned"])`  
8.5 Programmatic diffing: `diff = strata.diff("churn", v1="v1.0", v2="v1.1")`  
8.6 Programmatic profiling: `profile = dataset.profile()`  
8.7 Full-featured CLI: `strata upload`, `strata diff`, `strata profile`, `strata checkout`  
8.8 Jupyter & Colab magic commands (`%strata_load dataset_name`)  
8.9 First-class Apache Arrow & Polars integration  
8.10 Asynchronous Python client for microservices and data pipelines  
8.11 Local caching engine to prevent redundant downloads of immutable versions  
8.12 Real-time dataset subscription: `strata.watch("orders", callback=on_new_version)`  
8.13 Global and project-level config files (`.strataconfig`)  
8.14 Quality guardrails: trigger warnings on `.load()` if quality score is below threshold  

### Pillar 9 — Collaboration & Access Control
9.1 Workspaces and organizations  
9.2 Granular role-based access: Owner, Admin, Editor, Analyst, Viewer  
9.3 Per-dataset and per-branch permission overrides  
9.4 Workspace invitations via email, magic link, or SSO domain matching  
9.5 Real-time activity feeds per workspace and dataset  
9.6 Discussion threads attached to specific datasets, versions, or columns  
9.7 Cell-level and row-level review comments (similar to pull request line comments)  
9.8 Mentions (@user), notifications, and team assignees  
9.9 Release approval workflows (require approval before tagging a version as `production`)  
9.10 Workspace asset transfer and ownership reassignments  

### Pillar 10 — Search & Discovery
10.1 Global full-text search across dataset titles, descriptions, and metadata  
10.2 Schema-based search (e.g. *"find all datasets containing a `customer_id` or `tax_id` column"*)  
10.3 Tag, domain, and category filtering  
10.4 Semantic natural language search powered by vector embeddings  
10.5 Faceted filters: quality score, row count, update frequency, file type, owner  
10.6 Favorites, bookmarks, and recently visited datasets  
10.7 Automated recommendations: *"Teams that used this dataset also explored..."*  

### Pillar 11 — Sharing & Public Datasets
11.1 Secure shareable read-only links with expiration dates and password protection  
11.2 Public dataset showcase pages (Kaggle/HuggingFace style with live preview, documentation, and download)  
11.3 Embeddable preview widgets for external blogs, documentation, and websites  
11.4 Automatic academic citation generation (BibTeX, APA, IEEE, DOI integration)  
11.5 Standardized license selector (MIT, Apache 2.0, CC-BY, Open Data Commons)  
11.6 Public download statistics, star counts, and clone analytics  
11.7 One-click public dataset forking into personal or team workspaces  

### Pillar 12 — Integrations
12.1 JupyterLab and VS Code extensions  
12.2 Google Colab integration  
12.3 Slack, Discord, and Microsoft Teams alert webhooks  
12.4 GitHub Actions / GitLab CI/CD actions for automated dataset regression tests  
12.5 Airflow, Dagster, and Prefect operators  
12.6 MLflow & Weights & Biases experiment tracking integration  
12.7 dbt integration (track dbt model outputs as versioned Strata datasets)  
12.8 BI connectors (Tableau, PowerBI, Looker, Metabase)  
12.9 Zapier, Make, and webhook automation triggers  

### Pillar 13 — Notebooks / Compute Environment
13.1 Zero-setup in-browser interactive notebook tied directly to any dataset version  
13.2 Auto-generated exploratory analysis notebook templates  
13.3 Ephemeral cloud compute sandbox for executing heavy transformations  
13.4 GPU-accelerated compute runners for deep learning and embedding generation  

### Pillar 14 — Notifications & Activity
14.1 Weekly and monthly email digests of team dataset activity and quality metrics  
14.2 In-app notification center with read/unread statuses and action items  
14.3 Custom alert triggers (quality regressions, schema alterations, pipeline completion)  
14.4 Webhook endpoints for custom external notification systems  

### Pillar 15 — Billing & Plans
15.1 Free / Community tier (storage and dataset count limits, full preview features)  
15.2 Pro tier for individual practitioners (expanded storage, full AI analyst capabilities)  
15.3 Team tier (workspaces, collaboration roles, unified billing, audit logs)  
15.4 Transparent usage-based compute billing for heavy pipelines and AutoML  
15.5 Detailed usage analytics dashboard and automated invoicing  
15.6 Referral credits and educational/academic discounts  

### Pillar 16 — Security & Compliance
16.1 AES-256 encryption at rest and TLS 1.3 in transit  
16.2 Enterprise SSO (Google, GitHub, SAML 2.0, Okta, Azure AD)  
16.3 Immutable audit log recording all reads, downloads, queries, and permission adjustments  
16.4 Column-level PII masking and redaction on export for restricted roles  
16.5 GDPR & CCPA right-to-be-forgotten deletion workflows cascading through version lineage  
16.6 Workspace IP allowlisting  
16.7 SOC 2 Type II compliance readiness  

### Pillar 17 — Admin, Observability & Platform Ops
17.1 Centralized administrator console for user, storage, and resource monitoring  
17.2 Real-time platform health and status dashboard  
17.3 Per-tier API rate limiting and token bucket throttling  
17.4 Background worker queue observability (latency, failure rate, queue depth)  
17.5 Fine-grained cost attribution per dataset and per workspace  

### Pillar 18 — Onboarding & Docs
18.1 Interactive first-dataset onboarding flow with sample data  
18.2 Pre-loaded domain datasets (finance, health, e-commerce, scientific) for instant sandbox exploration  
18.3 Interactive API & SDK documentation with copy-paste code snippets  
18.4 High-quality video guides and written tutorials  
18.5 In-app contextual tooltips explaining statistical and machine learning metrics  
18.6 Public release notes and changelog  

### Pillar 19 — Marketplace (Long-Term)
19.1 Public dataset marketplace for curated, high-quality data feeds  
19.2 Monetized premium datasets (revenue sharing for creators)  
19.3 Community data bounty board (*"Request a dataset with specific criteria"*)  
19.4 Verified dataset badges and author reputation scores  

### Pillar 20 — Enterprise & Governance (Long-Term)
20.1 Enterprise data catalog synchronization (Collibra, Alation)  
20.2 Automated column-level regulatory tagging (HIPAA, GDPR, CCPA, FINRA)  
20.3 Multi-region data sovereignty policies  
20.4 On-premise and Virtual Private Cloud (VPC) deployment options  

---

### Pillar 21 — Universal Preview & Multi-Format Inspector *(New)*
21.1 **Universal Instant Preview:** Drag-and-drop preview for CSV, TSV, Parquet, Feather, Arrow, Excel (`.xlsx`, `.xls`), JSON/JSONL, SQLite, and text-delimited files with zero setup.  
21.2 **Multi-Sheet Workbook Viewer:** Seamless tabbed navigation across all sheets in Excel workbooks with per-sheet type inference and row counts.  
21.3 **Scientific & Molecular File Inspector:** Native rendering and 2D/3D structure preview for PubChem (`.sdf`, `.mol`) chemical compounds, PDB macromolecules, and FASTA sequence files.  
21.4 **Geospatial Map Previewer:** Interactive Leaflet/Mapbox vector tile viewer for GeoJSON, Shapefiles, and GeoParquet with polygon, point, and chloropleth layers.  
21.5 **Virtualized Infinite-Scroll Grid:** 60 FPS viewport rendering capable of navigating 1,000,000+ rows with minimal memory consumption.  
21.6 **Instant In-Column Filters & Sorters:** Fast client-side and DuckDB-accelerated sorting, numeric range sliders, and text search across columns.  
21.7 **Hover Column Micro-Stats:** Instant histogram sparkline, null count %, cardinality, and data type inspector on column header hover.  
21.8 **Multi-Format Format Converter:** One-click instant conversion and export between formats (e.g. convert 200MB messy Excel sheet into clean compressed Parquet or CSV).  

### Pillar 22 — Interactive Visual EDA & Drag-and-Drop Chart Studio *(New)*
22.1 **Visual Shelf Chart Designer:** Drag columns to X, Y, Color, Size, and Facet shelves (Tableau/Observable Plot style) to generate dynamic visualizations.  
22.2 **Comprehensive Chart Library:** Scatter plots, line graphs, bar charts, histograms, boxplots, violin plots, heatmaps, density contours, and treemaps.  
22.3 **One-Click EDA Dossier:** Auto-generate complete exploratory reports containing univariate distributions, bivariate relationships, and interaction summaries.  
22.4 **Missing Value Matrix:** Visual heatmap showing missingness co-occurrence and null cluster patterns across rows and columns.  
22.5 **Interactive Correlation Heatmap:** Color-coded correlation matrix with one-click filtering to highlight significant collinearities.  
22.6 **Pairplot Matrix Generator:** Multi-dimensional scatter plot matrix comparing numerical feature pairs with marginal distributions.  
22.7 **Exportable Visualizations:** High-resolution PNG, scalable SVG, interactive HTML embed, or copy-paste Matplotlib/Seaborn/Plotly Python code.  

### Pillar 23 — In-App Code Interpreter & Conversational Data Analyst *(New)*
23.1 **Conversational Data Queries:** Ask questions in plain English (*"What were the top 5 product categories by revenue in Q2?"*).  
23.2 **Dual Execution Engine:** Automatic translation of natural language into high-performance DuckDB SQL or Python (Pandas/Polars) code.  
23.3 **Verified Code Execution:** AI runs the generated code inside a sandboxed environment, inspects runtime results, self-corrects errors, and renders verified answers.  
23.4 **Automated Statistical Hypothesis Testing:** Run on-demand Student's t-tests, Mann-Whitney U, ANOVA, Chi-Square, and regression tests with plain-English significance interpretation.  
23.5 **Root-Cause Anomaly Detective:** Ask the assistant to investigate sudden drops, distribution anomalies, or spikes with automated subgroup decomposition.  
23.6 **Code Transparency & Auditing:** Every conversation message reveals the exact executable code and execution output, ensuring complete reproducibility.  

### Pillar 24 — AutoML, Feature Engineering & Predictive Diagnostics *(New)*
24.1 **One-Click Baseline AutoML:** Train quick baseline predictive models (LightGBM, XGBoost, Random Forest, Logistic/Ridge) in under 60 seconds.  
24.2 **Target & Task Auto-Detection:** Automatically detect classification vs. regression tasks based on target column distribution and cardinality.  
24.3 **Automated Feature Engineering Engine:** Automatic creation of date/time cyclical encodings, text length features, interaction terms, and frequency encodings.  
24.4 **Model Performance Diagnostics:** Interactive confusion matrices, ROC-AUC curves, precision-recall curves, and residual plots.  
24.5 **SHAP Feature Explainability:** Global feature importance rankings and local waterfall/force plots explaining individual model predictions.  
24.6 **Data Leakage Sentinel:** Automated detection of target leakage, high feature-to-target correlations, and train/test temporal overlap.  
24.7 **Model Artifact & Metric Versioning:** Save trained model weights, evaluation metrics, and hyperparameter logs directly linked to the exact dataset version.  

### Pillar 25 — Interactive Dashboards & Executive Storytelling *(New)*
25.1 **Flexible Dashboard Canvas:** Pin charts, KPI scorecards, data tables, and markdown narratives into responsive grid layouts.  
25.2 **Interactive Global Filters:** Dropdown selectors, date-range pickers, and numeric sliders that dynamically filter all linked dashboard widgets.  
25.3 **Automated Executive Summaries:** One-click AI generation of executive slide summaries highlighting key trends, risks, and findings.  
25.4 **Live Shareable Links:** Publish dashboards with fine-grained access control (public link, password-protected, or workspace-restricted).  
25.5 **Scheduled Snapshot Reports:** Automatically snapshot dashboards on a recurring basis and deliver PDF/email summaries to stakeholders.  

---

### Pillar 26 — Post-Remediation Enhancements *(New)*
*Sequencing note: every item in this pillar assumes `fix.md` is already fully done — real auth, real persistence, real LLM integration (Pillar 23 wired to Groq/Mistral/OpenRouter), real AutoML. These features are natural extensions of that work, not replacements for it. Do not start on this pillar until `fix.md`'s "Definition of done" checklist passes.*

**26.1 Dataset Quality Score Trend (time-series quality tracking)**
Today the quality/PII score (Pillar 4) is computed per-version, in isolation — you see "this version scored 87/100" but nothing about whether that's improving or degrading.
- **How it works:** every time a new version is committed, the existing profiling job (Pillar 4.2–4.9) already computes a quality score. Instead of discarding the previous version's score, store `(dataset_id, version_id, quality_score, computed_at, subscore_breakdown_json)` as its own row, keyed to the version DAG parent pointer already in `dataset_versions`.
- **Surface it as:** a line chart on the dataset detail page plotting quality score against commit history (x-axis = commits in DAG order, not wall-clock time, since branches complicate a pure timeline), with the subscore breakdown (completeness, PII exposure, duplication, schema stability) as stacked/selectable series.
- **Why it matters:** this is the difference between "here's a snapshot" and "here's whether this pipeline is healthy" — it turns Strata from a passive scorer into something a data team would actually check before trusting a dataset for a model run. It's also a natural trigger for Pillar 14 (Notifications) — alert when quality drops more than N points between commits.
- **Dependencies:** needs Pillar 2's version DAG (already exists) and B1's real Postgres persistence from `fix.md` (the quality scores need to survive restarts and be queryable historically, which in-memory dicts can't do).

**26.2 AI-Generated Diff Narratives**
Right now the diff engine (Pillar 3) produces structured output — schema changes, row deltas, distribution shifts — but a human still has to read the raw diff to understand what happened.
- **How it works:** once the real LLM provider layer from `fix.md` Phase C exists, add a new call path: on every commit (or on-demand from the diff UI), feed the *structured diff JSON* (never raw row data — same zero-PII boundary as the conversational analyst) to the LLM with a prompt like "Given this dataset diff (schema changes, row/column deltas, distribution shifts), write a 1–3 sentence plain-English changelog entry a teammate could read without opening the tool."
- **Where it's used:** auto-populate the commit message field as a *suggested* message (user can edit/accept, never silently auto-committed) when no message was provided via CLI/SDK; show it as a "What changed" summary line above the visual diff in the web UI.
- **Why it matters:** most dataset version histories end up with commit messages like "update" or blank — this is the single highest-leverage, lowest-effort feature once the LLM layer exists, because it reuses data you're already computing (the diff) and a provider you're already paying for.
- **Cost note:** tie this into the same daily-cap mechanism from `fix.md` C3 — diff narratives should count against the same quota as conversational-analyst calls, since both hit the same providers.

**26.3 Dataset-to-Model Reproducibility & Drift Check**
Strata already links models to the dataset version they were trained on (Pillar 6.6, Pillar 24.7) but nothing closes the loop by checking whether a model still performs the same way against a *newer* version of its training dataset.
- **How it works:** add a "Check against current version" action on any registered model (Pillar 6.6). This re-runs the exact same AutoML pipeline configuration (feature list, preprocessing steps, model family/hyperparameters — all already stored per Pillar 24.7) against the dataset's current HEAD version instead of the version it was originally trained on, using the same Celery worker infra from `fix.md` B3.
- **What it reports:** side-by-side metric comparison (original accuracy/F1/RMSE vs. re-run), plus a distribution-shift summary reusing the diff engine's statistical diff (Pillar 3.5) between the two dataset versions, so a metric drop can be visually attributed to a specific column's drift.
- **Why it matters:** this is the thing DVC/MLflow don't do well — they track *that* a model used a dataset version, not *whether the relationship still holds*. It's a genuinely differentiated feature versus every competitor named in `PRODUCT.md`'s competitive landscape table, and it's cheap to build because it composes three things you'll already have (lineage links, AutoML pipeline, diff engine) rather than requiring new infrastructure.
- **Dependencies:** Pillar 6 (lineage) + Pillar 24 (AutoML) + `fix.md` B3 (real async workers, since re-training can't block a request thread).

**26.4 CI-Ready Diff Gating in the CLI/SDK**
The CLI already supports `strata diff` (Pillar 8, Phase 1). Extend it into something a CI pipeline can act on, not just a human reading terminal output.
- **How it works:** add `strata diff <version_a> <version_b> --fail-on schema-change,null-spike:5%,row-drop:10%` — a comma-separated list of rule types with thresholds. The command runs the existing diff engine, evaluates the structured result against the rule list, and exits non-zero (with a machine-readable JSON summary printed to stdout when `--json` is passed) if any rule is violated.
- **Where it's used:** a GitHub Action / GitLab CI step in the *consumer's* pipeline (not Strata's own CI) — e.g., "before merging this PR that updates the upstream data source, run `strata diff main..upstream-refresh --fail-on schema-change` and block the merge if it fails."
- **Why it matters:** this is what turns the SDK/CLI (Pillar 8) from "a way to pull data into notebooks" into "a real CI citizen," which is exactly the gap `PRODUCT.md` calls out in DVC (steep CLI learning curve, infrastructure-only) — you'd be offering DVC's CI-friendliness with Strata's richer diff semantics.
- **Dependencies:** none beyond the existing diff engine — this is almost pure CLI/SDK work (Pillar 8) and can be built any time after Phase 1's diffing is real, though it makes most sense after `fix.md` since it should exercise the *real* diff engine, not a version still backed by in-memory state.

---

### Pillar 27 — Extended Capabilities, Deliberately Out of Current Scope *(New)*
*These are bigger, higher-risk, or lower-priority than Pillar 26 — each has a real reason it's not queued yet. Documented here so the scope isn't lost, per this file's own "living scope document" rule, not because any of them should be started soon.*

**27.1 Live External Database Querying (DuckDB scanner extensions)**
DuckDB has first-class scanner extensions (`postgres_scanner`, `mysql_scanner`, `sqlite_scanner`) that let a query reach into a *live* external database as if it were a local table — no ETL/export step required.
- **How it would work:** a user adds a read-only connection (host, port, credentials stored encrypted — reuse the encryption-at-rest work from `fix.md`/Pillar 16.1) to their own Postgres/MySQL instance. Strata's DuckDB engine attaches it via the relevant scanner extension, and the user can query it, diff it against a Strata-versioned snapshot, or pull a point-in-time export into a new Strata version — all through the same query/preview UI used for uploaded files.
- **Why it's not in scope now:** `fix.md` Phase A2 requires *locking down* DuckDB's extension loading and external access specifically because it's a live security hole today (unauthenticated arbitrary SQL + unrestricted extensions = arbitrary file read / SSRF). This feature is the exact opposite ask — it *wants* controlled external access. It can only be built safely on top of a properly allowlisted, per-connection-scoped extension system, and it introduces a new credential-storage security surface (customer DB passwords) that needs its own threat model before any code is written.
- **Rough sizing:** significant — new encrypted-credential storage, per-connection network egress rules, UI for connection management, and its own security review. Treat as a Phase 4+ item, not a quick add-on.

**27.2 Data Contracts (schema & quality assertions that can block a commit)**
`PRODUCT.md` explicitly positions Strata against Great Expectations ("requires users to know in advance what to check; no AI-native profiling or visual discovery"), but doesn't currently offer any way to *codify* expectations once they're discovered.
- **How it would work:** a lightweight assertion layer, attachable per-dataset: e.g. `column "email" must match pattern`, `column "age" must be >= 0`, `row count must not drop more than 20% vs. parent version`, `schema must not remove a column without a major version bump`. Store contracts as versioned JSON/YAML alongside the dataset (their own row in Postgres, tied to `dataset_id`). On every new commit (web upload, CLI, SDK, or pipeline output — Pillar 7), run the contract checks as part of the existing profiling job (Pillar 4) *before* the version is finalized as HEAD; a violation either blocks the commit outright or lands it as a flagged/draft version requiring explicit override, depending on a per-contract severity setting.
- **Why it's not in scope now:** this is a genuinely new product surface, not an extension of existing plumbing the way Pillar 26 is — it needs its own schema, its own UI for authoring rules, and a real design decision about *blocking* semantics (a hard block on ingestion is a much bigger behavioral commitment than a passive quality score). It's valuable, but it deserves to be scoped as its own mini-project once the core platform in `fix.md` is stable, not bolted on mid-remediation.
- **Rough sizing:** medium-large. Natural to file as a Phase 4 blueprint item and design properly (rule DSL, storage schema, UI) before building.

**27.3 Native Notebook Kernel Integration**
The current plan (Pillar 12.1) covers a JupyterLab/VS Code *extension* that talks to the SDK — useful, but still a thin client around `strata.Dataset`. Hex and Deepnote's actual moat is a managed, collaborative notebook *environment* itself.
- **How it would work:** either (a) a hosted Jupyter kernel gateway Strata manages, pre-authenticated against the user's workspace so `strata` datasets are available as local variables with zero setup, or (b) a real Jupyter kernel *extension* (not just an SDK wrapper) that adds Strata-aware magics (`%%strata_query`, cell-level lineage tracking so notebook cells themselves become lineage nodes per Pillar 6).
- **Why it's not in scope now:** this is the single biggest lift in this whole document — it's effectively "build or host a notebook platform," which duplicates infrastructure Hex/Deepnote/Google Colab already run at scale, and it's explicitly called out as Phase 4 ("In-Browser Compute Environment," Pillar 13) in the existing roadmap for the same reason. Pillar 12.1's lighter extension approach gets most of the benefit (dataset access from notebooks) at a fraction of the cost, and should be the thing that ships first — this pillar is here so the *heavier* version of the idea isn't forgotten, not because it's next.
- **Rough sizing:** large — likely its own multi-week initiative requiring infra decisions (managed kernels vs. local extension) before any feature work starts.

---

## 5. Phased Roadmap

### Phase 0 — Proof of Concept (Weeks 1–3)
**Validation questions:**
1. Does the universal previewer (Excel, CSV, Parquet) with instant virtual grid and micro-stats feel 10x faster and more delightful than opening desktop tools?
2. Does the conversational AI data analyst running verified queries solve real analytical questions, or does it feel like a novelty?

- [ ] Universal preview engine: CSV, multi-sheet Excel (`.xlsx`, `.xls`), and Parquet via DuckDB-Wasm (Pillars 1.7, 21.1, 21.2, 21.5)
- [ ] Instant column profiling & micro-stats on hover (Pillars 4.1, 21.7)
- [ ] Conversational query engine with verified DuckDB SQL execution and plain-English summaries (Pillars 5.1, 5.2, 23.1, 23.2, 23.3)
- [ ] Minimal single-page UI: Drop file → instant grid preview → interactive chart & chat dock
- [ ] Validation milestone: Test against 10 real-world messy files (Excel finance models, Kaggle CSVs, nested JSON, compressed Parquets).

---

### Phase 1 — MVP: The Core Studio & Versioning (Weeks 4–8)
- [ ] Content-addressed immutable versioning engine (Pillars 2.1, 2.2, 2.3, 2.7, 2.8, 2.9)
- [ ] Rich multi-dimensional diffing: schema, row count, nullability, cell-level primary key diffs (Pillars 3.1, 3.2, 3.3, 3.4, 3.8)
- [ ] Interactive Visual Chart Studio: drag-and-drop shelf builder with scatter, line, bar, histogram (Pillars 22.1, 22.2)
- [ ] Point-and-click data wrangling recipes: fill nulls, trim, split, filter, dedupe with Python code export (Pillars 5.3, 7.3)
- [ ] Full automated profiling & quality score (Pillars 4.2, 4.3, 4.4, 4.5, 4.8, 4.9, 4.15)
- [ ] Python SDK & CLI: `pip install strata` with `Dataset.upload()`, `Dataset.load()`, `strata diff` (Pillars 8.1–8.7)
- [ ] Shareable read-only preview links (Pillar 11.1)

---

### Phase 2 — Usable Product: Deep EDA & Baseline AutoML (Weeks 9–14)
- [ ] Scientific & specialized formats: PubChem `.sdf`/`.mol` chemical structures, GeoJSON map preview (Pillars 1.8, 21.3, 21.4)
- [ ] Deep EDA Dossier: correlation matrix heatmap, missingness matrix, pairplot generator (Pillars 22.3, 22.4, 22.5, 22.6)
- [ ] One-click baseline AutoML sandbox: LightGBM/Random Forest, SHAP explainability, ROC/confusion matrix (Pillars 24.1, 24.2, 24.4, 24.5)
- [ ] Interactive Dashboards & KPI canvases (Pillars 25.1, 25.2, 25.4)
- [ ] Lineage DAG tracking: parent/child version tracing and impact analysis (Pillars 6.1, 6.3, 6.4)
- [ ] Workspaces, roles (Owner, Editor, Viewer), and activity feeds (Pillars 9.1, 9.2, 9.5)
- [ ] Full-text and schema search (Pillars 10.1, 10.5)
- [ ] Free / Pro billing tiers (Pillars 15.1, 15.2)

---

### Phase 3 — Scale-Ready Platform (Weeks 15–22)
- [ ] Branching and merging workflows for datasets with merge-conflict UI (Pillars 2.5, 2.6)
- [ ] Scheduled pipeline orchestration with retry policies and dead-letter queues (Pillars 7.4–7.9)
- [ ] Isolated containerized execution sandboxes for heavy Python/AutoML tasks (Pillar 13.3)
- [ ] Semantic vector search across datasets (`pgvector`) (Pillar 10.4)
- [ ] Integrations: JupyterLab extension, VS Code extension, MLflow & W&B linkage, Slack alerts (Pillars 12.1–12.8)
- [ ] Security & compliance foundations: audit logs, automated PII export masking, GDPR workflows (Pillars 16.1–16.5)

---

### Phase 4 — Ecosystem & Vision
- [ ] In-browser zero-setup Jupyter compute environment (Pillar 13.1, 13.4)
- [ ] Public dataset marketplace with creator monetization and dataset requests (Pillar 19)
- [ ] Enterprise governance & catalog integration (Collibra/Alation sync, VPC deployments) (Pillar 20)
- [ ] Data contracts — schema/quality assertions that can block a commit (Pillar 27.2)
- [ ] Live external database querying via allowlisted DuckDB scanners (Pillar 27.1)
- [ ] Native notebook kernel integration (Pillar 27.3)

---

### Phase 5 — Post-Remediation Enhancements
**Gate: do not start this phase until every item in `fix.md` is done and its "Definition of done" checklist passes — real auth, real persistence, real LLM integration, real AutoML/SHAP. These features build directly on that being true; built on the current mocked state, they'd just be more surface area to redo.**

- [ ] Dataset quality score trend — historical scoring stored per version, plotted against the commit DAG (Pillar 26.1)
- [ ] AI-generated diff narratives — LLM-written plain-English changelogs from structured diff output, reusing the `fix.md` Phase C provider layer and daily-cap mechanism (Pillar 26.2)
- [ ] Dataset-to-model reproducibility & drift check — re-run a registered model's exact pipeline against the dataset's current HEAD and report metric/distribution drift (Pillar 26.3)
- [ ] CI-ready diff gating in the CLI (`strata diff --fail-on ...`) for use in consumers' own CI pipelines (Pillar 26.4)