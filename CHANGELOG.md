# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims
to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Real-time collaboration: a WebSocket (`/collab`) on the mock service with
  per-project rooms — live presence in the editor and auto-refresh when a
  collaborator saves. Frontend `useCollaboration` hook + presence indicator.
- Playwright end-to-end test of the full flow (sign in → create project →
  validate spec), run against the live docker-compose stack via `scripts/e2e.sh`
  and a CI `e2e` job.
- CDN-ready spec delivery: `ETag` + `Cache-Control` with `If-None-Match`/`304`
  on the spec endpoints, and an immutable content-addressed URL
  `GET /projects/{id}/spec/{hash}.json` (`max-age=31536000, immutable`). Plus a
  release-triggered `deploy` workflow and `scripts/cdn-purge.sh` (no-op until CDN
  secrets are set).
- Cold-clone smoke test (`make smoke` / `scripts/smoke-test.sh`) that builds the
  whole stack, waits for health, and verifies auth end to end on isolated ports.
- `scripts/setup-branch-protection.sh` to require all CI checks on `main`.
- Redis-backed rate limiting (`REDIS_URL`) and a content-addressed OpenAPI spec
  cache (`spec:{project_id}:{content_hash}`), both with in-process fallback so the
  app runs without Redis. Added a `redis` service to docker-compose.
- Database indexes on all foreign keys and `projects.created_at`
  (migration `20260625_000002`); `list_projects` now uses a single grouped count
  instead of N+1.
- `summary`/`description`/`responses` on every FastAPI route (shared error-envelope
  model), 3 operational runbooks (`docs/runbooks/`), and `docs/performance.md`.
- Prettier config + `format`/`format:check` scripts; ESLint and Prettier
  pre-commit hooks; CI enforces formatting. `.vscode/settings.json`.
- Standalone OpenAPI validator endpoint `POST /api/validate` (JSON or YAML body),
  returning `{ valid, errors: [{ path, message }] }`.
- "Validate" action in the spec export view, with an inline validation panel.
- Backend test suite migrated to pytest with an isolated test-DB fixture, plus
  validator, snapshot, and integration tests (89%+ coverage, 80% CI gate).
- Schemathesis contract tests asserting no endpoint returns a 5xx on fuzzed input.
- Frontend Vitest/RTL tests for the validation panel, API client, and endpoint utils.
- CI: frontend test job, `pip-audit`, `npm audit` (production deps), and a
  Schemathesis contract job.
- Dependabot configuration for pip, npm (frontend + mock), and GitHub Actions.
- k6 load test for the spec-generation endpoint (`load/spec_generation.js`).
- Architecture docs: `docs/architecture.md` (Mermaid) and
  `docs/decisions/ADR-001-dual-backend.md`.

### Fixed
- Login with non-ASCII credentials returned `500` (from `secrets.compare_digest`
  on non-ASCII strings); it now returns a clean `401`.
- Spec generation and endpoint listing eager-load related rows, eliminating N+1
  query patterns.
- Lifespan no longer crashes when the SIGTERM handler can't be installed off the
  main thread (test/embedded contexts).

## [1.0.0] — 2026-06-20

### Added
- Phase 1–3: foundations, API hardening, and observability — versioned `/api/v1`
  routes, trace IDs, security headers, GZip, response-time headers, idempotency
  keys, Prometheus `/metrics`, optional Sentry (backend + frontend), and SLOs.
