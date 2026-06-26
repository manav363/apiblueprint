# ADR-001: Dual-backend architecture (FastAPI + Express mock server)

- **Status:** Accepted
- **Date:** 2026-06-25

## Context

APIBlueprint lets users design REST APIs visually, then generate an OpenAPI
spec and exercise it. Two distinct responsibilities fall out of that:

1. **Authoritative application logic** — persisting projects, endpoints, schemas;
   generating and validating OpenAPI specs; authentication. This is
   request/response, database-backed, and benefits from Python's mature OpenAPI
   and data-validation ecosystem (Pydantic, `openapi-spec-validator`, PyYAML).
2. **A live mock of the user's designed API** — given a generated spec, serve
   example responses so the user can "try" their API before implementing it.
   This is dynamic per-project routing with low-latency, schema-aware responses.

These have different shapes. Folding the mock into the main backend would couple
the user's *designed* surface (arbitrary, per-project, hot-reloaded) to our
*product's* surface (fixed, versioned, authenticated), and would mean the main
service restarts/route-table churns as users edit their designs.

## Decision

Run two backend services:

- **FastAPI (Python)** — the system of record. CRUD for projects/endpoints/
  schemas, spec generation (`/spec`, `/spec.json`), the standalone validator
  (`/api/validate`), auth, and all observability (structured logs, Prometheus
  `/metrics`, Sentry). Backed by PostgreSQL.
- **Express (Node.js) mock server** — consumes a project's generated spec and
  serves schema-aware mock responses under `/mock/{projectId}`, hot-reloadable
  per project without touching the main backend. Also exposes mock request
  logs/stats consumed by the Monitoring view.

The React frontend talks to FastAPI for design/data and to the mock server for
"try it" traffic. Everything is wired together with Docker Compose.

## Consequences

**Positive**
- Clear separation: editing a design never destabilizes the product API.
- Each service uses the ecosystem best suited to its job (Python for spec
  tooling, Node for fast dynamic routing).
- Demonstrates a real multi-service architecture rather than a monolith.

**Negative / trade-offs**
- More moving parts to run, observe, and deploy (mitigated by Docker Compose and
  per-service health checks).
- Two languages/toolchains to maintain.
- Spec must be shared from FastAPI to the mock server (today via the generated
  spec + a reload call), an integration seam to keep an eye on.

## Alternatives considered

- **Single FastAPI service hosting the mock too.** Rejected: dynamic per-project
  route registration and hot reload would fight the product's fixed, versioned,
  authenticated routing, and a design edit could disrupt the product API.
- **Serverless mock per project.** Overkill for the current scope; revisit if
  mock traffic or isolation requirements grow.
