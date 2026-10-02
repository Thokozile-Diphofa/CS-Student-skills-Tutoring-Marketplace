const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const express = require("express");
const db = require("../db");

let activeHarness;

function cloneState(state) {
  return {
    users: new Map([...state.users].map(([id, user]) => [id, { ...user }])),
    roles: new Map([...state.roles].map(([id, roles]) => [id, new Set(roles)])),
    applications: new Map(state.applications),
    nextId: state.nextId,
    legacyRoleNullable: state.legacyRoleNullable
  };
}

async function createHarness({ legacyRoleColumn = true, failRoleInsert = false, failMigration = false } = {}) {
  const existingPasswordHash = await bcrypt.hash("existing-test-password", 4);
  const state = {
    users: new Map([[1, {
      id: 1,
      first_name: "Existing",
      last_name: "Account",
      university: "Test University",
      email: "existing@example.test",
      password_hash: existingPasswordHash,
      created_at: new Date().toISOString(),
      legacyRole: legacyRoleColumn ? "STUDENT" : null
    }]]),
    roles: new Map([[1, new Set(["STUDENT", "ADMIN", "TUTOR"] )]]),
    applications: new Map([[1, "APPROVED"]]),
    nextId: 2,
    legacyRoleNullable: false,
    failRoleInsert,
    failMigration
  };

  const fakeQuery = async (text, params = []) => {
    const query = text.replace(/\s+/g, " ").trim().toLowerCase();
    if (query.includes("select ur.role")) {
      const userId = Number(params[0]);
      const roles = [...(state.roles.get(userId) || [])]
        .filter((role) => role !== "TUTOR" || state.applications.get(userId) === "APPROVED")
        .sort();
      return { rows: roles.map((role) => ({ role })) };
    }
    if (query.includes("from users where lower(email)")) {
      const user = [...state.users.values()].find((entry) => entry.email.toLowerCase() === params[0]);
      if (!user) return { rows: [] };
      if (query.includes("password_hash")) return { rows: [{ ...user }] };
      return { rows: [{ id: user.id }] };
    }
    if (query.includes("from users where id = $1")) {
      const user = state.users.get(Number(params[0]));
      return { rows: user ? [{
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        university: user.university,
        email: user.email
      }] : [] };
    }
    return { rows: [], rowCount: 0 };
  };

  const client = {
    snapshot: null,
    async query(text, params = []) {
      const query = text.replace(/\s+/g, " ").trim().toLowerCase();
      if (query === "begin") {
        this.snapshot = cloneState(state);
        return { rows: [] };
      }
      if (query === "commit") {
        this.snapshot = null;
        return { rows: [] };
      }
      if (query === "rollback") {
        if (this.snapshot) {
          state.users = this.snapshot.users;
          state.roles = this.snapshot.roles;
          state.applications = this.snapshot.applications;
          state.nextId = this.snapshot.nextId;
          state.legacyRoleNullable = this.snapshot.legacyRoleNullable;
          this.snapshot = null;
        }
        return { rows: [] };
      }
      if (query.includes("information_schema.columns")) {
        return { rows: legacyRoleColumn ? [{ column_name: "role" }] : [] };
      }
      if (query.startsWith("insert into user_roles") && query.includes("select id, role from users")) {
        for (const user of state.users.values()) {
          if (user.legacyRole) state.roles.get(user.id)?.add(user.legacyRole);
        }
        return { rows: [] };
      }
      if (query.startsWith("alter table users alter column role drop not null")) {
        if (state.failMigration) throw new Error("Simulated migration failure");
        state.legacyRoleNullable = true;
        return { rows: [] };
      }
      if (query.startsWith("select id from users where lower(email)")) {
        const user = [...state.users.values()].find((entry) => entry.email.toLowerCase() === params[0]);
        return { rows: user ? [{ id: user.id }] : [] };
      }
      if (query.startsWith("insert into users")) {
        const [firstName, lastName, university, email, passwordHash] = params;
        const user = {
          id: state.nextId++,
          first_name: firstName,
          last_name: lastName,
          university,
          email,
          password_hash: passwordHash,
          created_at: new Date().toISOString(),
          legacyRole: null
        };
        state.users.set(user.id, user);
        return { rows: [{ ...user }] };
      }
      if (query.startsWith("insert into user_roles (user_id, role) values")) {
        if (state.failRoleInsert) throw new Error("Simulated role insert failure");
        const [userId] = params;
        if (!state.users.has(Number(userId))) throw new Error("Role has no user");
        if (!state.roles.has(Number(userId))) state.roles.set(Number(userId), new Set());
        state.roles.get(Number(userId)).add("STUDENT");
        return { rows: [] };
      }
      return { rows: [], rowCount: 0 };
    },
    release() {}
  };

  db.query = fakeQuery;
  db.pool = { connect: async () => client };
  delete require.cache[require.resolve("../services/tutorApplications")];
  delete require.cache[require.resolve("../middleware/auth")];
  delete require.cache[require.resolve("../routes/auth")];

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", require("../routes/auth"));

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  activeHarness = { server, state, url: `http://127.0.0.1:${address.port}` };
  return activeHarness;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return { response, data: await response.json() };
}

