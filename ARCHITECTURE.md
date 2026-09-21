# Architecture

This document describes the architectural design for Strata as an AI-native Data Science Studio and dataset version control platform. It outlines the hybrid compute model, data flow, format normalization pipeline, and phased evolution.

---

## Guiding Principles

1. **Sub-Second Interaction via Hybrid Compute:**
   Do not force every sort, filter, or chart query to round-trip through a server. For datasets under ~150MB, execution runs client-side in the browser via **DuckDB-Wasm** and Apache Arrow. For multi-gigabyte files, queries stream through the server-side **FastAPI + DuckDB/Polars** engine.
2. **Apache Arrow as the Universal In-Memory Spine:**
   Whether the original file is Excel, CSV, Parquet, SQLite, or JSON, it is parsed into Arrow record batches. This guarantees zero-copy data interchange between DuckDB, Polars, and visualization renderers.
3. **Verifiable, Code-Grounded AI Analysis:**
   The conversational AI analyst never guesses or hallucinates numbers. It generates deterministic DuckDB SQL or Python code, executes it against real data in an isolated sandbox, inspects the runtime result, and surfaces the verified answer alongside executable code.
4. **Content-Addressed Versioning Backbone:**
   Every dataset version is stored as an immutable, content-hashed blob in S3-compatible storage. PostgreSQL manages the version graph (parent pointers, commits, branches, tags, messages).
5. **Decoupled Heavy Compute:**
   Profiling, AutoML model training, and long-running pipeline transformations run on isolated worker pools (Celery + Redis / Container Sandboxes), keeping the web-serving API responsive and stateless.

---

## System Architecture Overview

```
                      ┌────────────────────────────────────────────────────────┐
                      │                   Next.js Studio UI                    │
                      │  ┌──────────────────┐  ┌─────────────┐  ┌───────────┐  │
                      │  │ Virtual 1M+ Grid │  │ Chart Shelf │  │  AI Chat  │  │
                      │  └────────┬─────────┘  └──────┬──────┘  └─────┬─────┘  │
                      │           │                   │               │        │
                      │           ▼                   ▼               │        │
                      │  ┌─────────────────────────────────────────┐  │        │
                      │  │     Client Compute (DuckDB-Wasm)        │  │        │
                      │  │   (Sub-second local filters & charts)   │  │        │
                      │  └────────────────────┬────────────────────┘  │        │
                      └───────────────────────┼───────────────────────┼────────┘
                                              │ HTTP / WS             │
                                              ▼                       ▼
                      ┌────────────────────────────────────────────────────────┐
                      │                      FastAPI API                       │
                      │  ┌───────────────────┐        ┌─────────────────────┐  │
                      │  │ Ingestion & Parsers│        │ AI Code Coordinator │  │
                      │  │ (Excel, Parquet,   │        │ (NL -> DuckDB/Python│  │
                      │  │  PubChem, GeoJSON) │        │  code generation)   │  │
                      │  └────────┬──────────┘        └──────────┬──────────┘  │
                      └───────────┼──────────────────────────────┼─────────────┘
                                  │                              │
                    ┌─────────────┼──────────────────────────────┴───────────┐
                    │             │                                          │
                    ▼             ▼                                          ▼
          ┌─────────────────┐ ┌───────────────┐               ┌────────────────────────┐
          │   PostgreSQL    │ │  Redis Queue  │               │ Isolated Code Sandbox  │
          │ (Metadata, DAG, │ │   (Celery)    │               │  (Docker / Pyodide /   │
          │  Lineage CTEs)  │ └───┬───────────┘               │   Python Runner)       │
          └─────────────────┘     │                           └────────────────────────┘
                                  ▼                                       ▲
                        ┌───────────────────┐                             │
                        │ Profiling & AutoML│                             │
                        │   Worker Fleet    ├─────────────────────────────┘
                        │ (LightGBM, SHAP,  │
                        │  ydata-profiling) │
                        └─────────┬─────────┘
                                  │
                                  ▼
                        ┌───────────────────┐
                        │  Object Storage   │
                        │ (S3 / R2 / MinIO) │
                        │  Raw files, blobs │
                        │  Parquet mirrors  │
                        └───────────────────┘
```

---

## Multi-Tier Execution & Query Model

To achieve fluid, desktop-like responsiveness without astronomical cloud compute bills, Strata implements three compute tiers:

### Tier 1: Client-Side WASM Engine (DuckDB-Wasm + Arrow)
- **Target:** Files < 150MB (covers ~80% of exploratory data science files).
- **Capabilities:** Instant sorting, multi-column filtering, aggregations, histogram generation, and chart updates running locally in WebAssembly at 60 FPS.
- **Benefits:** Zero server latency, zero cloud compute cost per query, completely private offline exploration.

