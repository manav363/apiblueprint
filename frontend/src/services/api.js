const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const MOCK = import.meta.env.VITE_MOCK_URL || "http://localhost:4010";

export const API_BASE_URL = BASE;
export const MOCK_BASE_URL = MOCK;

function formatValidationLocation(loc = []) {
  if (!Array.isArray(loc) || loc.length === 0) return "";
  return loc.join(" -> ");
}

function formatErrorPayload(payload, fallbackStatus) {
  if (!payload) {
    return `HTTP ${fallbackStatus}`;
  }

  if (typeof payload.detail === "string") {
    return payload.detail;
  }

  if (Array.isArray(payload.detail)) {
    return payload.detail.map(item => {
      const prefix = formatValidationLocation(item.loc);
      return prefix ? `${prefix}: ${item.msg}` : item.msg;
    }).join("\n");
  }

  if (typeof payload.error === "string") {
    return payload.error;
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  return `HTTP ${fallbackStatus}`;
}

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(formatErrorPayload(err, res.status));
  }
  return res.json();
}

async function mockReq(path, options = {}) {
  const res = await fetch(`${MOCK}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(formatErrorPayload(err, res.status));
  }
  return res.json();
}

async function textReq(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(formatErrorPayload(err, res.status));
  }
  return res.text();
}

function buildProjectQuery(projectId) {
  return projectId ? `?projectId=${projectId}` : "";
}

export const api = {
  listProjects: () => req("GET", "/api/projects"),
  getProject: (id) => req("GET", `/api/projects/${id}`),
  createProject: (data) => req("POST", "/api/projects", data),
  updateProject: (id, data) => req("PUT", `/api/projects/${id}`, data),
  deleteProject: (id) => req("DELETE", `/api/projects/${id}`),

  listEndpoints: (projectId) => req("GET", `/api/projects/${projectId}/endpoints`),
  createEndpoint: (projectId, data) => req("POST", `/api/projects/${projectId}/endpoints`, data),
  updateEndpoint: (id, data) => req("PUT", `/api/endpoints/${id}`, data),
  deleteEndpoint: (id) => req("DELETE", `/api/endpoints/${id}`),

  createParameter: (endpointId, data) => req("POST", `/api/endpoints/${endpointId}/parameters`, data),
  updateParameter: (id, data) => req("PUT", `/api/parameters/${id}`, data),
  deleteParameter: (id) => req("DELETE", `/api/parameters/${id}`),

  createResponse: (endpointId, data) => req("POST", `/api/endpoints/${endpointId}/responses`, data),
  updateResponse: (id, data) => req("PUT", `/api/responses/${id}`, data),
  deleteResponse: (id) => req("DELETE", `/api/responses/${id}`),

  listSchemas: (projectId) => req("GET", `/api/projects/${projectId}/schemas`),
  createSchema: (projectId, data) => req("POST", `/api/projects/${projectId}/schemas`, data),
  deleteSchema: (id) => req("DELETE", `/api/schemas/${id}`),
  createField: (schemaId, data) => req("POST", `/api/schemas/${schemaId}/fields`, data),
  deleteField: (id) => req("DELETE", `/api/fields/${id}`),

  getSpecYaml: (projectId) => textReq(`/api/projects/${projectId}/spec`),
  getSpecJson: (projectId) => req("GET", `/api/projects/${projectId}/spec.json`),

  getMockLogs: (projectId) => mockReq(`/mock-logs${buildProjectQuery(projectId)}`),
  getMockStats: (projectId) => mockReq(`/mock-stats${buildProjectQuery(projectId)}`),
  reloadMock: (projectId) => mockReq(`/mock/reload/${projectId}`, { method: "POST" }),
};
