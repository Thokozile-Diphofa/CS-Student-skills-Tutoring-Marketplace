const bcrypt = require("bcryptjs");
const db = require("../db");
const { DEDICATED_ADMIN_EMAIL } = require("../adminConfig");

async function getRoles(client, userId) {
  const result = await client.query(
    "SELECT role FROM user_roles WHERE user_id = $1 FOR UPDATE",
    [userId]
  );
  return result.rows.map((row) => row.role);
}

async function bootstrapAdmin({ database = db, environment = process.env } = {}) {
  const password = environment.ADMIN_PASSWORD;
  if (typeof password !== "string" || password.length < 12) {
    throw new Error("A server-only ADMIN_PASSWORD of at least 12 characters is required.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const client = await database.pool.connect();
  let result;

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [DEDICATED_ADMIN_EMAIL]);

    const schemaResult = await client.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name IN ('users', 'user_roles')
    `);
    const schemaColumns = new Set(schemaResult.rows.map((row) => `${row.table_name}.${row.column_name}`));
    if (!schemaColumns.has("users.id") || !schemaColumns.has("users.email")
      || !schemaColumns.has("users.password_hash") || !schemaColumns.has("users.role")
      || !schemaColumns.has("user_roles.user_id") || !schemaColumns.has("user_roles.role")) {
      throw new Error("The existing users and user_roles schema is incomplete; no account changes were made.");
    }

    const existingTargetResult = await client.query(
      "SELECT id FROM users WHERE LOWER(email) = $1 FOR UPDATE",
      [DEDICATED_ADMIN_EMAIL]
    );
    const existingTargetId = existingTargetResult.rows[0]?.id;

    const previousAdminsResult = await client.query(`
      SELECT u.id, u.email, u.role
      FROM users u
      WHERE LOWER(u.email) <> $1
        AND EXISTS (
          SELECT 1 FROM user_roles ur
          WHERE ur.user_id = u.id AND ur.role = 'ADMIN'
        )
      FOR UPDATE
    `, [DEDICATED_ADMIN_EMAIL]);

    if (previousAdminsResult.rows.length > 1) {
      throw new Error("Multiple non-dedicated ADMIN accounts exist; review them manually before provisioning.");
    }

    let previousAdmin = null;
    if (previousAdminsResult.rows.length === 1) {
      previousAdmin = previousAdminsResult.rows[0];
      previousAdmin.roles = await getRoles(client, previousAdmin.id);
      previousAdmin.preservedRoles = previousAdmin.roles.filter((role) => role !== "ADMIN");
      if (!previousAdmin.preservedRoles.some((role) => role === "STUDENT" || role === "TUTOR")) {
        throw new Error("The existing non-dedicated ADMIN account has no student/tutor role to preserve; review it manually.");
      }
    }

    let adminId = existingTargetId;
    if (adminId) {
      await client.query(
        "UPDATE users SET password_hash = $1, role = 'ADMIN' WHERE id = $2",
        [passwordHash, adminId]
      );
    } else {
      const insertResult = await client.query(`
        INSERT INTO users (first_name, last_name, university, email, password_hash, role)
        VALUES ('EasyLearning', 'Administrator', 'EasyLearning', $1, $2, 'ADMIN')
        RETURNING id
      `, [DEDICATED_ADMIN_EMAIL, passwordHash]);
      adminId = insertResult.rows[0].id;
    }

    await client.query("DELETE FROM user_roles WHERE user_id = $1 AND role <> 'ADMIN'", [adminId]);
    await client.query(
      "INSERT INTO user_roles (user_id, role) VALUES ($1, 'ADMIN') ON CONFLICT (user_id, role) DO NOTHING",
      [adminId]
    );

    if (previousAdmin) {
      await client.query("DELETE FROM user_roles WHERE user_id = $1 AND role = 'ADMIN'", [previousAdmin.id]);
      const legacyRole = previousAdmin.preservedRoles.includes("STUDENT")
        ? "STUDENT"
        : "TUTOR";
      await client.query("UPDATE users SET role = $1 WHERE id = $2", [legacyRole, previousAdmin.id]);
    }

    const assignedRoles = await getRoles(client, adminId);
    if (assignedRoles.length !== 1 || assignedRoles[0] !== "ADMIN") {
      throw new Error("Dedicated administrator roles are inconsistent; the setup was rolled back.");
    }

    const remainingAdmins = await client.query(`
      SELECT COUNT(*)::INTEGER AS count
      FROM user_roles ur
      INNER JOIN users u ON u.id = ur.user_id
      WHERE ur.role = 'ADMIN' AND LOWER(u.email) <> $1
    `, [DEDICATED_ADMIN_EMAIL]);
    if (remainingAdmins.rows[0].count !== 0) {
      throw new Error("Non-dedicated ADMIN roles remain; the setup was rolled back.");
    }

    await client.query("COMMIT");
    result = {
      email: DEDICATED_ADMIN_EMAIL,
      userId: adminId,
      roles: assignedRoles,
      previousAdmin: previousAdmin
        ? { userId: previousAdmin.id, email: previousAdmin.email, preservedRoles: previousAdmin.preservedRoles }
        : null
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }

  return result;
}

if (require.main === module) {
  bootstrapAdmin()
    .then((result) => {
      console.log(`Dedicated administrator ready: ${result.email} (ADMIN only).`);
      if (result.previousAdmin) {
        console.log(`Removed only ADMIN from ${result.previousAdmin.email}; preserved ${result.previousAdmin.preservedRoles.join(", ")}.`);
      } else {
        console.log("No non-dedicated development ADMIN assignment needed removal.");
      }
    })
    .catch((error) => {
    console.error(
        "Admin bootstrap failed. Check ADMIN_PASSWORD, database connectivity, and existing role assignments."
    );
    console.error("ACTUAL ERROR:", error);
    process.exitCode = 1;
});
}

module.exports = { bootstrapAdmin };