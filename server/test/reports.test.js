const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const cookieParser = require("cookie-parser");
const express = require("express");
const jwt = require("jsonwebtoken");
const supabaseSdk = require("@supabase/supabase-js");
const db = require("../db");
const tutorApplicationService = require("../services/tutorApplications");
const { ensureReportSchema } = require("../services/reports");

const originalQuery = db.query;
const originalGetEffectiveRoles = tutorApplicationService.getEffectiveRoles;
const originalCreateClient = supabaseSdk.createClient;
const originalStorageEnvironment = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  SUPABASE_BUCKET: process.env.SUPABASE_BUCKET
};
const activeServers = [];
let harnessCount = 0;

async function createHarness({
  rolesByUser = {
    7: ["STUDENT"],
    8: ["TUTOR"],
    9: ["ADMIN"],
    10: ["STUDENT", "TUTOR"]
  },
  reports = []
} = {}) {
  const storageUrl = `https://easylearning-reports-${++harnessCount}.supabase.co`;
  process.env.SUPABASE_URL = storageUrl;
  process.env.SUPABASE_SECRET_KEY = "test-report-storage-secret";
  process.env.SUPABASE_BUCKET = "tutor-documents";

  const state = {
    reports: reports.map((report) => ({ ...report })),
    nextId: reports.reduce((maxId, report) => Math.max(maxId, Number(report.id) || 0), 0) + 1,
    queriedReporterId: null,
    insertParams: null,
    databaseFailure: null,
    storageFailure: null,
    storageObjects: new Map(),
    storageCalls: []
  };

  supabaseSdk.createClient = (url, secretKey) => {
    assert.equal(url, storageUrl);
    assert.equal(secretKey, process.env.SUPABASE_SECRET_KEY);
    return {
      storage: {
        from(bucket) {
          assert.equal(bucket, "tutor-documents");
          return {
            async upload(key, body, options) {
              state.storageCalls.push({ operation: "upload", key, options });
              if (state.storageFailure === "upload") return { data: null, error: { message: "secret-storage-error" } };
              state.storageObjects.set(key, Buffer.from(body));
              return { data: { path: key }, error: null };
            },
            async createSignedUrl(key, expiresIn, options) {
              state.storageCalls.push({ operation: "signed-url", key, expiresIn, options });
              if (state.storageFailure === "signed-url") return { data: null, error: { message: "secret-storage-error" } };
              return { data: { signedUrl: `${storageUrl}/signed/${key}?token=private-test-token` }, error: null };
            },
            async remove(keys) {
              state.storageCalls.push({ operation: "delete", keys });
              if (state.storageFailure === "delete") return { data: null, error: { message: "secret-storage-error" } };
              for (const key of keys) state.storageObjects.delete(key);
              return { data: { message: "Removed" }, error: null };
            }
          };
        }
      }
    };
  };

  const userById = {
    7: { first_name: "Sam", last_name: "Student", email: "sam@university.test" },
    8: { first_name: "Taylor", last_name: "Tutor", email: "taylor@university.test" },
    9: { first_name: "Alex", last_name: "Admin", email: "admin@university.test" },
    10: { first_name: "Casey", last_name: "Dual", email: "casey@university.test" }
  };

  db.query = async (text, params = []) => {
    const query = text.replace(/\s+/g, " ").trim().toLowerCase();
    if (state.databaseFailure && (!state.databaseFailure.includes || query.includes(state.databaseFailure.includes))) {
      const error = new Error("database-private-error");
      error.code = "DB_TEST_FAILURE";
      throw error;
    }

    if (query.startsWith("insert into reports")) {
      state.insertParams = [...params];
      const [reporterId, reporterRoles, category, subject, description, storageKey, fileName, mimeType, sizeBytes] = params;
      const row = {
        id: state.nextId++,
        reporter_id: reporterId,
        reporter_roles: reporterRoles,
        category,
        subject,
        description,
        attachment_storage_key: storageKey,
        attachment_original_name: fileName,
        attachment_mime_type: mimeType,
        attachment_size_bytes: sizeBytes,
        status: "OPEN",
        admin_response: null,
        created_at: "2026-10-13T12:00:00.000Z",
        updated_at: "2026-10-13T12:00:00.000Z"
      };
      state.reports.push(row);
      return { rows: [{ ...row }] };
    }

    if (query.startsWith("select id, category, subject, reporter_roles, status, admin_response")) {
      state.queriedReporterId = params[0];
      return {
        rows: state.reports.filter((report) => Number(report.reporter_id) === Number(params[0]))
          .sort((left, right) => Number(right.id) - Number(left.id))
          .map((report) => ({ ...report }))
      };
    }

    if (query.startsWith("select r.id, r.reporter_id, r.category")) {
      const [status, category] = params;
      return {
        rows: state.reports
          .filter((report) => (!status || report.status === status) && (!category || report.category === category))
          .sort((left, right) => Number(right.id) - Number(left.id))
          .map((report) => ({
            ...report,
            reporter_first_name: userById[report.reporter_id]?.first_name || "",
            reporter_last_name: userById[report.reporter_id]?.last_name || "",
            reporter_email: userById[report.reporter_id]?.email || ""
          }))
      };
    }

    if (query.startsWith("update reports")) {
      const [status, hasResponse, response, reportId] = params;
      const report = state.reports.find((entry) => Number(entry.id) === Number(reportId));
      if (!report) return { rows: [] };
      report.status = status;
      if (hasResponse) report.admin_response = response;
      report.updated_at = "2026-10-13T12:30:00.000Z";
      return { rows: [{ ...report }] };
    }

    if (query.startsWith("select reporter_id, attachment_storage_key")) {
      const report = state.reports.find((entry) => Number(entry.id) === Number(params[0]));
      return { rows: report ? [{
        reporter_id: report.reporter_id,
        attachment_storage_key: report.attachment_storage_key,
        attachment_original_name: report.attachment_original_name
      }] : [] };
    }

    throw new Error(`Unexpected fake database query: ${query}`);
  };

  tutorApplicationService.getEffectiveRoles = async (userId) => rolesByUser[userId] || [];
  delete require.cache[require.resolve("../middleware/auth")];
  delete require.cache[require.resolve("../routes/reports")];

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/reports", require("../routes/reports"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const harness = { server, state, url: `http://127.0.0.1:${address.port}` };
  activeServers.push(server);
  return harness;
}

