# Strata — Fix & Build Instructions for Coding Agent

## How to work through this file

- This is not a suggestions list. Every item below is a required change. Do not skip, water down, or "partially address" an item and mark it done.
- **No new mocks. No new stubs. No new hardcoded/fake success responses.** If you cannot implement something for real in this pass, leave it explicitly marked `# NOT IMPLEMENTED` with a TODO comment and a tracking note in `TODO.md` — do not return fabricated data that looks real.
- After every item, write or update a test that actually exercises the fixed behavior (not just "the endpoint returns 200"). An item is only done when there is a passing test proving the real behavior, not the mocked behavior.
- Do not touch `TODO.md`'s `[x]` marks until the corresponding item here is fully done and tested. Once done, update `TODO.md` to match reality — if something previously marked `[x]` turns out to have been fake, uncheck it until this file's fix is complete.
- Work phase by phase, in order. Phase A blocks everything else — do not build new features (Phase D) on top of an unauthenticated, unsandboxed backend.
- After each phase, run the full test suite (`pytest` in `backend/`) and confirm no regressions before moving to the next phase.
- If a fix requires a decision I haven't specified (e.g., exact rate limit numbers), pick a sane default, document it inline, and flag it in your summary — don't block on it.

---

## Phase A — Critical Security (blocking, do first)

### A1. Enforce authentication on every router that currently has none
Every router except `auth.py` and `health.py` currently has zero `get_current_user` usage. Add auth dependency to all protected endpoints in:
`datasets.py`, `query.py`, `billing.py`, `security.py`, `collaboration.py`, `pipelines.py`, `lineage.py`, `branches.py`, `discovery.py`, `integrations.py`, `eda.py`, `diff.py`, `preview.py`, `automl.py`, `showcase.py`.
- Public-by-design endpoints (e.g. `/shared/{token}` preview links, public showcase pages) must use their own scoped access check (valid share token / public flag), not skip auth entirely — document explicitly in a comment why each public route is public.
- Every dataset/resource must be scoped to the owning user or workspace. Add an ownership/workspace check, not just "logged in as *someone*."
- **Acceptance test:** for every router above, add a test that an unauthenticated request returns 401, and that user A cannot access user B's resources.

### A2. Lock down the DuckDB engine
In `core/duckdb_engine.py`, on every connection:
```sql
SET enable_external_access = false;
SET lock_configuration = true;
```
- Disable extension loading (`autoinstall_known_extensions`/`autoload_known_extensions` = false) unless a specific extension is explicitly required and vetted.
- Validate/allowlist any SQL passed to `/api/query`'s raw-SQL path: reject `ATTACH`, `COPY`, `INSTALL`, `LOAD`, `PRAGMA`, and any read from an absolute filesystem path or URL that isn't the dataset's own registered view.
- **Acceptance test:** a query attempting `read_csv_auto('/etc/passwd')` or `INSTALL httpfs` must be rejected with a clear error, not executed.

### A3. Fix multi-tenant DuckDB isolation
`get_duckdb_engine()` returns one global singleton connection shared by all requests/users. Replace with per-workspace (or per-request) scoping so one user cannot query another user's registered views by guessing/knowing the view name.
- Views must be namespaced by workspace/dataset ownership (e.g. `ws_{workspace_id}__{dataset_view}`), and query execution must verify the requesting user owns/has access to the workspace before any view in that namespace is queryable.
- **Acceptance test:** user A uploads a dataset; user B, authenticated as a different user, cannot query or discover A's view.

### A4. Stop leaking credentials in API responses
In `routers/auth.py`:
- Remove `demo_link` from `/auth/magic-link` and `demo_token` from `/auth/forgot-password` response bodies. These must never appear in an HTTP response.
- Implement real email delivery (or, if no email provider is available yet, write the token to a server-side log/table only accessible to the account owner via an already-authenticated session — never in the unauthenticated response).
- Add an environment-driven email provider (e.g. Resend, Postmark, or SMTP) — pick one, wire it with a config key, and if the key is unset in dev, log the link to the console instead of returning it in the response.
- **Acceptance test:** neither endpoint's JSON response contains a usable token.

