const assert = require("node:assert/strict");
const { test } = require("node:test");
const bcrypt = require("bcryptjs");
const { DEDICATED_ADMIN_EMAIL } = require("../adminConfig");
const { bootstrapAdmin } = require("../scripts/bootstrapAdmin");

function snapshotState(state) {
  return {
    users: new Map([...state.users].map(([id, user]) => [id, { ...user }])),
    roles: new Map([...state.roles].map(([id, roles]) => [id, new Set(roles)])),
    profiles: new Map(state.profiles),
    applications: new Map(state.applications),
    nextId: state.nextId
  };
}

function createDatabase({ users = [], roles = {}, profiles = [], applications = [] } = {}) {
  const state = {
    users: new Map(users.map((user) => [user.id, { ...user }])),
    roles: new Map(Object.entries(roles).map(([id, assignedRoles]) => [Number(id), new Set(assignedRoles)])),
    profiles: new Map(profiles),
    applications: new Map(applications),
    nextId: Math.max(0, ...users.map((user) => user.id)) + 1
  };
  const counters = { connections: 0 };
  const client = {
    snapshot: null,
    async query(text, params = []) {
      const query = text.replace(/\s+/g, " ").trim().toLowerCase();
      if (query === "begin") {
        this.snapshot = snapshotState(state);
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
          state.profiles = this.snapshot.profiles;
          state.applications = this.snapshot.applications;
          state.nextId = this.snapshot.nextId;
          this.snapshot = null;
        }
        return { rows: [] };
      }
      if (query.startsWith("select pg_advisory_xact_lock")) return { rows: [] };
      if (query.includes("information_schema.columns")) {
        return { rows: ["users.id", "users.email", "users.password_hash", "users.role", "user_roles.user_id", "user_roles.role"]
          .map((column) => {
            const [table_name, column_name] = column.split(".");
            return { table_name, column_name };
          }) };
      }
      if (query.startsWith("select id from users where lower(email) = $1")) {
        const user = [...state.users.values()].find((entry) => entry.email.toLowerCase() === params[0]);
        return { rows: user ? [{ id: user.id }] : [] };
      }
      if (query.startsWith("select u.id, u.email, u.role from users")) {
        return { rows: [...state.users.values()]
          .filter((user) => user.email.toLowerCase() !== params[0] && state.roles.get(user.id)?.has("ADMIN"))
          .map((user) => ({ id: user.id, email: user.email, role: user.role })) };
      }
      if (query.startsWith("select role from user_roles where user_id = $1")) {
        return { rows: [...(state.roles.get(Number(params[0])) || [])].map((role) => ({ role })) };
      }
      if (query.startsWith("update users set password_hash = $1, role = 'admin'")) {
        const [passwordHash, userId] = params;
        Object.assign(state.users.get(Number(userId)), { password_hash: passwordHash, role: "ADMIN" });
        return { rows: [] };
      }
      if (query.startsWith("insert into users")) {
        const [email, passwordHash] = params;
        const id = state.nextId++;
        state.users.set(id, {
          id,
          first_name: "EasyLearning",
          last_name: "Administrator",
          university: "EasyLearning",
          email,
          password_hash: passwordHash,
          role: "ADMIN"
        });
        return { rows: [{ id }] };
      }
      if (query.startsWith("delete from user_roles where user_id = $1 and role <> 'admin'")) {
        const roles = state.roles.get(Number(params[0])) || new Set();
        state.roles.set(Number(params[0]), new Set([...roles].filter((role) => role === "ADMIN")));
        return { rows: [] };
      }
      if (query.startsWith("insert into user_roles")) {
        const [userId] = params;
        if (!state.roles.has(Number(userId))) state.roles.set(Number(userId), new Set());
        state.roles.get(Number(userId)).add("ADMIN");
        return { rows: [] };
      }
      if (query.startsWith("delete from user_roles where user_id = $1 and role = 'admin'")) {
        state.roles.get(Number(params[0]))?.delete("ADMIN");
        return { rows: [] };
      }
      if (query.startsWith("update users set role = $1 where id = $2")) {
        const [role, userId] = params;
        state.users.get(Number(userId)).role = role;
        return { rows: [] };
      }
      if (query.startsWith("select count(*)::integer as count")) {
        const targetEmail = params[0];
        const count = [...state.users.values()].filter((user) => user.email.toLowerCase() !== targetEmail
          && state.roles.get(user.id)?.has("ADMIN")).length;
        return { rows: [{ count }] };
      }
      throw new Error(`Unexpected query in fake DB: ${query}`);
    },
    release() {}
  };

  return {
    state,
    counters,
    database: {
      pool: {
        async connect() {
          counters.connections += 1;
          return client;
        }
      }
    }
  };
}

