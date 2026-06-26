# Performance notes

How the hot read paths are kept fast, and how to re-check them against a real
PostgreSQL instance.

## Caching

- **Rate limiting** uses Redis (`REDIS_URL`) so limits hold across multiple
  backend processes/replicas. Without `REDIS_URL` it falls back to an in-process
  store — fine for a single instance.
- **Generated OpenAPI spec** is cached under a content-addressed key,
  `spec:{project_id}:{content_hash}`, where `content_hash` is a digest of the
  project's full graph (endpoints, parameters, responses, schemas, fields). Any
  edit changes the hash, which is how the cache is invalidated on mutation. Entries
  expire after `SPEC_CACHE_TTL_SECONDS` (default 300s). Backed by Redis when
  configured, otherwise an in-process dict.

## Query optimizations

- **`list_projects`** previously issued one `COUNT(*)` per project (N+1). It now
  runs a single grouped count (`GROUP BY project_id`) and maps the results.
- **`list_endpoints`** and **spec generation** eager-load related rows
  (`selectinload` on parameters/responses/fields) instead of lazy-loading per row.

## Indexes

Added in migration `20260625_000002_performance_indexes` (and reflected in the
models) on the columns these queries filter, join, or order by:

| Table | Column | Used by |
| --- | --- | --- |
| `projects` | `created_at` | `list_projects` ORDER BY created_at DESC |
| `endpoints` | `project_id` | `list_endpoints`, endpoint count, spec walk |
| `parameters` | `endpoint_id` | spec walk / endpoint detail |
| `responses` | `endpoint_id` | spec walk / endpoint detail |
| `schemas` | `project_id` | `list_schemas`, spec walk |
| `schema_fields` | `schema_id` | spec walk |
| `schema_fields` | `parent_id` | nested-field resolution |

## Verifying with EXPLAIN ANALYZE

Run against a populated PostgreSQL (the SQLite test DB won't reflect Postgres
planning). After `docker compose up -d`:

```bash
docker compose exec db psql -U apiblueprint -d apiblueprint
```

```sql
-- list_projects ordering
EXPLAIN ANALYZE
SELECT * FROM projects ORDER BY created_at DESC LIMIT 100;
-- expect: Index Scan Backward using ix_projects_created_at

-- endpoint count per project (the grouped count)
EXPLAIN ANALYZE
SELECT project_id, count(id) FROM endpoints
WHERE project_id = ANY (ARRAY[1,2,3]) GROUP BY project_id;
-- expect: index usage on ix_endpoints_project_id

-- list_endpoints for one project
EXPLAIN ANALYZE
SELECT * FROM endpoints WHERE project_id = 1 OFFSET 0 LIMIT 500;
-- expect: Index Scan using ix_endpoints_project_id (not Seq Scan)
```

On small datasets PostgreSQL may still pick a sequential scan because it's cheaper
— the indexes matter once tables grow. Re-run after seeding realistic data with
`make seed` (or the load test in `load/spec_generation.js`).

## Load testing

`load/spec_generation.js` (k6) ramps to 20 VUs against the spec-generation
endpoint with thresholds matching the SLOs (p95 < 200ms, <1% errors). See
[slo.md](slo.md).