### A5. Remove the fake API key check
`core/security.py`: `verify_api_key()` currently `return True` unconditionally. Implement it for real — validate against stored, hashed API keys tied to a user/workspace, with expiry and revocation support. Wire it into the CLI/SDK auth path in `strata_cli` and `strata_sdk`.
- **Acceptance test:** a request with an invalid/revoked API key is rejected.

### A6. Add rate limiting
`SECURITY.md` promises per-plan-tier rate limiting; none exists. Add middleware (e.g. `slowapi` or a Redis-backed token bucket once Redis is wired in Phase B) on: `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/magic-link`, and `/api/query`. Return 429 with a `Retry-After` header.
- **Acceptance test:** exceeding the limit on `/auth/login` returns 429.

### A7. JWT / token hygiene
- Move `JWT_SECRET_KEY` off the insecure hardcoded default — the app must refuse to start in `ENVIRONMENT=production` if `JWT_SECRET_KEY` is unset or equals the default dev value.
- Add refresh tokens + a revocation mechanism (denylist table or short-lived access token + rotating refresh token) so a compromised 7-day token can't be used indefinitely.
- Frontend: move the JWT out of `localStorage` (`frontend/src/lib/api/auth.ts`) into an `HttpOnly`, `Secure`, `SameSite=Strict` cookie set by the backend, to reduce XSS token theft risk. Update the API client to stop manually attaching a bearer header from `localStorage` and instead rely on the cookie (or, if bearer-header auth must stay for the SDK/CLI, keep both paths but stop storing the web session token in `localStorage`).
- **Acceptance test:** app fails fast on boot in production mode with default secret; login flow works with cookie-based auth.

---

## Phase B — Real persistence (no more in-memory dicts)

### B1. Migrate every in-memory store to Postgres or sqlite3(for development)   
Replace all of the following module-level globals with real SQLAlchemy models + database-backed CRUD:
`_datasets_db`, `_shared_links` (datasets.py) · `_audit_trail` (security.py) · `_webhook_configs`, `_integration_events` (integrations.py) · `_workspaces_db`, `_members_db`, `_invitations_db`, `_dataset_permissions_db`, `_activity_feed_db`, `_dataset_comments_db`, `_review_requests_db` (collaboration.py) · `_favorites_set`, `_recents_history` (discovery.py) · `_models_db` (lineage.py) · `_pipelines_db`, `_pipeline_runs`, `_dead_letter_queue` (pipelines.py) · `_branches_db`, `_active_branch_db` (versioning/branches.py) · `_commits` (versioning/registry.py) · `_showcase_registry`, `_user_starred_showcase` (showcase.py).
- The existing `DatasetModel`/`VersionModel` in `models/dataset.py` are unused — either build on them or replace them with a corrected schema, but every dataset/version operation must go through the DB, not a Python dict.
- Write Alembic migrations for the new schema. Do not rely on `Base.metadata.create_all` alone once there's a real schema to evolve.
- **Acceptance test:** restart the API process mid-test-run (or simulate it by creating a new app instance against the same DB) and confirm datasets, versions, branches, audit log entries, etc. are still present.

### B2. Wire real object storage
`core/storage.py`'s S3 backend currently raises `NotImplementedError`. Implement it using `boto3` (already a dependency) against the MinIO/S3 config already present in `config.py` and `docker-compose.yml`. Local filesystem stays as a dev-only fallback, explicitly gated by `STORAGE_BACKEND=local`.
- **Acceptance test:** with `STORAGE_BACKEND=s3` and MinIO running via docker-compose, upload/download round-trips through real S3 calls.

### B3. Wire Redis + ARQ for async work
Add `arq` and `redis` to `pyproject.toml`. Move AutoML training, profiling/EDA jobs, and pipeline runs off the request thread into arq tasks, using the Redis broker already provisioned in `docker-compose.yml`. Add a `/status` polling or WebSocket endpoint for job progress instead of blocking the HTTP request.
- **Acceptance test:** submitting an AutoML training job returns immediately with a job ID; a separate endpoint reports progress/completion; killing the API process doesn't kill an in-flight job.

---

## Phase C — Real LLM integration (Groq, Mistral, OpenRouter)

You have API keys for Groq, Mistral, and OpenRouter. Build a real provider layer — the current `ai/analyst.py` is a hardcoded `SELECT col, COUNT(*)` stub with no LLM call at all. Replace it entirely.

