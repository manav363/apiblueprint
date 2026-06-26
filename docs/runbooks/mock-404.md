# Runbook: mock server returns 404

## Symptom
"Try it" requests to `http://localhost:4010/mock/{projectId}/...` return `404`,
or the Monitoring view shows no mock traffic / stale routes.

## Diagnose
```bash
docker compose logs --tail=80 mock
curl -s localhost:4010/health           # mock server up?
curl -s localhost:8000/api/v1/projects/<id>/spec.json -H "Authorization: Bearer <token>"
```
Common causes:

- **Spec never loaded / out of date.** The mock builds its routes from a project's
  generated spec. If the project was edited after the mock loaded, the new path
  isn't registered yet.
- **Wrong project id or path.** The mock only knows paths present in that project's
  spec; a typo or an unsaved endpoint returns 404.
- **Backend unreachable from the mock.** The mock fetches specs from
  `BACKEND_URL` (default `http://backend:8000`); if the backend is down the mock
  has nothing to serve.

## Fix
- Reload the project's routes: use **Reload Mock Routes** in the Export view, or
  `POST {MOCK_URL}/mock/reload/{projectId}` (the frontend's `api.reloadMock`).
- Confirm the path exists in the generated spec (the `spec.json` call above).
- If the backend is down, recover it first ([backend-restart-loop.md](backend-restart-loop.md)),
  then reload the mock.

## Verify
```bash
curl -s -o /dev/null -w "%{http_code}\n" localhost:4010/mock/<id>/<path>   # expect 200
```

## Prevent
- Reload mock routes after bulk edits (the export flow nudges this).
- Keep `BACKEND_URL` correct for the mock service in compose/.env.
- Mock server tests run in CI (`mock-test` job).