test("bootstrap creates a dedicated ADMIN-only account with a bcrypt password", async () => {
  const harness = createDatabase();
  const result = await bootstrapAdmin({ database: harness.database, environment: { ADMIN_PASSWORD: "test-admin-password-123" } });
  const admin = harness.state.users.get(result.userId);

  assert.equal(result.email, DEDICATED_ADMIN_EMAIL);
  assert.deepEqual([...harness.state.roles.get(admin.id)], ["ADMIN"]);
  assert.equal(admin.role, "ADMIN");
  assert.equal(await bcrypt.compare("test-admin-password-123", admin.password_hash), true);
  assert.equal(JSON.stringify(result).includes("test-admin-password-123"), false);
});

test("bootstrap removes only ADMIN from the prior account and preserves its data and other roles", async () => {
  const normalUser = {
    id: 14,
    first_name: "Existing",
    last_name: "Student",
    university: "TUT",
    email: "existing.student@example.test",
    password_hash: "existing-hash",
    role: "STUDENT"
  };
  const application = { id: 31, user_id: 14, status: "APPROVED" };
  const profile = { user_id: 14, hourly_rate: 150 };
  const harness = createDatabase({
    users: [normalUser],
    roles: { 14: ["STUDENT", "TUTOR", "ADMIN"] },
    profiles: [[14, profile]],
    applications: [[14, application]]
  });

  const result = await bootstrapAdmin({ database: harness.database, environment: { ADMIN_PASSWORD: "test-admin-password-123" } });

  assert.deepEqual(result.previousAdmin.preservedRoles, ["STUDENT", "TUTOR"]);
  assert.deepEqual([...harness.state.roles.get(14)].sort(), ["STUDENT", "TUTOR"]);
  assert.equal(harness.state.users.get(14).role, "STUDENT");
  assert.equal(harness.state.users.get(14).password_hash, "existing-hash");
  assert.equal(harness.state.profiles.get(14), profile);
  assert.equal(harness.state.applications.get(14), application);
  assert.deepEqual([...harness.state.roles.get(result.userId)], ["ADMIN"]);
});

test("bootstrap converts an existing dedicated-email account to ADMIN only", async () => {
  const existingAdmin = {
    id: 9,
    first_name: "Former",
    last_name: "Student",
    university: "TUT",
    email: DEDICATED_ADMIN_EMAIL,
    password_hash: "old-hash",
    role: "STUDENT"
  };
  const profile = { user_id: 9, hourly_rate: 155 };
  const harness = createDatabase({
    users: [existingAdmin],
    roles: { 9: ["STUDENT", "TUTOR"] },
    profiles: [[9, profile]]
  });

  await bootstrapAdmin({ database: harness.database, environment: { ADMIN_PASSWORD: "replacement-admin-password" } });

  assert.deepEqual([...harness.state.roles.get(9)], ["ADMIN"]);
  assert.equal(harness.state.users.get(9).role, "ADMIN");
  assert.equal(await bcrypt.compare("replacement-admin-password", harness.state.users.get(9).password_hash), true);
  assert.equal(harness.state.profiles.get(9), profile);
});

test("bootstrap refuses ambiguous multiple non-dedicated admins without changes", async () => {
  const harness = createDatabase({
    users: [
      { id: 1, email: "one@example.test", role: "STUDENT" },
      { id: 2, email: "two@example.test", role: "TUTOR" }
    ],
    roles: { 1: ["STUDENT", "ADMIN"], 2: ["TUTOR", "ADMIN"] }
  });
  const beforeRoles = new Map([...harness.state.roles].map(([id, roles]) => [id, [...roles]]));

  await assert.rejects(
    bootstrapAdmin({ database: harness.database, environment: { ADMIN_PASSWORD: "test-admin-password-123" } }),
    /Multiple non-dedicated ADMIN accounts/
  );

  assert.deepEqual(new Map([...harness.state.roles].map(([id, roles]) => [id, [...roles]])), beforeRoles);
  assert.equal([...harness.state.users.values()].some((user) => user.email === DEDICATED_ADMIN_EMAIL), false);
});

test("bootstrap requires a private password environment variable before connecting", async () => {
  const harness = createDatabase();

  await assert.rejects(
    bootstrapAdmin({ database: harness.database, environment: {} }),
    /server-only ADMIN_PASSWORD/
  );

  assert.equal(harness.counters.connections, 0);
});