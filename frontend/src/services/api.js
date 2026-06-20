const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const MOCK = import.meta.env.VITE_MOCK_URL || "http://localhost:4010";
const V1 = "/api/v1";
const AUTH_STORAGE_KEY = "apiblueprint.auth.token";
const AUTH_USER_STORAGE_KEY = "apiblueprint.auth.user";

export const API_BASE_URL = BASE;
export const MOCK_BASE_URL = MOCK;

function readStoredToken() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(AUTH_STORAGE_KEY);
}

function authHeaders(extraHeaders = {}) {
  const token = readStoredToken();
  if (!token) return extraHeaders;
  return { ...extraHeaders, Authorization: `Bearer ${token}` };
}

export function persistAuth(token, username) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(AUTH_STORAGE_KEY, token);
  window.sessionStorage.setItem(AUTH_USER_STORAGE_KEY, username);
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
  window.sessionStorage.removeItem(AUTH_USER_STORAGE_KEY);
}

export function hasStoredAuth() {
  return Boolean(readStoredToken());
}

export function getStoredUsername() {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(AUTH_USER_STORAGE_KEY) || "";
}

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function mockReq(path, options = {}) {
  const res = await fetch(`${MOCK}${path}`, {
    ...options,
    headers: authHeaders(options.headers || {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function serviceHealth(baseUrl) {
  const res = await fetch(`${baseUrl}/health`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

async function testMockEndpoint(path, options = {}) {
  const startedAt = performance.now();
  const res = await fetch(`${MOCK}${path}`, {
    method: options.method || "GET",
    headers: authHeaders(options.headers || {}),
    body: options.body,
  });
  const durationMs = Math.round(performance.now() - startedAt);
  const bodyText = await res.text();
  const parsedBody = (() => {
    try {
      return bodyText ? JSON.parse(bodyText) : null;
    } catch {
      return bodyText;
    }
  })();

  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    durationMs,
    headers: Object.fromEntries(res.headers.entries()),
    body: parsedBody,
    bodyText,
  };
}

export const api = {
  getBackendHealth: () => serviceHealth(BASE),
  getMockHealth: () => serviceHealth(MOCK),
  login: async (username, password) => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  },
  getSession: () => req("GET", "/api/session"),
  listProjects: () => req("GET", `${V1}/projects`),
  getProject: (id) => req("GET", `${V1}/projects/${id}`),
  createProject: (data) => req("POST", `${V1}/projects`, data),
  updateProject: (id, data) => req("PUT", `${V1}/projects/${id}`, data),
  deleteProject: (id) => req("DELETE", `${V1}/projects/${id}`),

  listEndpoints: (projectId) => req("GET", `${V1}/projects/${projectId}/endpoints`),
  createEndpoint: (projectId, data) => req("POST", `${V1}/projects/${projectId}/endpoints`, data),
  updateEndpoint: (id, data) => req("PUT", `${V1}/endpoints/${id}`, data),
  deleteEndpoint: (id) => req("DELETE", `${V1}/endpoints/${id}`),

  createParameter: (endpointId, data) => req("POST", `${V1}/endpoints/${endpointId}/parameters`, data),
  updateParameter: (id, data) => req("PUT", `${V1}/parameters/${id}`, data),
  deleteParameter: (id) => req("DELETE", `${V1}/parameters/${id}`),

  createResponse: (endpointId, data) => req("POST", `${V1}/endpoints/${endpointId}/responses`, data),
  updateResponse: (id, data) => req("PUT", `${V1}/responses/${id}`, data),
  deleteResponse: (id) => req("DELETE", `${V1}/responses/${id}`),

  listSchemas: (projectId) => req("GET", `${V1}/projects/${projectId}/schemas`),
  createSchema: (projectId, data) => req("POST", `${V1}/projects/${projectId}/schemas`, data),
  deleteSchema: (id) => req("DELETE", `${V1}/schemas/${id}`),
  createField: (schemaId, data) => req("POST", `${V1}/schemas/${schemaId}/fields`, data),
  deleteField: (id) => req("DELETE", `${V1}/fields/${id}`),

  getSpecYaml: async (projectId) => {
    const response = await fetch(`${BASE}${V1}/projects/${projectId}/spec`, {
      headers: authHeaders(),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || err.detail || `HTTP ${response.status}`);
    }
    return response.text();
  },
  getSpecJson: (projectId) => req("GET", `${V1}/projects/${projectId}/spec.json`),

  getMockLogs: () => mockReq("/mock-logs"),
  getMockStats: () => mockReq("/mock-stats"),
  testMockEndpoint,
  reloadMock: (projectId) => mockReq(`/mock/reload/${projectId}`, {
    method: "POST",
    headers: authHeaders(),
  }),
};
