const assert = require("node:assert/strict");
const { test } = require("node:test");
const cors = require("cors");
const express = require("express");
const { createCorsOptions, handleCorsError } = require("../middleware/cors");

async function requestWithOrigin(environment, origin, {
  method = "GET",
  requestHeaders,
  path = "/health"
} = {}) {
  const app = express();
  app.use(cors(createCorsOptions(environment)));
  app.get("/health", (req, res) => res.json({ ok: true }));
  app.get("/api/auth/me", (req, res) => res.status(401).json({ error: "Authentication required" }));
  app.use(handleCorsError);

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();

  try {
    const headers = origin ? { Origin: origin } : {};
    if (requestHeaders) {
      headers["Access-Control-Request-Method"] = method;
      headers["Access-Control-Request-Headers"] = requestHeaders;
    }
    return await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method: requestHeaders ? "OPTIONS" : method,
      headers
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

test("credentialed CORS allows CLIENT_URL and explicitly configured additional origins", async () => {
  const environment = {
    NODE_ENV: "production",
    CLIENT_URL: "https://market.example.test/",
    CORS_ALLOWED_ORIGINS: " https://preview.example.test, https://staging.example.test/ "
  };

  for (const origin of [
    "https://market.example.test",
    "https://preview.example.test",
    "https://staging.example.test"
  ]) {
    const response = await requestWithOrigin(environment, origin);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
  }
});

test("production login preflight allows the deployed Vercel origin with credentials", async () => {
  const origin = "https://cs-student-skills-tutoring-marketpl.vercel.app";
  const response = await requestWithOrigin({
    NODE_ENV: "production",
    CLIENT_URL: "https://market.example.test",
    CORS_ALLOWED_ORIGINS: origin
  }, origin, {
    method: "POST",
    requestHeaders: "content-type",
    path: "/api/auth/login"
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), origin);
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
  assert.match(response.headers.get("access-control-allow-methods") || "", /\bPOST\b/);
  assert.equal(response.headers.get("access-control-allow-headers"), "content-type");

  const sessionResponse = await requestWithOrigin({
    NODE_ENV: "production",
    CLIENT_URL: "https://market.example.test",
    CORS_ALLOWED_ORIGINS: origin
  }, origin, { path: "/api/auth/me" });
  assert.equal(sessionResponse.status, 401);
  assert.equal(sessionResponse.headers.get("access-control-allow-origin"), origin);
  assert.equal(sessionResponse.headers.get("access-control-allow-credentials"), "true");
});

test("credentialed CORS rejects origins that are not explicitly configured", async () => {
  const response = await requestWithOrigin({
    NODE_ENV: "production",
    CLIENT_URL: "https://market.example.test",
    CORS_ALLOWED_ORIGINS: "https://preview.example.test"
  }, "https://untrusted.example.test");

  assert.equal(response.status, 403);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.deepEqual(await response.json(), { error: "Origin is not allowed." });
});

test("localhost is allowed only outside production and requests without an origin remain supported", async () => {
  const developmentEnvironment = {
    NODE_ENV: "development",
    CLIENT_URL: "https://market.example.test"
  };
  const developmentResponse = await requestWithOrigin(developmentEnvironment, "http://localhost:3000");
  assert.equal(developmentResponse.headers.get("access-control-allow-origin"), "http://localhost:3000");
  assert.equal(developmentResponse.headers.get("access-control-allow-credentials"), "true");

  const productionResponse = await requestWithOrigin({
    ...developmentEnvironment,
    NODE_ENV: "production"
  }, "http://localhost:3000");
  assert.equal(productionResponse.status, 403);
  assert.equal(productionResponse.headers.get("access-control-allow-origin"), null);

  const nonBrowserResponse = await requestWithOrigin(developmentEnvironment, null);
  assert.equal(nonBrowserResponse.status, 200);
});

test("invalid CORS configuration fails explicitly", () => {
  assert.throws(() => createCorsOptions({
    CLIENT_URL: "not a valid origin",
    NODE_ENV: "production"
  }), /CLIENT_URL and CORS_ALLOWED_ORIGINS must contain valid HTTP or HTTPS origins/);
});
