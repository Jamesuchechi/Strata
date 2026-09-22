# TODO — Phased Build Plan

Full feature descriptions live in `BLUEPRINT.md` — this file tracks *what is being built in each phase*. Each line references a `Pillar.Item` number from the 25 product pillars; look it up in `BLUEPRINT.md` for full rationale and specification.

Every feature in the master blueprint belongs to exactly one phase below. New feature ideas go into the Parking Lot first, then get filed into `BLUEPRINT.md` and triaged into a phase — never straight into code.

**Golden Rule:** Do not begin a phase until the previous phase's validation milestone has been thoroughly tested and answered honestly.

---

## Phase 0 — Proof of Concept: Universal Previewer & Conversational Analyst
**Validation Questions:**
1. Does the universal previewer (CSV, multi-sheet Excel `.xlsx`/`.xls`, Parquet) with the client-side virtual grid and hover micro-stats feel 10x faster and more convenient than opening Excel, pandas, or desktop tools?
2. Does the conversational AI data analyst executing verified DuckDB SQL/Python queries answer real-world analytical questions accurately with zero hallucinations?

- [x] **Universal Preview Engine:** 1.7, 21.1, 21.2, 21.5, 21.6 (CSV, multi-sheet Excel, Parquet via DuckDB virtual grid)
- [x] **Instant Profiling & Micro-Stats:** 4.1, 21.7 (Row/col counts, dtypes, null %, sparkline distributions on header hover)
- [x] **Conversational Data Analyst (DuckDB Code Execution):** 5.1, 5.2, 23.1, 23.2, 23.3 (Natural language to verified SQL/Python execution with plain-English summary)
- [x] **Independent Multi-Page Studio Architecture:** Dedicated `/upload`, `/datasets`, `/datasets/[id]`, `/query`, `/analyst`, `/versions` with reusable topbar, sidebar, context bar, and command palette.
- [ ] **Field Testing Milestone:** Manually test across 10 real-world messy files (multi-sheet financial Excel workbooks, Kaggle CSVs, nested JSON, compressed Parquets).
- [ ] **Decision Point:** Document findings and user feedback here before moving to Phase 1.

---

## Phase 1 — MVP: The Core Studio & Versioning Backbone

- [x] **Ingestion:** 1.1, 1.2, 1.3, 1.8, 1.12 (Web upload, CLI upload, SDK upload, duplicate detection)
- [x] **Immutable Versioning:** 2.1, 2.2, 2.3, 2.7, 2.8, 2.9, 2.12 (Content-addressed blobs, commit messages, visual history DAG, rollback)
- [x] **Multi-Dimensional Diffing:** 3.1, 3.2, 3.3, 3.4, 3.8 (Row/col deltas, schema diffs, primary-key cell diffs, visual side-by-side UI)
- [x] **Visual Chart Studio:** 22.1, 22.2 (Drag-and-drop shelf builder: 16 chart types with AI/Data Science explanation dock & Python code export)
- [x] **Data Wrangling Recipes:** 5.3, 7.3 (Point-and-click recipes: fill nulls, trim, split, dedupe with auto-version commit & Polars code export)
- [x] **Quality & Profiling:** 4.2, 4.3, 4.4, 4.5, 4.8, 4.9, 4.15 (Numeric/categorical stats, missing patterns, PII detection, composite quality score)
- [x] **AI Layer:** 5.5, 5.14, 5.15 (Semantic types, confidence scoring, explainable audit trail)
- [x] **Python SDK & CLI (`strata`):** 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.13 (`strata upload`, `strata diff`, `strata query`, `strata.Dataset`)
- [x] **Sharing:** 11.1 (Shareable read-only preview links at `/shared/[token]`)

---

## Phase 2 — Usable Studio: Deep EDA, Specialized Formats & Baseline AutoML

