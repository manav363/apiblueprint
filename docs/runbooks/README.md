# Runbooks

Operational playbooks for the most likely failure modes. Each follows the same
shape: **symptom → diagnose → fix → prevent**.

- [Backend restart loop](backend-restart-loop.md)
- [Mock server returns 404](mock-404.md)
- [Database migration failure](db-migration-failure.md)

General first steps for any incident:

```bash
docker compose ps                 # which services are unhealthy?
docker compose logs --tail=100 backend
curl -s localhost:8000/health/ready   # {"status":"ok","db":"reachable"} when healthy
```

Reliability targets and the error budget are in [../slo.md](../slo.md).
