# Security

This document covers the security model as it's meant to exist by the time the product has real users and real data in it. Not everything here is implemented from day one — items are tagged by the phase they belong to (see `TODO.md`).

## Data classification

Strata stores other people's data, some of it potentially sensitive (PII inside uploaded datasets). Two categories to treat differently from day one:
1. **Strata's own data:** accounts, billing, workspace metadata.
2. **User-uploaded dataset content:** the actual rows, which may contain PII the user didn't intend to expose (this is exactly what the PII-detection feature exists to catch — see Pillar 4.9 in the blueprint).

Never assume uploaded data is "safe by default." The product's own AI quality layer flags PII on ingest specifically because users routinely don't realize what's in their own files.

## Authentication & access control *(Phase 1+)*

- Email/password or magic-link auth for individuals (Phase 1); SSO (Google, GitHub, later SAML/Okta) for teams (Phase 3, Pillar 16.2)
- Role model: Owner / Admin / Editor / Viewer per workspace, with per-dataset permission overrides (Pillar 9.2–9.3)
- Version-level access control — a dataset can have some versions public and others private (Pillar 2.14)
- All API access authenticated the same way whether it comes from the web UI, CLI, or SDK — no separate weaker auth path for programmatic access

## Encryption *(Phase 3, Pillar 16.1)*

- Encryption at rest for both object storage and the database (AES-256)
- TLS 1.3 for all traffic, no exceptions, including internal service-to-service calls once the AI layer is split out (see `ARCHITECTURE.md` V3)

## PII handling & AI privacy boundaries

- Automatic PII detection on every upload (emails, phone numbers, national ID patterns, addresses) — surfaced to the uploader before anything is shared, not silently logged
- PII-flagged columns get a visible warning in the UI and API response; sharing a dataset with flagged PII to a Viewer role should require explicit acknowledgment
- Redaction/masking on export for restricted roles (Pillar 16.4) — a Viewer should be able to work with a dataset without necessarily seeing raw PII columns
- **Strict Zero-PII Context to LLMs:** No raw row data or PII values are ever transmitted to third-party LLM providers. Only column headers, inferred semantic types, and anonymized aggregate statistics (counts, null ratios, distribution quartiles) are included in the prompt context.

## Code Execution & Sandbox Security *(Phase 1+)*

With the in-app Conversational Data Analyst and AutoML runners executing dynamic Python and DuckDB code:
- **Network Isolation:** Code execution sandboxes run in air-gapped, isolated containers with no outbound internet access to prevent data exfiltration.
- **Resource Limits & Timeouts:** Strict CPU quotas, memory ceilings (e.g. 2GB max per execution), and hard runtime timeouts (e.g. 30 seconds for queries, 120 seconds for AutoML baseline runs) enforced via Linux cgroups.
- **Ephemeral Filesystems:** Execution environments mount datasets as read-only volumes. Scratch storage is completely wiped after execution completes.
- **Client-Side DuckDB-Wasm Security:** For files < 150MB, queries execute entirely in the user's browser sandbox via WebAssembly — no user data touches a remote worker.

## Audit & compliance *(Phase 3+)*

- Audit log: every access, download, query execution, and permission change (Pillar 16.3)
- Data deletion requests handled explicitly (GDPR-style) — deletion must cascade correctly through versions and lineage records, not just the "current" version
- IP allowlisting per workspace (enterprise, Phase 4)
- SOC 2 Type II readiness is a Phase 4+ consideration — not worth pursuing before there's revenue and enterprise customers asking for it, but the audit-log and encryption groundwork above should make it achievable without a rearchitecture later

## Vulnerability disclosure

*(To be finalized before any public launch — needs a real contact channel and disclosure policy, e.g. `security@` address and a stated response-time commitment.)*

## Rate limiting & abuse prevention

- Per-plan-tier rate limiting on the API (Pillar 17.3)
- Upload size limits enforced per plan, checked before storage write begins, not after
- Background job queue monitored for abuse patterns (e.g. someone hammering the profiling endpoint or running malicious compute loops)

## What's explicitly out of scope for now

- On-premise/VPC deployment (Pillar 20.4) — enterprise-only, far future
- Formal third-party security audit — revisit once there's a customer base large enough to justify the cost