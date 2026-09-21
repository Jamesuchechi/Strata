# Documentation (Skeleton)

This is the table of contents for user-facing documentation for Strata — The AI-Native Data Science Studio & GitHub for Datasets. Fill in each section as corresponding features ship (cross-check against `TODO.md`).

---

## 1. Getting Started
- [ ] Installing the Python SDK (`pip install strata`)
- [ ] Your first 60 seconds: Drag, drop, and preview any dataset
- [ ] Navigating multi-format files: CSV, multi-sheet Excel (`.xlsx`, `.xls`), and Parquet
- [ ] Inspecting column micro-stats and the automated data quality score
- [ ] Asking your first question with the Conversational Data Analyst

---

## 2. Core Concepts
- [ ] **Immutable Versions:** Content-addressing, cryptographic hashes, and commit history explained simply
- [ ] **Multi-Dimensional Diffs:** Schema migrations, distribution shifts, nullability deltas, and cell-level diffs
- [ ] **Hybrid Compute Engine:** How DuckDB-Wasm executes queries locally in your browser vs. server-side workers
- [ ] **Data Lineage:** Tracing dataset provenance from raw ingestion to features, models, and dashboards
- [ ] **Composite Quality Score:** How metrics (missingness, outliers, cardinality, PII) are calculated and weighted

---

## 3. Universal Preview & Multi-Format Inspector
- [ ] Using the 1,000,000+ row virtual grid: Sorting, multi-column filtering, and search
- [ ] Working with Excel workbooks: Switching sheets, detecting formula outputs, and handling merged headers
- [ ] Scientific & chemical compound preview: Rendering 2D/3D structures from PubChem (`.sdf`, `.mol`), PDB, and FASTA
- [ ] Geospatial map inspector: Visualizing GeoJSON, Shapefile, and GeoParquet with interactive map layers
- [ ] One-click format converter: Exporting between Excel, CSV, Parquet, and Arrow

---

## 4. Visual EDA & Drag-and-Drop Chart Studio
- [ ] Building visualizations with the shelf designer (X, Y, Color, Size, Facet)
- [ ] Chart catalog: Scatter, line, bar, histogram, boxplot, violin, and contour plots
- [ ] Generating the Automated EDA Dossier
- [ ] Analyzing missingness co-occurrence with the Missing Value Matrix
- [ ] Interactive correlation heatmaps and multicollinearity warnings
- [ ] Exporting publication-ready charts (SVG, PNG, or executable Plotly/Matplotlib code)

---

## 5. In-App Conversational Data Analyst & Code Interpreter
- [ ] Natural language querying: Asking questions in plain English
- [ ] Code transparency: Auditing generated DuckDB SQL and Python code
- [ ] Automated statistical hypothesis testing (t-tests, ANOVA, Chi-Square, regression)
- [ ] Investigating anomalies and trend shifts with the Root-Cause Detective
- [ ] Privacy safeguards: Verifying that raw data and PII remain protected

---

## 6. Visual Data Wrangling & Transform Recipes
- [ ] Point-and-click transformations: Imputation, text trimming, regex extraction, deduplication, type casting
- [ ] Managing transformation recipes and time-machine previews
- [ ] Exporting clean, reproducible Python (Polars / Pandas) and SQL scripts
- [ ] Committing wrangled datasets as new immutable versions

---

## 7. AutoML Sandbox & Model Explainability
- [ ] Training 60-second baseline predictive models (LightGBM, XGBoost, Random Forest, Ridge)
- [ ] Auto-detecting tasks: Binary classification, multi-class classification, and regression
- [ ] Evaluating models: Confusion matrices, ROC-AUC curves, precision-recall, and residual plots
- [ ] SHAP feature explainability: Interpreting global feature importance and individual prediction waterfalls
- [ ] Data leakage detection: Catching target leakage and train/test temporal overlap
- [ ] Registering model artifacts and tying them to exact dataset versions

---

## 8. Interactive Dashboards & Executive Storytelling
- [ ] Building custom dashboards: Pinning charts, KPI tiles, and markdown narratives
- [ ] Adding global interactive filter controls (dropdowns, date ranges, sliders)
- [ ] Generating one-click AI executive summary decks
- [ ] Sharing dashboards: Password protection, public links, and workspace permissions
- [ ] Exporting executive PDF and HTML reports

---

## 9. Python SDK Reference (`strata`)
- [ ] `strata.Dataset(name)` — Constructor and authentication options
- [ ] `.upload(path, format=None)` — Uploading local files with automatic type inference
- [ ] `.load(version="latest", engine="polars")` — Loading into Polars or Pandas DataFrames
- [ ] `.commit(message=..., tags=[...])` — Creating an immutable version snapshot
- [ ] `strata.diff(name, v1=..., v2=...)` — Programmatic schema and distribution diffs
- [ ] `.profile()` — Fetching structured profiling metrics and quality scores
- [ ] `.watch(callback=...)` — Subscribing to dataset updates programmatically
- [ ] Notebook magic commands: `%strata_load dataset_name`
- [ ] Client configuration (`.strataconfig`) and environment variables

---

## 10. CLI Reference (`strata`)
- [ ] `strata preview <file_path>` — Launch instant terminal or browser preview
- [ ] `strata upload <file_path> [--name <name>]`
- [ ] `strata checkout <dataset_name> [--version <tag_or_hash>]`
- [ ] `strata diff <v1> <v2>`
- [ ] `strata profile <dataset_name>`
- [ ] `strata login` / `strata config`

---

## 11. Integrations
- [ ] JupyterLab and VS Code extensions
- [ ] Google Colab workflow
- [ ] MLflow & Weights & Biases experiment linkage
- [ ] dbt model output tracking
- [ ] Slack and Discord alert webhooks

---

## 12. FAQ & Troubleshooting
- [ ] "How does Strata preview 200MB Excel files in the browser without lagging?"
- [ ] "Why does DuckDB-Wasm run faster than pandas for exploratory filtering?"
- [ ] "How do I roll back to a prior version if an automated recipe failed?"
- [ ] "Is my raw data uploaded to third-party LLMs when using the Conversational Analyst?"
- [ ] "How do I export my dataset and transformation recipe to standalone Python code?"

---

## 13. API Reference
*(Auto-generated from FastAPI OpenAPI specification at `/docs` once endpoints stabilize.)*