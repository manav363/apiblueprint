# Ship readiness

Checklist and procedures for getting a clean clone to a trustworthy, mergeable
state.

## Cold-clone test

Verifies that a brand-new clone builds and runs with a single command — no hidden
local state. Builds all four services, waits for health, exercises auth, and
tears down. Uses a throwaway env and an isolated high port range so it never
collides with a running dev stack, Postgres, or Redis.

```bash
make smoke            # or: bash scripts/smoke-test.sh
KEEP=1 make smoke     # leave the stack up afterwards for poking around
```

Expected tail:

```
[smoke]   /health/ready -> {"status":"ok","db":"reachable"}
[smoke]   login -> token acquired
[smoke]   GET /api/v1/projects -> 200
[smoke] PASS — full stack is healthy.
```

## Branch protection on `main`

CI (`.github/workflows/ci.yml`) must pass before anything merges to `main`. This
is a GitHub setting, so it's applied once per repo by someone with admin rights.

Automated (needs the `gh` CLI authenticated with admin):

```bash
scripts/setup-branch-protection.sh
```

This requires the following status checks (the CI job names) and an up-to-date
branch before merge:

- Backend Lint, Backend Tests, Backend Contract Tests, Backend Dependency Audit
- Frontend Lint, Frontend Tests, Frontend Build, Frontend Dependency Audit
- Mock Server Tests, Mock Server Dependency Audit

Manual (GitHub UI): **Settings → Branches → Add branch ruleset / protection rule**
for `main` → require status checks to pass, require branches to be up to date,
and select the checks above.

## Release & CDN purge

Tagging a release runs `.github/workflows/deploy.yml`, which purges the CDN cache
for the revalidatable spec URLs (no-op until `CDN_*` secrets are set). See the
CDN section in [../DEPLOYMENT.md](../DEPLOYMENT.md) and [performance.md](performance.md).
