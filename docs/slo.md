# Service Level Objectives (SLOs)

These are the reliability targets for the APIBlueprint backend. They are
intentionally modest and achievable for a single-region, single-instance
deployment, and they give the observability stack (structured logs, Prometheus
metrics, Sentry, and external uptime checks) a concrete goal to measure against.

## Objectives

| SLI | Target (SLO) | Measurement window |
| --- | --- | --- |
| **Availability** | ≥ 99.5% of requests to `/health/ready` succeed | 30 days rolling |
| **Latency** | p95 of API request duration < 200ms | 30 days rolling |
| **Error rate** | < 1% of requests return 5xx | 30 days rolling |

99.5% availability allows for roughly **3h 39m** of downtime per 30 days — the
remaining time is the **error budget**. If an incident burns a large share of
the budget, reliability work takes priority over new features until it recovers.

## How each SLI is measured

- **Availability** — external uptime monitor (below) polling `/health/ready`,
  cross-checked against the `up`/scrape success in Prometheus.
- **Latency** — Prometheus histogram `http_request_duration_seconds` exposed at
  `/metrics`. Compute p95 with:

  ```promql
  histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
  ```

- **Error rate** — ratio of 5xx responses to total:

  ```promql
  sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))
  ```

  Every 5xx is also captured in Sentry (when `SENTRY_DSN` is configured) with the
  request's `trace_id`, so an alert links straight to the failing request.

## External uptime monitoring (UptimeRobot)

Liveness from inside the cluster isn't enough — we also want an off-box check
that fails if the whole host is down. UptimeRobot (free tier) covers this:

1. Create an account at <https://uptimerobot.com>.
2. **Add New Monitor** → type **HTTP(s)**.
3. **URL**: `https://<your-public-host>/health/ready`
4. **Monitoring interval**: 5 minutes (free-tier minimum).
5. Expect HTTP `200` with body `{"status":"ok","db":"reachable"}`. A `503`
   means the DB is unreachable and should page.
6. Add an alert contact (email / Slack webhook) and attach it to the monitor.
7. Optionally enable a **public status page** for the project URL.

`/health/ready` is the right target because it also verifies database
connectivity, so a degraded DB trips the monitor even while the process is alive.

## Review

Revisit these targets after the first month of real traffic and tighten them
(e.g. p95 < 150ms) once there's a baseline to justify it.