afterEach(async () => {
  if (!activeHarness) return;
  await new Promise((resolve, reject) => activeHarness.server.close((error) => error ? reject(error) : resolve()));
  activeHarness = null;
});

test("legacy role migration preserves existing roles and registration creates a student atomically", async () => {
  const harness = await createHarness();
  const registration = await postJson(`${harness.url}/api/auth/register`, {
    firstName: "New",
    lastName: "Student",
    university: "Test University",
    email: "new.student@example.test",
    password: "new-student-password"
  });

  assert.equal(registration.response.status, 201);
  assert.deepEqual(registration.data.user.roles, ["STUDENT"]);
  assert.equal(harness.state.legacyRoleNullable, true);
  assert.equal(harness.state.users.get(1).legacyRole, "STUDENT");
  assert.deepEqual([...harness.state.roles.get(1)].sort(), ["ADMIN", "STUDENT", "TUTOR"]);

  const newUser = [...harness.state.users.values()].find((user) => user.email === "new.student@example.test");
  assert.equal(newUser.legacyRole, null);
  assert.deepEqual([...harness.state.roles.get(newUser.id)], ["STUDENT"]);

  const login = await postJson(`${harness.url}/api/auth/login`, {
    email: "new.student@example.test",
    password: "new-student-password"
  });
  assert.equal(login.response.status, 200);
  assert.deepEqual(login.data.user.roles, ["STUDENT"]);

  const cookie = login.response.headers.get("set-cookie").split(";")[0];
  const meResponse = await fetch(`${harness.url}/api/auth/me`, { headers: { Cookie: cookie } });
  const me = await meResponse.json();
  assert.equal(meResponse.status, 200);
  assert.deepEqual(me.user.roles, ["STUDENT"]);
});

test("migration leaves users without the legacy role column alone", async () => {
  const harness = await createHarness({ legacyRoleColumn: false });
  const registration = await postJson(`${harness.url}/api/auth/register`, {
    firstName: "Fresh",
    lastName: "Student",
    university: "Test University",
    email: "fresh.student@example.test",
    password: "fresh-student-password"
  });

  assert.equal(registration.response.status, 201);
  assert.equal(harness.state.legacyRoleNullable, false);
  assert.deepEqual(registration.data.user.roles, ["STUDENT"]);
});

test("TUTOR intent grants only STUDENT and ADMIN registration is rejected", async () => {
  const harness = await createHarness();
  const tutorIntent = await postJson(`${harness.url}/api/auth/register`, {
    firstName: "Tutor",
    lastName: "Applicant",
    university: "Test University",
    email: "tutor.intent@example.test",
    password: "tutor-intent-password",
    role: "TUTOR"
  });

  assert.equal(tutorIntent.response.status, 201);
  assert.deepEqual(tutorIntent.data.user.roles, ["STUDENT"]);

  const adminAttempt = await postJson(`${harness.url}/api/auth/register`, {
    firstName: "Public",
    lastName: "Admin",
    university: "Test University",
    email: "public.admin@example.test",
    password: "public-admin-password",
    role: "ADMIN"
  });

  assert.equal(adminAttempt.response.status, 400);
  assert.equal([...harness.state.users.values()].some((user) => user.email === "public.admin@example.test"), false);
});

test("registration rolls back the user if the student role insert fails", async () => {
  const harness = await createHarness({ failRoleInsert: true });
  const originalError = console.error;
  console.error = () => {};
  let registration;
  try {
    registration = await postJson(`${harness.url}/api/auth/register`, {
      firstName: "Atomic",
      lastName: "Failure",
      university: "Test University",
      email: "atomic.failure@example.test",
      password: "atomic-failure-password"
    });
  } finally {
    console.error = originalError;
  }

  assert.equal(registration.response.status, 500);
  assert.equal([...harness.state.users.values()].some((user) => user.email === "atomic.failure@example.test"), false);
});

test("registration stops if the legacy role migration fails", async () => {
  const harness = await createHarness({ failMigration: true });
  const originalError = console.error;
  console.error = () => {};
  let registration;
  try {
    registration = await postJson(`${harness.url}/api/auth/register`, {
      firstName: "Migration",
      lastName: "Failure",
      university: "Test University",
      email: "migration.failure@example.test",
      password: "migration-failure-password"
    });
  } finally {
    console.error = originalError;
  }

  assert.equal(registration.response.status, 500);
  assert.equal(harness.state.legacyRoleNullable, false);
  assert.equal([...harness.state.users.values()].some((user) => user.email === "migration.failure@example.test"), false);
  assert.deepEqual([...harness.state.roles.get(1)], ["STUDENT", "ADMIN", "TUTOR"]);
});

test("existing ADMIN and approved TUTOR roles remain effective", async () => {
  const harness = await createHarness();
  const login = await postJson(`${harness.url}/api/auth/login`, {
    email: "existing@example.test",
    password: "existing-test-password"
  });

  assert.equal(login.response.status, 200);
  assert.deepEqual(login.data.user.roles, ["ADMIN", "STUDENT", "TUTOR"]);
});