### Tier 2: Server-Side Vectorized Engine (FastAPI + DuckDB / Polars)
- **Target:** Large datasets (150MB – 10GB+) and multi-table operations.
- **Capabilities:** Streamed chunk parsing directly from S3-compatible storage, partitioned queries, and automated format conversion (e.g. converting 1GB multi-sheet Excel into optimized Parquet).

### Tier 3: Isolated Code & Model Sandbox (Celery + Containerized Python Runner)
- **Target:** In-App Code Interpreter (Python execution), automated statistical tests, and AutoML baseline training.
- **Capabilities:** Controlled execution environment with timeout, memory, and network constraints. Runs LightGBM, scikit-learn, and SHAP calculations, streaming outputs and visualizations back via WebSockets.

---

## Universal Format Normalization Pipeline

To support diverse formats (Excel, CSV, Parquet, PubChem `.sdf`, GeoJSON) without bespoke UI logic for every type:

1. **Ingest & Type Sniffing:** Detect encoding (UTF-8, Latin-1), delimiter (`,`, `\t`, `;`, `|`), compression (`gzip`, `zip`), and format magic bytes.
2. **Specialized Parsers:**
   * **Spreadsheets:** Multi-sheet extraction (`openpyxl` / `calamine`) exposing individual sheet tabs.
   * **Columnar:** Zero-copy Parquet / Arrow reading.
   * **Scientific:** RDKit / PubChem parser extracting 2D SMILES representations and molecular properties alongside tabular metadata.
   * **Geospatial:** GeoPandas / Shapely parser converting coordinates and polygons to GeoJSON layers.
3. **Normalized Arrow Cache:** A companion Parquet/Arrow representation is cached in object storage for high-speed columnar querying and diffing.

---

## Versioning & Diffing Architecture

- **Content-Addressed Blobs:** Uploaded datasets are hashed (SHA-256 over raw content or canonical Arrow streams) and stored as immutable objects: `s3://strata-store/blobs/{hash}`.
- **Version Graph:** The PostgreSQL `dataset_versions` table maintains a Directed Acyclic Graph (DAG) with `parent_version_id` pointers, tags (`prod`, `v1.0`), author metadata, and commit messages.
- **Two-Tier Diff Engine:**
  1. *Metadata & Schema Diff (< 50ms):* Compare column schemas, data types, row counts, and null ratios directly from Postgres metadata.
  2. *Statistical & Cell Diff (On-Demand):* DuckDB executes an outer join on designated primary keys or computes distribution shifts (mean, median, IQR, histogram buckets) between the two versions without loading full tables into memory.

---

## AI Conversational Analyst Architecture

```
[User Prompt: "Compare churn rate by region"]
                     │
                     ▼
[LLM Coordinator: Injects schema, column summaries, & sample rows]
                     │
                     ▼
[Generated Deterministic Code: DuckDB SQL or Python script]
                     │
                     ▼
[Execution Sandbox: Runs query against local Arrow batch]
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
[Runtime Result / Table]  [Generated Plotly / Vega Spec]
          │                     │
          └──────────┬──────────┘
                     ▼
[LLM Verifier: Generates plain-English narrative with evidence]
                     │
                     ▼
[UI Message: Renders interactive chart + table + explanation]
```

1. **Zero-PII Context Window:** Only column names, inferred semantic types, and anonymized aggregate statistics are sent to the LLM.
2. **Self-Correction Loop:** If the generated DuckDB SQL or Python fails with a runtime error, the sandbox catches the exception and prompts the model to correct its query before rendering.

---

## Roadmap & Scale Evolution

### V1 — Proof of Concept & Core Studio
- In-browser DuckDB-Wasm + Next.js for instant preview and virtual grid.
- FastAPI backend with DuckDB for remote queries and Excel/CSV/Parquet parsing.
- PostgreSQL for version DAG and metadata.
- Celery worker for ydata-profiling and AI summary generation.
- S3-compatible object storage for immutable blobs.

### V2 — Usable Studio & Deep Analysis
- Lineage DAG via recursive CTEs over `dataset_edges` in Postgres.
- In-app Code Interpreter sandbox runner for Python data science queries and AutoML training.
- Native rendering for scientific (PubChem `.sdf`) and geospatial (GeoJSON) formats.
- Drag-and-drop visual chart studio and interactive dashboard canvas.

### V3 — Scale-Ready Enterprise
- `pgvector` for semantic search across dataset schemas and natural language descriptions.
- Hardened sandbox execution cluster (e.g., Firecracker microVMs or gVisor) with per-tenant resource limits.
- Branching and distributed merge conflict resolution.
- Dedicated streaming ingestion workers for multi-gigabyte files.