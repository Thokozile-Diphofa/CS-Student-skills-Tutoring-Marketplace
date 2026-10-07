const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const cookieParser = require("cookie-parser");
const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../db");
const tutorApplicationService = require("../services/tutorApplications");

const originalQuery = db.query;
const originalPool = db.pool;
const originalGetEffectiveRoles = tutorApplicationService.getEffectiveRoles;
const activeServers = [];
let queriedStudentId;
let insertedRequestValues;

async function createHarness({
  roles = ["STUDENT"],
  approvedTutorIds = [31],
  requests = [{
    id: 19,
    student_id: 7,
    tutor_id: 31,
    student_first_name: "Sam",
    student_last_name: "Student",
    tutor_first_name: "Taylor",
    tutor_last_name: "Tutor",
    subject: "Data Structures",
    message: null,
    requested_date: null,
    status: "ACCEPTED",
    created_at: "2026-02-01T12:00:00.000Z",
    hourly_rate: "150.00",
    payment_status: null,
    payout_status: null,
    payment_amount: null,
    currency: null,
    paid_at: null
  }]
} = {}) {
  const state = { requests: requests.map((request) => ({ ...request })), nextId: 20 };
  const fakeQuery = async (text, params = []) => {
    const query = text.replace(/\s+/g, " ").trim().toLowerCase();
    if (query.includes("from session_requests sr") && query.includes("where sr.student_id = $1")) {
      queriedStudentId = params[0];
      return { rows: state.requests.filter((request) => Number(request.student_id) === Number(params[0])) };
    }
    if (query.startsWith("select u.id from users u")) {
      return { rows: approvedTutorIds.includes(Number(params[0])) ? [{ id: Number(params[0]) }] : [] };
    }
    if (query.startsWith("insert into session_requests")) {
      const [studentId, tutorId, subject, message, requestedDate] = params;
      insertedRequestValues = [...params];
      const request = {
        id: state.nextId++,
        student_id: studentId,
        tutor_id: tutorId,
        subject,
        message,
        requested_date: requestedDate,
        status: "PENDING",
        created_at: "2026-03-01T12:00:00.000Z"
      };
      state.requests.push(request);
      return { rows: [{ ...request }] };
    }
    if (query.includes("from session_requests sr") && query.includes("where sr.tutor_id = $1")) {
      return { rows: state.requests.filter((request) => Number(request.tutor_id) === Number(params[0])) };
    }
    throw new Error(`Unexpected fake database query: ${query}`);
  };

  const client = {
    async query(text, params = []) {
      const query = text.replace(/\s+/g, " ").trim().toLowerCase();
      if (["begin", "commit", "rollback"].includes(query)) return { rows: [] };
      if (query.startsWith("select id, student_id, tutor_id, subject, message, requested_date, status, created_at from session_requests")) {
        const request = state.requests.find((entry) => Number(entry.id) === Number(params[0]));
        return { rows: request ? [{ ...request }] : [] };
      }
      if (query.startsWith("update session_requests")) {
        const [status, requestId, tutorId] = params;
        const request = state.requests.find((entry) => Number(entry.id) === Number(requestId)
          && Number(entry.tutor_id) === Number(tutorId) && entry.status === "PENDING");
        if (!request) return { rows: [] };
        request.status = status;
        return { rows: [{ ...request }] };
      }
      throw new Error(`Unexpected fake client query: ${query}`);
    },
    release() {}
  };

  db.query = fakeQuery;
  db.pool = { connect: async () => client };
  tutorApplicationService.getEffectiveRoles = async () => roles;
  delete require.cache[require.resolve("../middleware/auth")];
  delete require.cache[require.resolve("../routes/sessionRequests")];

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/session-requests", require("../routes/sessionRequests"));
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

function requestHeaders(userId) {
  return { Authorization: `Bearer ${tokenFor(userId)}` };
}

afterEach(async () => {
  for (const server of activeServers.splice(0)) {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  db.query = originalQuery;
  db.pool = originalPool;
  tutorApplicationService.getEffectiveRoles = originalGetEffectiveRoles;
  delete require.cache[require.resolve("../middleware/auth")];
  delete require.cache[require.resolve("../routes/sessionRequests")];
});

test("student session list is scoped to the authenticated user and includes tutor, fee, and payment state", async () => {
  const harness = await createHarness({ requests: [
    { id: 19, student_id: 7, tutor_id: 31, tutor_first_name: "Taylor", tutor_last_name: "Tutor", subject: "Data Structures", status: "ACCEPTED", hourly_rate: "150.00", payment_status: null },
    { id: 20, student_id: 8, tutor_id: 31, tutor_first_name: "Taylor", tutor_last_name: "Tutor", subject: "Algorithms", status: "PENDING", hourly_rate: "150.00", payment_status: null }
  ] });
  const response = await fetch(`${harness.url}/api/session-requests/mine`, { headers: requestHeaders(7) });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(queriedStudentId, 7);
  assert.equal(data.sessionRequests.length, 1);
  assert.equal(data.sessionRequests[0].tutorFirstName, "Taylor");
  assert.equal(data.sessionRequests[0].subject, "Data Structures");
  assert.equal(data.sessionRequests[0].hourlyRate, "150.00");
  assert.equal(data.sessionRequests[0].status, "ACCEPTED");
});

test("session list requires STUDENT access", async () => {
  const harness = await createHarness({ roles: ["TUTOR"] });
  const response = await fetch(`${harness.url}/api/session-requests/mine`, { headers: requestHeaders(7) });
  assert.equal(response.status, 403);
});

test("student creates a PENDING request with student ID derived from authentication", async () => {
  const harness = await createHarness();
  insertedRequestValues = null;
  const response = await fetch(`${harness.url}/api/session-requests`, {
    method: "POST",
    headers: { ...requestHeaders(7), "Content-Type": "application/json" },
    body: JSON.stringify({
      tutorId: 31,
      subject: "  Data Structures  ",
      requestedDate: "2026-12-01T10:30:00.000Z",
      message: "Please help me prepare for the exam."
    })
  });
  const data = await response.json();

  assert.equal(response.status, 201);
  assert.equal(insertedRequestValues[0], 7);
  assert.equal(insertedRequestValues[1], 31);
  assert.equal(insertedRequestValues[2], "Data Structures");
  assert.equal(data.sessionRequest.status, "PENDING");
  assert.equal(data.sessionRequest.studentId, 7);
  assert.equal(harness.state.requests.at(-1).status, "PENDING");

  const studentListResponse = await fetch(`${harness.url}/api/session-requests/mine`, {
    headers: requestHeaders(7)
  });
  const studentList = await studentListResponse.json();
  assert.equal(studentListResponse.status, 200);
  assert.ok(studentList.sessionRequests.some((request) => request.id === data.sessionRequest.id
    && request.status === "PENDING"));
});

test("student ID overrides are rejected, as are self-requests and unapproved tutors", async () => {
  const harness = await createHarness();
  const submit = (body) => fetch(`${harness.url}/api/session-requests`, {
    method: "POST",
    headers: { ...requestHeaders(7), "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  assert.equal((await submit({ tutorId: 31, studentId: 999, subject: "Algorithms" })).status, 400);
  assert.equal((await submit({ tutorId: 7, subject: "Algorithms" })).status, 400);
  assert.equal((await submit({ tutorId: 99, subject: "Algorithms" })).status, 404);

  const unapprovedHarness = await createHarness({ approvedTutorIds: [] });
  const unapproved = await fetch(`${unapprovedHarness.url}/api/session-requests`, {
    method: "POST",
    headers: { ...requestHeaders(7), "Content-Type": "application/json" },
    body: JSON.stringify({ tutorId: 31, subject: "Algorithms" })
  });
  assert.equal(unapproved.status, 404);
});

test("tutor sees only their own incoming requests and can accept or decline pending requests once", async () => {
  const harness = await createHarness({
    roles: ["TUTOR"],
    requests: [
      { id: 40, student_id: 7, tutor_id: 31, student_first_name: "Sam", student_last_name: "Student", subject: "Operating Systems", status: "PENDING" },
      { id: 41, student_id: 8, tutor_id: 32, student_first_name: "Other", student_last_name: "Student", subject: "Algorithms", status: "PENDING" },
      { id: 42, student_id: 8, tutor_id: 31, student_first_name: "Other", student_last_name: "Student", subject: "Databases", status: "PENDING" }
    ]
  });
  const incomingResponse = await fetch(`${harness.url}/api/session-requests/incoming`, { headers: requestHeaders(31) });
  const incoming = await incomingResponse.json();
  assert.equal(incomingResponse.status, 200);
  assert.deepEqual(incoming.sessionRequests.map((request) => request.id), [40, 42]);

  const respond = (id, status) => fetch(`${harness.url}/api/session-requests/${id}/respond`, {
    method: "PATCH",
    headers: { ...requestHeaders(31), "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  const accepted = await respond(40, "ACCEPTED");
  assert.equal(accepted.status, 200);
  assert.equal((await accepted.json()).sessionRequest.status, "ACCEPTED");
  assert.equal((await respond(42, "DECLINED")).status, 200);
  assert.equal((await respond(40, "DECLINED")).status, 409);
  assert.equal((await respond(41, "ACCEPTED")).status, 404);
  assert.equal((await respond(42, "PENDING")).status, 400);
});