const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const BACKEND_URL = process.env.BACKEND_URL || "http://backend:8000";
const PORT = process.env.PORT || 4010;

const registeredProjects = new Set();
const projectSpecs = new Map();
const projectReloads = new Map();
const serverStartedAt = Date.now();
let requestLog = [];

function resolveSchema(schema, spec) {
  if (!schema) return null;
  if (schema.$ref) {
    const refName = schema.$ref.split("/").pop();
    return spec?.components?.schemas?.[refName] || null;
  }
  return schema;
}

function generateExample(schema, spec) {
  const resolved = resolveSchema(schema, spec);
  if (!resolved) return {};

  const type = resolved.type;
  const format = resolved.format;

  if (format === "uuid") return "550e8400-e29b-41d4-a716-446655440000";
  if (format === "date-time") return new Date().toISOString();
  if (format === "uri") return "https://example.com/image.png";
  if (type === "integer" || type === "number") return 42;
  if (type === "boolean") return true;
  if (type === "array") {
    return [generateExample(resolved.items || { type: "string" }, spec)];
  }
  if (type === "object") {
    return buildExampleFromProperties(resolved.properties || {}, resolved.required || [], spec);
  }
  return "example_string";
}

function buildExampleFromProperties(properties = {}, required = [], spec) {
  const obj = {};
  for (const [key, schema] of Object.entries(properties)) {
    obj[key] = generateExample(schema, spec);
  }
  return obj;
}

function getStatusExample(statusCode, operation, spec) {
  const code = String(statusCode);
  const resp = operation.responses?.[code];

  if (resp?.content?.["application/json"]?.example) {
    return resp.content["application/json"].example;
  }

  const responseSchema = resp?.content?.["application/json"]?.schema;
  if (responseSchema) {
    return generateExample(responseSchema, spec);
  }

  if (code.startsWith("2")) {
    return { success: true, message: "Operation successful", data: {} };
  }
  if (code === "400") return { error: "Bad Request", message: "Invalid input parameters" };
  if (code === "401") return { error: "Unauthorized", message: "Bearer token required" };
  if (code === "403") return { error: "Forbidden", message: "Insufficient permissions" };
  if (code === "404") return { error: "Not Found", message: "Resource not found" };
  if (code === "500") return { error: "Internal Server Error", message: "Something went wrong" };
  return { message: "Response" };
}

