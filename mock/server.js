const express = require("express");
const axios = require("axios");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const BACKEND_URL = process.env.BACKEND_URL || "http://backend:8000";
const PORT = process.env.PORT || 4010;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const CORS_ORIGINS = parseOrigins(process.env.CORS_ORIGINS);

if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
  throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD must be configured for the mock server");
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || CORS_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Origin not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
}));
app.use(express.json());
app.use((req, res, next) => {
  if (req.path === "/health") {
    next();
    return;
  }

  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Basic ")) {
    res.set("WWW-Authenticate", "Basic");
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  const username = separator >= 0 ? decoded.slice(0, separator) : "";
  const password = separator >= 0 ? decoded.slice(separator + 1) : "";

  if (!safeEqual(username, ADMIN_USERNAME) || !safeEqual(password, ADMIN_PASSWORD)) {
    res.set("WWW-Authenticate", "Basic");
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  next();
});

const registeredProjects = new Set();
const projectSpecs = new Map();
let requestLog = [];
const serverStartedAt = Date.now();

function parseOrigins(value) {
  if (!value) return ["http://localhost:5173", "http://localhost:3000"];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return value.split(",").map(item => item.trim()).filter(Boolean);
  }
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function buildBackendAuthHeader() {
  return `Basic ${Buffer.from(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`).toString("base64")}`;
}

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
      return methods[method];
    }
  }
  return null;
}

async function loadProjectSpec(projectId) {
  try {
    const res = await axios.get(`${BACKEND_URL}/api/projects/${projectId}/spec.json`, {
      headers: { Authorization: buildBackendAuthHeader() },
    });
    const spec = res.data;
    projectSpecs.set(projectId, spec);
    registeredProjects.add(projectId);

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
  res.json(requestLog);
});

app.get("/mock-stats", (req, res) => {
  const total = requestLog.length;
  const errors = requestLog.filter(r => r.status >= 400).length;
  const avgLatency = requestLog.length
    ? Math.round(requestLog.reduce((a, r) => a + parseInt(r.latency), 0) / requestLog.length)
    : 0;

  const uptimeMs = Date.now() - serverStartedAt;
  const uptimeSec = Math.floor(uptimeMs / 1000);
  const hours = Math.floor(uptimeSec / 3600);
  const minutes = Math.floor((uptimeSec % 3600) / 60);
  const seconds = uptimeSec % 60;
  const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;

  res.json({
    total_requests: total,
    error_rate: total ? ((errors / total) * 100).toFixed(1) + "%" : "0%",
    avg_latency: avgLatency + "ms",
    uptime: uptimeStr,
  });
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
  const operation = findOperation(spec, req.method.toLowerCase(), requestPath);

  if (!operation) {
    return res.status(404).json({
      error: "Mock route not found",
      message: `${req.method} ${requestPath} is not defined in project ${projectId}`,
    });
  }

  const timestamp = new Date().toISOString().slice(11, 19);
  const latency = Math.floor(Math.random() * 50) + 5;
  const codes = Object.keys(operation.responses || { "200": {} });
  const successCode = codes.find(code => code.startsWith("2")) || codes[0] || "200";

  requestLog.unshift({
    time: timestamp,
    method: req.method.toUpperCase(),
    path: req.path,
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
