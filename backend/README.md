# Strata Backend API Service

The high-performance FastAPI backend for **Strata** — featuring DuckDB 1.5 in-memory execution, Polars dataframes, PyArrow serialization, async SQLAlchemy, and JWT authentication.

---

## Quick Start

The backend is managed with [`uv`](https://docs.astral.sh/uv/).

### 1. Install Dependencies
```bash
cd backend
uv sync
```

### 2. Run the Development Server
You can start the server using any of the following commands from the `backend/` directory:

```bash
# Option A: Using the CLI entrypoint
uv run strata-api

# Option B: Using uvicorn with auto-reload (Recommended for active development)
uv run uvicorn strata_api.main:app --host 0.0.0.0 --port 8000 --reload

# Option C: Running the main Python script directly
uv run python main.py
```

* **API Base URL:** `http://localhost:8000`
* **Interactive Swagger UI:** `http://localhost:8000/api/docs`
* **OpenAPI Specification:** `http://localhost:8000/api/openapi.json`
* **Health Check:** `http://localhost:8000/api/health`

---

## Running Automated Tests

Run the full pytest suite:
```bash
cd backend
uv run pytest
```

To run with verbose output:
```bash
uv run pytest -v
```

---

## Environment Variables

Copy `.env.example` to `.env` to customize settings:
```bash
cp .env.example .env
```

Key configuration options:
- `DATABASE_URL`: Defaults to `sqlite+aiosqlite:///./data/strata.db` for instant local development without containers. Supports `postgresql+asyncpg://...` for production.
- `JWT_SECRET_KEY`: Secret key used for signing authentication tokens.
- `STORAGE_BACKEND`: `local` or `s3`.
- `DUCKDB_MEMORY_LIMIT`: Maximum RAM allocated to DuckDB (e.g. `4GB`).