- [x] **Specialized Formats & Converters:** 1.4, 1.9, 1.14, 1.15, 21.3, 21.4, 21.8 (PubChem `.sdf`/`.mol` chemical structures, GeoJSON map preview, multi-format conversion)
- [x] **Deep EDA Dossier:** 22.3, 22.4, 22.5, 22.6, 22.7 (Correlation matrix, missingness matrix, pairplot generator, high-res export)
- [x] **Conversational Analyst Advanced:** 23.4, 23.5, 23.6 (Automated hypothesis testing: t-test/ANOVA/Chi-Square, anomaly root-cause detective)
- [x] **AutoML Sandbox:** 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7 (Baseline LightGBM/Random Forest, SHAP explainability, ROC/confusion matrices, leakage detection)
- [x] **Interactive Dashboards:** 25.1, 25.2, 25.3, 25.4 (Flexible widget canvas, global parameter filters, executive summary generator)
- [x] **Lineage DAG:** 6.1, 6.3, 6.4 (Parent/child tracking, backward provenance, forward impact analysis)
- [x] **Versioning Enhancements:** 2.4, 2.10, 2.11, 2.14, 2.17 (Tags, semver, pinned versions, version permissions, custom metadata)
- [x] **Diffing Enhancements:** 3.5, 3.6, 3.7, 3.9, 3.12, 3.13 (Distribution diffs, rename detection, categorical domain shifts)
- [x] **Collaboration:** 9.1, 9.2, 9.3, 9.4, 9.5 (Workspaces, roles, invites, activity feed)
- [x] **Search:** 10.1, 10.5 (Full-text and schema search)
- [x] **Billing & Onboarding:** 15.1, 15.2, 18.1, 18.2, 18.3, 18.6 (Free/Pro plans, onboarding tutorial, pre-loaded sample datasets)

---

## Phase 3 — Scale-Ready Platform

- [ ] **Isolated Compute Sandboxes:** 13.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9 (Containerized Python runners for heavy ETL, scheduled pipelines, dead-letter queues)
- [x] **Branching & Merging:** 2.5, 2.6, 2.13, 2.15, 2.16 (Git-style branching, visual merge conflict resolution, row/col blame)
- [x] **Full Lineage Ecosystem:** 6.2, 6.5, 6.6, 6.7, 6.8, 6.9 (Interactive DAG, model registration, OpenLineage export, deletion protection)
- [x] **Semantic Vector Search:** 10.2, 10.3, 10.4, 10.6, 10.7 (Embedding-based natural language search across datasets)
- [x] **Public Showcase & Sharing:** 11.2, 11.3, 11.4, 11.5, 11.6, 11.7 (Public dataset showcase, embed widgets, BibTeX citations, forking)
- [ ] **Integrations:** 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10 (JupyterLab, VS Code, MLflow, W&B, dbt, Slack alerts)
- [ ] **Collaboration Advanced:** 9.6, 9.7, 9.8, 9.9, 9.10 (Cell/row comments, review approvals, asset transfer)
- [ ] **Security & Compliance:** 16.1, 16.2, 16.3, 16.4, 16.5, 16.6 (AES-256/TLS 1.3, SSO, audit logs, PII export masking, GDPR workflows)
- [ ] **Admin & Operations:** 17.1, 17.2, 17.3, 17.4, 17.5 (Admin console, health dashboard, rate limiting, worker queue observability)

---

## Phase 4 — Vision & Ecosystem (Long-Term)

- [ ] **In-Browser Compute Environment:** 13.1, 13.2, 13.4 (Zero-setup browser notebook, GPU options)
- [ ] **Enterprise Compliance:** 16.7, 20.1, 20.2, 20.3, 20.4 (SOC 2 Type II, enterprise catalog sync, VPC/on-prem deployments)
- [ ] **Data Marketplace:** 19.1, 19.2, 19.3, 19.4 (Public marketplace, monetization, data request board)

---

## Parking Lot
*New ideas go here first → add to `BLUEPRINT.md` as a numbered item → triage into a phase.*

- [ ]