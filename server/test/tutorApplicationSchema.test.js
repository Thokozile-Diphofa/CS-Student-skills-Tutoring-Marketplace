const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const cookieParser = require("cookie-parser");
const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../db");
const tutorApplicationServicePath = require.resolve("../services/tutorApplications");
const authMiddlewarePath = require.resolve("../middleware/auth");
const originalQuery = db.query;
const originalPool = db.pool;
const originalGetEffectiveRoles = require("../services/tutorApplications").getEffectiveRoles;
let activeServer;

function freshTutorApplicationService() {
  delete require.cache[tutorApplicationServicePath];
  return require("../services/tutorApplications");
}

afterEach(async () => {
  if (activeServer) {
    await new Promise((resolve, reject) => activeServer.close((error) => error ? reject(error) : resolve()));
    activeServer = null;
  }
  db.query = originalQuery;
  db.pool = originalPool;
  require("../services/tutorApplications").getEffectiveRoles = originalGetEffectiveRoles;
  delete require.cache[authMiddlewarePath];
  delete require.cache[tutorApplicationServicePath];
});

test("concurrent first role lookups share one tutor-application schema initialization", async () => {
  let schemaQueries = 0;
  db.query = async (text) => {
    const query = text.replace(/\s+/g, " ").trim().toLowerCase();
    if (!query.startsWith("select ur.role")) schemaQueries += 1;
    await new Promise((resolve) => setTimeout(resolve, 2));
    return query.startsWith("select ur.role")
      ? { rows: [{ role: "STUDENT" }] }
      : { rows: [] };
  };

  const service = freshTutorApplicationService();
  const roles = await Promise.all(Array.from({ length: 5 }, () => service.getEffectiveRoles(7)));

  assert.deepEqual(roles, Array.from({ length: 5 }, () => ["STUDENT"]));
  assert.equal(schemaQueries, 7);
});

test("schema initialization failures identify their stage and are retried", async () => {
  let failFirstSchemaQuery = true;
  db.query = async (text) => {
    const query = text.replace(/\s+/g, " ").trim().toLowerCase();
    if (query.startsWith("create table if not exists tutor_profiles") && failFirstSchemaQuery) {
      failFirstSchemaQuery = false;
      throw Object.assign(new Error("schema operation failed"), { code: "42501" });
    }
    return query.startsWith("select ur.role")
      ? { rows: [{ role: "STUDENT" }] }
      : { rows: [] };
  };

  const service = freshTutorApplicationService();
  await assert.rejects(service.getEffectiveRoles(7), (error) => {
    assert.equal(error.roleLookupStage, "create tutor profiles");
    assert.equal(error.code, "42501");
    return true;
  });
  assert.deepEqual(await service.getEffectiveRoles(7), ["STUDENT"]);
});

test("authentication keeps permission errors generic and logs only the failed role lookup stage", async () => {
  const service = freshTutorApplicationService();
  service.getEffectiveRoles = async () => {
    const error = Object.assign(new Error("private database detail"), {
      code: "42P01",
      roleLookupStage: "query effective user roles"
    });
    throw error;
  };
  delete require.cache[authMiddlewarePath];
  const { authenticateToken } = require("../middleware/auth");
  const app = express();
  app.use(cookieParser());
  app.get("/private", authenticateToken, (req, res) => res.json({ roles: req.user.roles }));
  activeServer = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => activeServer.once("listening", resolve));
  const address = activeServer.address();
  const token = jwt.sign(
    { id: 7, email: "student@university.test" },
    process.env.JWT_SECRET || "easylearning_default_secret_key_change_in_prod"
  );
  const logged = [];
  const originalError = console.error;
  console.error = (...args) => logged.push(args);
  let response;
  try {
    response = await fetch(`http://127.0.0.1:${address.port}/private`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  } finally {
    console.error = originalError;
  }

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Unable to verify account permissions." });
  assert.equal(logged[0][0], "Role lookup failed:");
  assert.deepEqual(logged[0][1], {
    stage: "query effective user roles",
    errorCode: "42P01",
    errorName: "Error"
  });
  assert.equal(JSON.stringify(logged).includes("private database detail"), false);
});
