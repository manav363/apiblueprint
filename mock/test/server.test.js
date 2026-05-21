const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

let server;
let app;

function jsonRequest(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "127.0.0.1",
      port: server.address().port,
      path,
      method,
      headers: { "Content-Type": "application/json", ...headers },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe("Mock Server", () => {
  before(() => {
    process.env.PORT = "0";
    process.env.BACKEND_URL = "http://localhost:9999";
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD = "test-password";
    process.env.JWT_SECRET = "test-jwt-secret-for-mock-tests";
    process.env.CORS_ORIGINS = '["http://localhost:5173"]';

    const jwt = require("jsonwebtoken");

    app = require("../server");

    return new Promise((resolve) => {
      server = app.listen(0, () => {
        resolve();
      });
    });
  });

  after(() => {
    if (server) server.close();
  });

  it("returns health status", async () => {
    const res = await jsonRequest("GET", "/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "ok");
    assert.ok(res.body.service.includes("apiblueprint-mock"));
  });

  it("returns 401 for unauthenticated /mock-logs", async () => {
    const res = await jsonRequest("GET", "/mock-logs");
    assert.equal(res.status, 401);
  });

  it("returns 401 for invalid JWT", async () => {
    const res = await jsonRequest("GET", "/mock-logs", null, {
      Authorization: "Bearer invalid-token-thing",
    });
    assert.equal(res.status, 401);
  });

  it("returns valid response for valid JWT on /mock-logs", async () => {
    const jwt = require("jsonwebtoken");
    const token = jwt.sign(
      {
        sub: "admin",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300,
        scope: "admin",
      },
      "test-jwt-secret-for-mock-tests",
      { algorithm: "HS256" }
    );

    const res = await jsonRequest("GET", "/mock-logs", null, {
      Authorization: `Bearer ${token}`,
    });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });
});
