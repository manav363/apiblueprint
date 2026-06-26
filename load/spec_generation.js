// k6 load test for the OpenAPI spec-generation endpoint.
//
// Run against a running stack:
//   k6 run load/spec_generation.js
//
// Override defaults via env vars:
//   BASE_URL   (default http://localhost:8000)
//   ADMIN_USER (default admin)
//   ADMIN_PASS (default admin)
//
// Thresholds mirror the SLOs in docs/slo.md: p95 < 200ms, <1% errors.

import http from "k6/http";
import { check, fail } from "k6";
import { Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";
const ADMIN_USER = __ENV.ADMIN_USER || "admin";
const ADMIN_PASS = __ENV.ADMIN_PASS || "admin";

const specErrors = new Rate("spec_errors");

export const options = {
  scenarios: {
    spec_generation: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 20 }, // ramp up
        { duration: "1m", target: 20 }, // steady load
        { duration: "15s", target: 0 }, // ramp down
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<200"], // SLO: p95 < 200ms
    spec_errors: ["rate<0.01"], // SLO: < 1% errors
  },
};

// setup() runs once: authenticate and ensure a project with content exists.
export function setup() {
  const login = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
    { headers: { "Content-Type": "application/json" } }
  );
  if (login.status !== 200) {
    fail(`login failed: ${login.status} ${login.body}`);
  }
  const token = login.json("access_token");
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Reuse the first existing project if present; otherwise create one.
  const existing = http.get(`${BASE_URL}/api/v1/projects`, { headers: authHeaders });
  let projectId;
  if (existing.status === 200 && existing.json().length > 0) {
    projectId = existing.json()[0].id;
  } else {
    const created = http.post(
      `${BASE_URL}/api/v1/projects`,
      JSON.stringify({ name: "LoadTest API", version: "1.0.0", description: "k6" }),
      { headers: authHeaders }
    );
    if (created.status !== 201) {
      fail(`project create failed: ${created.status} ${created.body}`);
    }
    projectId = created.json("id");
    http.post(
      `${BASE_URL}/api/v1/projects/${projectId}/endpoints`,
      JSON.stringify({ method: "GET", path: "/items/{id}", summary: "Get item" }),
      { headers: authHeaders }
    );
  }

  return { token, projectId };
}

export default function (data) {
  const res = http.get(`${BASE_URL}/api/v1/projects/${data.projectId}/spec`, {
    headers: { Authorization: `Bearer ${data.token}` },
  });

  const ok = check(res, {
    "status is 200": (r) => r.status === 200,
    "body is non-empty": (r) => r.body && r.body.length > 0,
  });
  specErrors.add(!ok);
}