### C1. Provider abstraction
Create `strata_api/ai/providers.py` with a single interface, e.g.:
```python
class LLMProvider(Protocol):
    async def complete(self, system: str, user: str, *, json_mode: bool = False) -> str: ...
```
Implement three concrete providers: `GroqProvider`, `MistralProvider`, `OpenRouterProvider`. Add config keys `GROQ_API_KEY`, `MISTRAL_API_KEY`, `OPENROUTER_API_KEY`, `LLM_PROVIDER_ORDER` (e.g. `groq,mistral,openrouter`) to `config.py`, replacing the unused `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/`GEMINI_API_KEY` fields (or keep them for future use, but they're not needed for this integration).
- Default to Groq first (fastest/cheapest for interactive SQL generation), with automatic fallback to Mistral then OpenRouter on error/timeout/rate-limit. Log which provider actually served each request.

### C2. Real conversational analyst
Rewrite `ai/analyst.py`:
- Build the prompt from the existing `ai/prompts.py` templates (they're already correctly zero-PII — schema, semantic types, aggregate stats only, never raw rows).
- Call the provider layer, request JSON-mode output containing `{ "sql": "...", "explanation": "..." }`.
- Execute the generated SQL via the existing `QueryExecutor`.
- **Implement the self-correction loop already described in `ARCHITECTURE.md` but never built:** if execution fails, feed the error message back to the LLM in a follow-up turn asking it to fix the query, retry up to 2 times, then surface a clear failure to the user if it still fails.
- Validate the generated SQL against the same allowlist from A2 before executing it — a hallucinated `ATTACH`/`COPY`/`INSTALL` statement must be rejected the same way a malicious user-submitted one would be.
- **Acceptance test:** ask a real natural-language question against a real dataset and confirm the SQL generated actually answers the question (not just "returns 200") — write at least 5 test cases covering aggregation, filtering, grouping, a nonsense/unanswerable question (should gracefully explain it can't answer, not hallucinate), and a query that fails once and is self-corrected.

### C3. Cost/latency guardrails — build this now, not deferred to billing
Do not wait for Phase D6's full Stripe integration to add this. Ship a working daily cap in this same phase, backed by a simple DB counter (it can be upgraded to feed real billing later, but the cap itself must exist before the LLM analyst ships):
- Add a `llm_usage` table: `(user_id, workspace_id, date, call_count)`, incremented atomically on every real provider call (not on cache hits — see below).
- Default caps, overridable via config/env: **Free = 25 calls/day, Pro = 500/day, Team = pooled per-workspace at 2000/day.** These are placeholder numbers — pick real ones once you know provider costs, but the mechanism must be live with *some* enforced number from day one.
- Check the cap **before** calling any provider, not after — a request over the cap must never reach Groq/Mistral/OpenRouter.
- On exceeding the cap, return 429 with a clear message and a `resets_at` timestamp (midnight UTC or rolling 24h — pick one and document it).
- Surface current usage (`used/limit`) in the existing `/billing/usage` response so the frontend can show it, even before real billing exists.
- Add a timeout per provider call (e.g. 15s) and enforce the retry/fallback chain on timeout, not just on hard errors.
- Cache identical (dataset_version, question) pairs for a short TTL to avoid re-billing for repeated questions — cache hits must not count against the daily cap.
- **Acceptance test:** hitting the cap blocks further calls with 429 before any provider is invoked; usage resets correctly after the window; a cache hit after the cap is reached still succeeds (since it doesn't call a provider).

---

## Phase D — Full data science suite (make the docs true)

### D1. AutoML: add LightGBM, XGBoost, and real SHAP
`routers/automl.py` currently only trains `RandomForestClassifier`/`RandomForestRegressor`. Add `lightgbm` and `xgboost` as dependencies and model choices for `model_family`. Add `shap` as a dependency and replace `.feature_importances_`-only output with real SHAP values (TreeExplainer is fine for tree models) — summary plot data, per-row waterfall data for at least one sample row, and keep the existing confusion matrix/ROC-AUC/leakage-warning logic, but verify the leakage detection is real (checks for near-duplicate train/test rows or target-derived columns) rather than a placeholder.
- **Acceptance test:** train each of the three model families on a real dataset; assert SHAP values are returned and non-trivial (not all zeros).

### D2. Real semantic search
`routers/discovery.py`'s "semantic vector search" is TF-IDF/cosine similarity over n-grams — rename what it currently does to "keyword search" in the API/UI so it's not mislabeled, and separately implement real embedding-based search: use Mistral's embeddings API (you already have that key) to embed dataset descriptions/schemas on ingest, store vectors in `pgvector` (add the extension to the Postgres migration from B1), and query via cosine distance.
- **Acceptance test:** a semantically related but keyword-dissimilar query (e.g. "customer attrition" matching a dataset described as "churn") returns the right dataset via the embedding path but would miss via pure keyword match — write a test proving the difference.

### D3. Real scientific & geospatial parsing
`parsers/scientific.py` and `parsers/geospatial.py` don't use the libraries the architecture doc promises. Add `rdkit` (or `rdkit-pypi`) for real `.sdf`/`.mol` parsing (molecular properties, 2D structure extraction) and `geopandas`/`shapely` for real GeoJSON/shapefile handling (proper CRS support, geometry validation), replacing the current hand-rolled parsing.
- **Acceptance test:** parse a real PubChem `.sdf` sample and a real multi-geometry GeoJSON file; assert correct molecule count / geometry count and correct property extraction.

### D4. Real hypothesis testing
Confirm `scipy` (already a dependency) is actually wired into the "automated hypothesis testing" feature claimed in `TODO.md` Phase 2 (t-test/ANOVA/chi-square) — if it's stubbed or absent, implement it for real in `eda.py`, operating on the actual dataset via DuckDB/Polars, not fabricated p-values.

### D5. Real integrations, or remove the claims
For each integration in `routers/integrations.py`, either make it real or stop claiming it works:
- **Webhooks (Slack/Discord):** actually POST to the configured `webhook_url` using `httpx` (already a dependency), and surface real delivery success/failure, not a hardcoded `"status": "delivered"`.
- **MLflow sync:** actually connect to the given `mlflow_tracking_uri` using the `mlflow` client library and log real params/tags — don't just echo the request back as a fake success.
- **W&B sync:** actually call the W&B API with a real API key/config, or remove this endpoint until it's real.
- Update `/integrations/status` to reflect real connection state (tested/reachable) rather than a hardcoded list of `"active"`/`"ready"` labels.
- **Acceptance test:** a webhook test against a real (test) Slack incoming-webhook URL actually delivers a message; a bad URL returns a real failure, not a fake success.

### D6. Real billing
`routers/billing.py` has hardcoded usage numbers and no payment processor. Integrate Stripe (or note explicitly this is deferred and gate Pro/Team features behind a manual/admin flag instead of pretending they're purchasable): real subscription creation, webhook handling for plan changes, and usage numbers computed from actual DB records (dataset count/size from B1, AI query count from C3's tracking) instead of constants like `"ai_queries_used": 142`.

### D7. Audit log integrity
`routers/security.py`'s hash-chained audit log is a good idea but currently in-memory and only actually logs one seeded event — nothing calls `_log_audit_event()` from the real action handlers. After B1 migrates it to Postgres, wire `_log_audit_event()` (or its DB-backed replacement) into every state-changing endpoint across the app (dataset create/delete, permission change, version rollback, login, etc.), not just as a standalone router.

---

## Phase E — Reconcile docs with reality

- Re-audit every `[x]` in `TODO.md` against what's actually implemented after this file is done. Anything still mocked stays unchecked with a one-line note on what's missing.
- Update `ARCHITECTURE.md` if any real implementation choices diverge from what's written (e.g. if you end up using a different embedding provider than originally sketched).
- Update `SECURITY.md` to move items from "*(Phase 3+)*"/aspirational language to "implemented" once Phase A/B land, with a one-line pointer to where each control lives in code.

---

## Definition of done for this whole file

- `pytest` passes in `backend/` with no skipped/xfail tests introduced to dodge the acceptance criteria above.
- A fresh `git clone` + `docker-compose up` + backend boot, with real `.env` keys filled in (Groq/Mistral/OpenRouter, Postgres, Redis, MinIO), works end-to-end: register → upload a dataset → ask the AI analyst a real question → get a real LLM-generated, self-corrected, executed answer → train a real AutoML model with SHAP output → see it all survive a server restart.
- Nothing in the API response bodies contains fabricated/placeholder data presented as if it were real (no more `"status": "delivered"` that didn't deliver anything, no more hardcoded usage counters).