function normalizeMockPath(pathname) {
  if (!pathname || pathname === "/") return "/";
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

function pathToRegExp(path) {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\\\{[^/]+?\\\}/g, "[^/]+")}$`);
}

function findOperation(spec, method, requestPath) {
  for (const [path, methods] of Object.entries(spec.paths || {})) {
    if (!methods[method]) continue;
    if (pathToRegExp(path).test(requestPath)) {
      return { operation: methods[method], path };
    }
  }
  return null;
}

function parseProjectId(value) {
  const projectId = parseInt(value, 10);
  return Number.isNaN(projectId) ? null : projectId;
}

function getProjectLogs(projectId = null) {
  if (!projectId) return requestLog;
  return requestLog.filter(entry => entry.project_id === projectId);
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function buildStats(projectId = null) {
  const logs = getProjectLogs(projectId);
  const total = logs.length;
  const errorCount = logs.filter(entry => entry.status >= 400).length;
  const avgLatency = total
    ? Math.round(logs.reduce((sum, entry) => sum + parseInt(entry.latency, 10), 0) / total)
    : 0;
  const methodCounts = {};
  const statusBuckets = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };
  const routeCounts = {};

  logs.forEach(entry => {
    methodCounts[entry.method] = (methodCounts[entry.method] || 0) + 1;

    const bucket = `${Math.floor(entry.status / 100)}xx`;
    if (statusBuckets[bucket] !== undefined) {
      statusBuckets[bucket] += 1;
    }

    const routeKey = `${entry.method} ${entry.route_template || entry.path}`;
    routeCounts[routeKey] = (routeCounts[routeKey] || 0) + 1;
  });

  const topRoutes = Object.entries(routeCounts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([route, count]) => ({ route, count }));

  const latestReload = projectId
    ? projectReloads.get(projectId) || null
    : Array.from(projectReloads.values()).sort().at(-1) || null;

  return {
    project_id: projectId,
    total_requests: total,
    error_count: errorCount,
    error_rate: total ? `${((errorCount / total) * 100).toFixed(1)}%` : "0%",
    avg_latency: `${avgLatency}ms`,
    uptime: formatDuration(Date.now() - serverStartedAt),
    last_request_at: logs[0]?.timestamp || null,
    last_reload_at: latestReload,
    methods: methodCounts,
    status_buckets: statusBuckets,
    top_routes: topRoutes,
    registered_projects: Array.from(registeredProjects),
    path_groups: projectId ? Object.keys(projectSpecs.get(projectId)?.paths || {}).length : null,
  };
}

async function loadProjectSpec(projectId) {
  try {
    const res = await axios.get(`${BACKEND_URL}/api/projects/${projectId}/spec.json`);
    const spec = res.data;
    projectSpecs.set(projectId, spec);
    registeredProjects.add(projectId);
    projectReloads.set(projectId, new Date().toISOString());

    console.log(`[Mock] Loading spec for project ${projectId}: ${spec.info?.title}`);
    console.log(`[Mock] Registered ${Object.keys(spec.paths || {}).length} path groups for project ${projectId}`);
    return spec;
  } catch (err) {
    console.error(`[Mock] Failed to load spec for project ${projectId}:`, err.message);
    return null;
  }
}

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "apiblueprint-mock", port: PORT });
});

app.get("/mock-logs", (req, res) => {
  const projectId = parseProjectId(req.query.projectId);
  res.json(getProjectLogs(projectId));
});

app.get("/mock-stats", (req, res) => {
  const projectId = parseProjectId(req.query.projectId);
  res.json(buildStats(projectId));
});

app.post("/mock/reload/:projectId", async (req, res) => {
  const projectId = parseInt(req.params.projectId, 10);
  registeredProjects.delete(projectId);
  projectSpecs.delete(projectId);
  const spec = await loadProjectSpec(projectId);

  if (!spec) {
    return res.status(502).json({ error: `Failed to reload spec for project ${projectId}` });
  }

  return res.json({
    message: `Spec reloaded for project ${projectId}`,
    path_groups: Object.keys(spec.paths || {}).length,
    reloaded_at: projectReloads.get(projectId),
  });
});

app.all("/mock/:projectId/*", async (req, res) => {
  const projectId = parseInt(req.params.projectId, 10);
  let spec = projectSpecs.get(projectId);

  if (!registeredProjects.has(projectId) || !spec) {
    spec = await loadProjectSpec(projectId);
  }

  if (!spec) {
    return res.status(502).json({ error: `Unable to load spec for project ${projectId}` });
  }

  const requestPath = normalizeMockPath(req.path.slice(`/mock/${projectId}`.length));
  const match = findOperation(spec, req.method.toLowerCase(), requestPath);

  if (!match) {
    return res.status(404).json({
      error: "Mock route not found",
      message: `${req.method} ${requestPath} is not defined in project ${projectId}`,
    });
  }

  const { operation, path: routeTemplate } = match;

  const now = new Date();
  const timestamp = now.toISOString().slice(11, 19);
  const latency = Math.floor(Math.random() * 50) + 5;
  const codes = Object.keys(operation.responses || { "200": {} });
  const successCode = codes.find(code => code.startsWith("2")) || codes[0] || "200";

  requestLog.unshift({
    timestamp: now.toISOString(),
    time: timestamp,
    project_id: projectId,
    method: req.method.toUpperCase(),
    path: req.path,
    route_template: routeTemplate,
    status: parseInt(successCode, 10),
    latency: `${latency}ms`,
  });

  if (requestLog.length > 100) {
    requestLog.pop();
  }

  const example = getStatusExample(successCode, operation, spec);
  return setTimeout(() => {
    res.status(parseInt(successCode, 10)).json(example);
  }, latency);
});

app.listen(PORT, () => {
  console.log(`[Mock] APIBlueprint Mock Server running on port ${PORT}`);
  console.log(`[Mock] Backend URL: ${BACKEND_URL}`);
});
