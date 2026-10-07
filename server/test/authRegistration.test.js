const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const express = require("express");
const { DEDICATED_ADMIN_EMAIL } = require("../adminConfig");
const db = require("../db");
const { universities } = require("../../client/config/universities.json");

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

test("dedicated administrator email matches the reserved universitydomain value", () => {
  assert.equal(DEDICATED_ADMIN_EMAIL, "admin@universitydomain");
});

async function createHarness({ legacyRoleColumn = true, failRoleInsert = false, failMigration = false } = {}) {
  const existingPasswordHash = await bcrypt.hash("existing-test-password", 4);
  const state = {
    users: new Map([[1, {
      id: 1,
      first_name: "Existing",
      last_name: "Account",
      university: "TUT",
      email: "224696743@tut4life.ac.za",
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
      if (query.startsWith("insert into user_roles") && query.includes("case when upper(u.role)")) {
        const adminEmail = params[0];
        for (const user of state.users.values()) {
          const assignedRoles = state.roles.get(user.id) || new Set();
          if (user.legacyRole && assignedRoles.size === 0) {
            const legacyRole = user.legacyRole.toUpperCase();
            assignedRoles.add(legacyRole === "ADMIN" && user.email.toLowerCase() !== adminEmail
              ? "STUDENT"
              : legacyRole);
            state.roles.set(user.id, assignedRoles);
          }
        }
        return { rows: [] };
      }
      if (query.startsWith("delete from user_roles stale_admin")) {
        const adminEmail = params[0];
        for (const user of state.users.values()) {
          const assignedRoles = state.roles.get(user.id);
          if (user.email.toLowerCase() !== adminEmail && assignedRoles?.has("ADMIN")
            && (assignedRoles.has("STUDENT") || assignedRoles.has("TUTOR"))) {
            assignedRoles.delete("ADMIN");
          }
        }
        return { rows: [] };
      }
      if (query.startsWith("update users u set role = case")) {
        const adminEmail = params[0];
        for (const user of state.users.values()) {
          const assignedRoles = state.roles.get(user.id);
          if (user.email.toLowerCase() !== adminEmail && user.legacyRole?.toUpperCase() === "ADMIN"
            && (assignedRoles?.has("STUDENT") || assignedRoles?.has("TUTOR"))) {
            user.legacyRole = assignedRoles.has("STUDENT") ? "STUDENT" : "TUTOR";
          }
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
          legacyRole: "STUDENT"
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

test("shared university config contains all 26 universities in alphabetical order", () => {
  assert.equal(universities.length, 26);
  assert.deepEqual(universities.map((university) => university.code), [
    "CPUT", "CUT", "DUT", "MUT", "NMU", "NWU", "RU", "SMU", "SPU", "SU",
    "TUT", "UCT", "UFH", "UJ", "UKZN", "UL", "UMP", "UP", "UNISA", "UFS",
    "UWC", "Wits", "UNIVEN", "UNIZULU", "VUT", "WSU"
  ]);
  assert.deepEqual(
    universities.map((university) => university.name),
    [...universities].map((university) => university.name).sort((left, right) => left.localeCompare(right))
  );

  for (const university of universities) {
    if (university.emailVerificationConfigured) {
      assert.ok(university.studentEmailDomains.length > 0);
      assert.ok(university.studentEmailRegex);
      assert.ok(university.example);
      assert.ok(university.verificationSource);
    } else {
      assert.deepEqual(university.studentEmailDomains, []);
      assert.equal(university.studentEmailRegex, null);
      assert.equal(university.example, null);
    }
  }
});

test("legacy migration removes stale normal-account ADMIN while preserving student and tutor roles", async () => {
  const harness = await createHarness();
  const registration = await postJson(`${harness.url}/api/auth/register`, {
    firstName: "New",
    lastName: "Student",
    university: "UCT",
    email: "224870810@myuct.ac.za",
    password: "new-student-password"
  });

  assert.equal(registration.response.status, 201);
  assert.deepEqual(registration.data.user.roles, ["STUDENT"]);
  assert.equal(harness.state.legacyRoleNullable, true);
  assert.equal(harness.state.users.get(1).legacyRole, "STUDENT");
  assert.deepEqual([...harness.state.roles.get(1)].sort(), ["STUDENT", "TUTOR"]);

  const newUser = [...harness.state.users.values()].find((user) => user.email === "224870810@myuct.ac.za");
  assert.equal(newUser.legacyRole, "STUDENT");
  assert.deepEqual([...harness.state.roles.get(newUser.id)], ["STUDENT"]);

  const login = await postJson(`${harness.url}/api/auth/login`, {
    email: "224870810@myuct.ac.za",
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
    university: "UCT",
    email: "224870811@myuct.ac.za",
    password: "fresh-student-password"
  });

  assert.equal(registration.response.status, 201);
  assert.equal(harness.state.legacyRoleNullable, false);
  assert.deepEqual(registration.data.user.roles, ["STUDENT"]);
});

test("registration accepts verified university emails and rejects personal, mismatched, malformed, or unverified choices", async () => {
  const harness = await createHarness();
  const uctRegistration = await postJson(`${harness.url}/api/auth/register`, {
    firstName: "UCT",
    lastName: "Student",
    university: "UCT",
    email: "12345678@myuct.ac.za",
    password: "uct-student-password"
  });
  const witsRegistration = await postJson(`${harness.url}/api/auth/register`, {
    firstName: "Wits",
    lastName: "Student",
    university: "Wits",
    email: "1234567@students.wits.ac.za",
    password: "wits-student-password"
  });
  const nwuRegistration = await postJson(`${harness.url}/api/auth/register`, {
    firstName: "NWU",
    lastName: "Student",
    university: "NWU",
    email: "12345678@mynwu.ac.za",
    password: "nwu-student-password"
  });
  const cputRegistration = await postJson(`${harness.url}/api/auth/register`, {
    firstName: "CPUT",
    lastName: "Student",
    university: "CPUT",
    email: "21212121@mycput.ac.za",
    password: "cput-student-password"
  });
  const tutRegistration = await postJson(`${harness.url}/api/auth/register`, {
    firstName: "TUT",
    lastName: "Student",
    university: "TUT",
    email: "1234567@tut4life.ac.za",
    password: "tut-student-password"
  });
  const upRegistration = await postJson(`${harness.url}/api/auth/register`, {
    firstName: "UP",
    lastName: "Student",
    university: "UP",
    email: "u12345678@tuks.co.za",
    password: "up-student-password"
  });
  const ukznRegistration = await postJson(`${harness.url}/api/auth/register`, {
    firstName: "UKZN",
    lastName: "Student",
    university: "UKZN",
    email: "123456789@stu.ukzn.ac.za",
    password: "ukzn-student-password"
  });
  const unisaRegistration = await postJson(`${harness.url}/api/auth/register`, {
    firstName: "UNISA",
    lastName: "Student",
    university: "UNISA",
    email: "12345678@mylife.unisa.ac.za",
    password: "unisa-student-password"
  });

  assert.equal(uctRegistration.response.status, 201);
  assert.equal(witsRegistration.response.status, 201);
  assert.equal(nwuRegistration.response.status, 201);
  assert.equal(cputRegistration.response.status, 201);
  assert.equal(tutRegistration.response.status, 201);
  assert.equal(upRegistration.response.status, 201);
  assert.equal(ukznRegistration.response.status, 201);
  assert.equal(unisaRegistration.response.status, 201);
  assert.equal(uctRegistration.data.user.university, "UCT");
  assert.equal(witsRegistration.data.user.university, "Wits");
  assert.equal(cputRegistration.data.user.university, "CPUT");
  assert.deepEqual(uctRegistration.data.user.roles, ["STUDENT"]);
  assert.deepEqual(witsRegistration.data.user.roles, ["STUDENT"]);
  assert.deepEqual(cputRegistration.data.user.roles, ["STUDENT"]);

  const initialUserCount = harness.state.users.size;
  const mismatches = [
    { university: "UCT", email: "student@gmail.com" },
    { university: "UCT", email: "1234567@students.wits.ac.za" },
    { university: "Wits", email: "12345678@myuct.ac.za" },
    { university: "CPUT", email: "student@mycput.ac.za" },
    { university: "UCT", email: "not-a-number@myuct.ac.za" },
    { university: "UCT", email: 12345 },
    { university: "UP", email: "12345678@myuct.ac.za" },
    { university: "Unsupported", email: "12345678@myuct.ac.za" }
  ];

  for (const [index, mismatch] of mismatches.entries()) {
    const response = await postJson(`${harness.url}/api/auth/register`, {
      firstName: "Invalid",
      lastName: `Student${index}`,
      university: mismatch.university,
      email: mismatch.email,
      password: "invalid-student-password"
    });
    assert.equal(response.response.status, 400);
  }

  assert.equal(harness.state.users.size, initialUserCount);
});

test("TUTOR intent grants only STUDENT and ADMIN registration is rejected", async () => {
  const harness = await createHarness();
  const tutorIntent = await postJson(`${harness.url}/api/auth/register`, {
    firstName: "Tutor",
    lastName: "Applicant",
    university: "UCT",
    email: "224870812@myuct.ac.za",
    password: "tutor-intent-password",
    role: "TUTOR"
  });

  assert.equal(tutorIntent.response.status, 201);
  assert.deepEqual(tutorIntent.data.user.roles, ["STUDENT"]);

  const adminAttempt = await postJson(`${harness.url}/api/auth/register`, {
    firstName: "Public",
    lastName: "Admin",
    university: "UCT",
    email: "224870813@myuct.ac.za",
    password: "public-admin-password",
    role: "ADMIN"
  });

  assert.equal(adminAttempt.response.status, 400);
  assert.equal([...harness.state.users.values()].some((user) => user.email === "224870813@myuct.ac.za"), false);

  const reservedAdminAttempt = await postJson(`${harness.url}/api/auth/register`, {
    firstName: "Reserved",
    lastName: "Admin",
    university: "TUT",
    email: "admin@universitydomain",
    password: "reserved-admin-password",
    role: "ADMIN"
  });

  assert.equal(reservedAdminAttempt.response.status, 400);

  const reservedEmailAttempt = await postJson(`${harness.url}/api/auth/register`, {
    firstName: "Reserved",
    lastName: "Email",
    university: "TUT",
    email: "ADMIN@UNIVERSITYDOMAIN",
    password: "reserved-email-password",
    role: "STUDENT"
  });

  assert.equal(reservedEmailAttempt.response.status, 400);
  assert.equal([...harness.state.users.values()].some((user) => user.email === "admin@universitydomain"), false);
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
      university: "UCT",
      email: "224870814@myuct.ac.za",
      password: "atomic-failure-password"
    });
  } finally {
    console.error = originalError;
  }

  assert.equal(registration.response.status, 500);
  assert.equal([...harness.state.users.values()].some((user) => user.email === "224870814@myuct.ac.za"), false);
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
      university: "UCT",
      email: "224870815@myuct.ac.za",
      password: "migration-failure-password"
    });
  } finally {
    console.error = originalError;
  }

  assert.equal(registration.response.status, 500);
  assert.equal(harness.state.legacyRoleNullable, false);
  assert.equal([...harness.state.users.values()].some((user) => user.email === "224870815@myuct.ac.za"), false);
  assert.deepEqual([...harness.state.roles.get(1)], ["STUDENT", "ADMIN", "TUTOR"]);
});

test("existing approved TUTOR remains effective while stale normal-account ADMIN is removed", async () => {
  const harness = await createHarness();
  const login = await postJson(`${harness.url}/api/auth/login`, {
    email: "224696743@tut4life.ac.za",
    password: "existing-test-password"
  });

  assert.equal(login.response.status, 200);
  assert.deepEqual(login.data.user.roles, ["STUDENT", "TUTOR"]);
  assert.deepEqual([...harness.state.roles.get(1)].sort(), ["STUDENT", "TUTOR"]);
  assert.equal(harness.state.users.get(1).legacyRole, "STUDENT");
});

test("legacy-only ADMIN on a normal account backfills as STUDENT, not ADMIN", async () => {
  const harness = await createHarness();
  harness.state.users.get(1).legacyRole = "ADMIN";
  harness.state.roles.set(1, new Set());

  const login = await postJson(`${harness.url}/api/auth/login`, {
    email: "224696743@tut4life.ac.za",
    password: "existing-test-password"
  });

  assert.equal(login.response.status, 200);
  assert.deepEqual(login.data.user.roles, ["STUDENT"]);
  assert.equal(harness.state.users.get(1).legacyRole, "STUDENT");
  assert.deepEqual([...harness.state.roles.get(1)], ["STUDENT"]);
});

test("legacy ADMIN for the dedicated email remains ADMIN-only", async () => {
  const harness = await createHarness();
  const passwordHash = await bcrypt.hash("dedicated-admin-password", 4);
  harness.state.users.set(2, {
    id: 2,
    first_name: "EasyLearning",
    last_name: "Administrator",
    university: "EasyLearning",
    email: DEDICATED_ADMIN_EMAIL,
    password_hash: passwordHash,
    created_at: new Date().toISOString(),
    legacyRole: "ADMIN"
  });
  harness.state.roles.set(2, new Set());

  const login = await postJson(`${harness.url}/api/auth/login`, {
    email: DEDICATED_ADMIN_EMAIL,
    password: "dedicated-admin-password"
  });

  assert.equal(login.response.status, 200);
  assert.deepEqual(login.data.user.roles, ["ADMIN"]);
  assert.deepEqual([...harness.state.roles.get(2)], ["ADMIN"]);
});

test("dedicated administrator login and /me return ADMIN only", async () => {
  const harness = await createHarness();
  const adminPasswordHash = await bcrypt.hash("dedicated-admin-password", 4);
  harness.state.users.set(2, {
    id: 2,
    first_name: "EasyLearning",
    last_name: "Administrator",
    university: "EasyLearning",
    email: "admin@universitydomain",
    password_hash: adminPasswordHash,
    created_at: new Date().toISOString(),
    legacyRole: "ADMIN"
  });
  harness.state.roles.set(2, new Set(["ADMIN"]));

  const login = await postJson(`${harness.url}/api/auth/login`, {
    email: "admin@universitydomain",
    password: "dedicated-admin-password"
  });
  assert.equal(login.response.status, 200);
  assert.deepEqual(login.data.user.roles, ["ADMIN"]);

  const cookie = login.response.headers.get("set-cookie").split(";")[0];
  const meResponse = await fetch(`${harness.url}/api/auth/me`, { headers: { Cookie: cookie } });
  const me = await meResponse.json();
  assert.equal(meResponse.status, 200);
  assert.deepEqual(me.user.roles, ["ADMIN"]);
});