function tokenFor(userId) {
  const secret = process.env.JWT_SECRET || "easylearning_default_secret_key_change_in_prod";
  return jwt.sign({ id: userId, email: `${userId}@university.test` }, secret);
}

function authHeaders(userId) {
  return { Authorization: `Bearer ${tokenFor(userId)}` };
}

function validReport(overrides = {}) {
  return {
    category: "Technical issue",
    subject: "Cannot open my profile",
    description: "The profile page returns an error after I sign in.",
    ...overrides
  };
}

function reportRow(overrides = {}) {
  return {
    id: 1,
    reporter_id: 7,
    reporter_roles: ["STUDENT"],
    category: "Technical issue",
    subject: "Existing report",
    description: "Existing report details.",
    attachment_storage_key: null,
    attachment_original_name: null,
    attachment_mime_type: null,
    attachment_size_bytes: null,
    status: "OPEN",
    admin_response: null,
    created_at: "2026-10-12T12:00:00.000Z",
    updated_at: "2026-10-12T12:00:00.000Z",
    ...overrides
  };
}

async function submitJson(harness, userId, body) {
  return fetch(`${harness.url}/api/reports`, {
    method: "POST",
    headers: { ...authHeaders(userId), "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function submitPdf(harness, userId, body, fileBody = "%PDF-1.4 test file") {
  const form = new FormData();
  for (const [key, value] of Object.entries(body)) form.set(key, value);
  form.set("attachment", new Blob([fileBody], { type: "application/pdf" }), "evidence.pdf");
  return fetch(`${harness.url}/api/reports`, {
    method: "POST",
    headers: authHeaders(userId),
    body: form
  });
}

async function submitWrongFileType(harness, userId, body) {
  const form = new FormData();
  for (const [key, value] of Object.entries(body)) form.set(key, value);
  form.set("attachment", new Blob(["not allowed"], { type: "text/plain" }), "notes.txt");
  return fetch(`${harness.url}/api/reports`, {
    method: "POST",
    headers: authHeaders(userId),
    body: form
  });
}

afterEach(async () => {
  for (const server of activeServers.splice(0)) {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  db.query = originalQuery;
  tutorApplicationService.getEffectiveRoles = originalGetEffectiveRoles;
  supabaseSdk.createClient = originalCreateClient;
  for (const [key, value] of Object.entries(originalStorageEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  delete require.cache[require.resolve("../middleware/auth")];
  delete require.cache[require.resolve("../routes/reports")];
});

test("authenticated user creates a report with reporter ID and all effective roles derived from auth", async () => {
  const harness = await createHarness();
  const response = await submitJson(harness, 10, {
    ...validReport(),
    reporterId: 999,
    userRole: "ADMIN"
  });

  assert.equal(response.status, 400);
  assert.equal(harness.state.reports.length, 0);

  const validResponse = await submitJson(harness, 10, validReport());
  const data = await validResponse.json();
  assert.equal(validResponse.status, 201);
  assert.equal(harness.state.insertParams[0], 10);
  assert.deepEqual(harness.state.insertParams[1], ["STUDENT", "TUTOR"]);
  assert.equal(data.report.status, "OPEN");
  assert.equal(data.report.subject, "Cannot open my profile");
  assert.equal(data.report.reporterRoles.join(","), "STUDENT,TUTOR");
});

test("report submission rejects missing fields, invalid categories, and oversized text", async () => {
  const harness = await createHarness();
  for (const body of [
    validReport({ subject: "" }),
    validReport({ description: "  " }),
    validReport({ category: "Not a category" }),
    validReport({ subject: "x".repeat(161) }),
    validReport({ description: "x".repeat(5001) })
  ]) {
    const response = await submitJson(harness, 7, body);
    assert.equal(response.status, 400);
  }
  assert.equal(harness.state.reports.length, 0);
});

test("report submission requires authentication", async () => {
  const harness = await createHarness();
  const response = await fetch(`${harness.url}/api/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validReport())
  });
  assert.equal(response.status, 401);
  assert.equal(harness.state.reports.length, 0);
});

test("users can retrieve only their own reports and see only user-visible response fields", async () => {
  const harness = await createHarness({ reports: [
    reportRow({ id: 2, reporter_id: 7, admin_response: "We are investigating." }),
    reportRow({ id: 1, reporter_id: 8, subject: "Another user's report" })
  ] });
  const response = await fetch(`${harness.url}/api/reports/mine`, { headers: authHeaders(7) });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(harness.state.queriedReporterId, 7);
  assert.equal(data.reports.length, 1);
  assert.equal(data.reports[0].subject, "Existing report");
  assert.equal(data.reports[0].response, "We are investigating.");
  assert.equal("description" in data.reports[0], false);
  assert.equal("reporter" in data.reports[0], false);
});

test("admin can view and filter the report queue; non-admin cannot", async () => {
  const harness = await createHarness({ reports: [
    reportRow({ id: 1 }),
    reportRow({ id: 2, reporter_id: 8, category: "Payment problem", status: "IN_REVIEW", subject: "Payment receipt" })
  ] });
  const denied = await fetch(`${harness.url}/api/reports/admin`, { headers: authHeaders(7) });
  assert.equal(denied.status, 403);

  const response = await fetch(`${harness.url}/api/reports/admin?status=IN_REVIEW&category=Payment%20problem`, {
    headers: authHeaders(9)
  });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.reports.length, 1);
  assert.equal(data.reports[0].subject, "Payment receipt");
  assert.equal(data.reports[0].reporter.email, "taylor@university.test");
  assert.equal(data.reports[0].description, "Existing report details.");

  const invalidFilter = await fetch(`${harness.url}/api/reports/admin?status=BOGUS`, { headers: authHeaders(9) });
  assert.equal(invalidFilter.status, 400);
});

test("admin can update status and a user-visible response using POST only", async () => {
  const harness = await createHarness({ reports: [reportRow({ id: 12 })] });
  const denied = await fetch(`${harness.url}/api/reports/12/status`, {
    method: "POST",
    headers: { ...authHeaders(7), "Content-Type": "application/json" },
    body: JSON.stringify({ status: "RESOLVED", response: "Fixed." })
  });
  assert.equal(denied.status, 403);

  const response = await fetch(`${harness.url}/api/reports/12/status`, {
    method: "POST",
    headers: { ...authHeaders(9), "Content-Type": "application/json" },
    body: JSON.stringify({ status: "RESOLVED", response: "The issue has been fixed." })
  });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.report.status, "RESOLVED");
  assert.equal(data.report.response, "The issue has been fixed.");
  assert.equal(harness.state.reports[0].status, "RESOLVED");

  const ownerHistory = await fetch(`${harness.url}/api/reports/mine`, { headers: authHeaders(7) });
  const ownerData = await ownerHistory.json();
  assert.equal(ownerData.reports[0].response, "The issue has been fixed.");
});

test("status updates reject invalid report IDs, statuses, and missing records", async () => {
  const harness = await createHarness();
  const invalidId = await fetch(`${harness.url}/api/reports/not-an-id/status`, {
    method: "POST",
    headers: { ...authHeaders(9), "Content-Type": "application/json" },
    body: JSON.stringify({ status: "OPEN" })
  });
  assert.equal(invalidId.status, 400);

  const invalidStatus = await fetch(`${harness.url}/api/reports/1/status`, {
    method: "POST",
    headers: { ...authHeaders(9), "Content-Type": "application/json" },
    body: JSON.stringify({ status: "IGNORED" })
  });
  assert.equal(invalidStatus.status, 400);

  const missing = await fetch(`${harness.url}/api/reports/1/status`, {
    method: "POST",
    headers: { ...authHeaders(9), "Content-Type": "application/json" },
    body: JSON.stringify({ status: "OPEN" })
  });
  assert.equal(missing.status, 404);
});

test("database failures return safe report errors", async () => {
  const harness = await createHarness();
  harness.state.databaseFailure = { includes: "insert into reports" };
  const response = await submitJson(harness, 7, validReport());
  const data = await response.json();

  assert.equal(response.status, 500);
  assert.equal(data.error, "Unable to submit your report.");
  assert.equal(JSON.stringify(data).includes("database-private-error"), false);
  assert.equal(JSON.stringify(data).includes("DB_TEST_FAILURE"), false);
});

test("report attachments are private, validated, and available only to owner or admin", async () => {
  const harness = await createHarness();
  const invalidType = await submitWrongFileType(harness, 7, validReport());
  assert.equal(invalidType.status, 415);

  const invalidSignature = await submitPdf(harness, 7, validReport(), "not a PDF");
  assert.equal(invalidSignature.status, 415);
  assert.equal(harness.state.storageCalls.length, 0);

  const oversized = await submitPdf(harness, 7, validReport(), Buffer.alloc(5 * 1024 * 1024 + 1, 0x41));
  assert.equal(oversized.status, 400);
  assert.equal(harness.state.storageCalls.length, 0);

  const response = await submitPdf(harness, 7, validReport());
  const data = await response.json();
  assert.equal(response.status, 201);
  assert.equal(data.report.attachmentName, "evidence.pdf");
  assert.equal(harness.state.storageCalls[0].operation, "upload");
  assert.equal(harness.state.storageCalls[0].options.upsert, false);

  const forbidden = await fetch(`${harness.url}/api/reports/${data.report.id}/attachment`, {
    headers: authHeaders(8),
    redirect: "manual"
  });
  assert.equal(forbidden.status, 404);
  assert.equal(harness.state.storageCalls.some((call) => call.operation === "signed-url"), false);

  const ownerDownload = await fetch(`${harness.url}/api/reports/${data.report.id}/attachment`, {
    headers: authHeaders(7),
    redirect: "manual"
  });
  assert.equal(ownerDownload.status, 302);
  assert.match(ownerDownload.headers.get("location"), /private-test-token/);
  assert.equal(ownerDownload.headers.get("cache-control"), "private, no-store");

  const adminDownload = await fetch(`${harness.url}/api/reports/${data.report.id}/attachment`, {
    headers: authHeaders(9),
    redirect: "manual"
  });
  assert.equal(adminDownload.status, 302);
});

test("storage and database errors do not expose secrets and failed inserts clean up uploaded files", async () => {
  const harness = await createHarness();
  harness.state.databaseFailure = { includes: "insert into reports" };
  const response = await submitPdf(harness, 7, validReport());
  const data = await response.json();

  assert.equal(response.status, 500);
  assert.equal(data.error, "Unable to submit your report.");
  assert.equal(harness.state.storageObjects.size, 0);
  assert.equal(harness.state.storageCalls.some((call) => call.operation === "delete"), true);

  harness.state.databaseFailure = null;
  harness.state.storageFailure = "upload";
  const storageResponse = await submitPdf(harness, 7, validReport());
  const storageData = await storageResponse.json();
  assert.equal(storageResponse.status, 500);
  assert.equal(JSON.stringify(storageData).includes("secret-storage-error"), false);
});

test("report startup schema creates the table and supporting indexes", async () => {
  const originalDatabaseQuery = db.query;
  const statements = [];
  db.query = async (query) => {
    statements.push(query.replace(/\s+/g, " ").trim().toLowerCase());
    return { rows: [] };
  };
  try {
    await ensureReportSchema();
    assert.equal(statements.length, 3);
    assert.match(statements[0], /create table if not exists reports/);
    assert.match(statements[1], /reports_reporter_created_idx/);
    assert.match(statements[2], /reports_status_category_created_idx/);
  } finally {
    db.query = originalDatabaseQuery;
  }
});
