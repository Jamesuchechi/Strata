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