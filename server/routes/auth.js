const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { DEDICATED_ADMIN_EMAIL } = require("../adminConfig");
const { validateStudentEmail } = require("../universities");
const { authenticateToken } = require("../middleware/auth");
const { getEffectiveRoles } = require("../services/tutorApplications");

const router = express.Router();

let schemaInitialized = false;
async function ensureSchema() {
  if (schemaInitialized) return;
  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Create users table without inline role constraint
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        university VARCHAR(150) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Create user_roles junction table for normalized multi-role support
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL CHECK (role IN ('STUDENT', 'TUTOR', 'ADMIN')),
        PRIMARY KEY (user_id, role)
      );
    `);

    // 3. Migrate existing role data from users table if legacy role column exists
    const hasLegacyColumn = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'users'
        AND column_name = 'role';
    `);

    if (hasLegacyColumn.rows.length > 0) {
      await client.query(`
        INSERT INTO user_roles (user_id, role)
        SELECT
          u.id,
          CASE
            WHEN UPPER(u.role) = 'ADMIN' AND LOWER(u.email) <> $1 THEN 'STUDENT'
            ELSE UPPER(u.role)
          END
        FROM users u
        WHERE u.role IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM user_roles existing_role WHERE existing_role.user_id = u.id
          )
        ON CONFLICT (user_id, role) DO NOTHING;
      `, [DEDICATED_ADMIN_EMAIL]);

      await client.query(`
        DELETE FROM user_roles stale_admin
        USING users u
        WHERE stale_admin.user_id = u.id
          AND stale_admin.role = 'ADMIN'
          AND LOWER(u.email) <> $1
          AND EXISTS (
            SELECT 1
            FROM user_roles preserved_role
            WHERE preserved_role.user_id = u.id
              AND preserved_role.role IN ('STUDENT', 'TUTOR')
          );
      `, [DEDICATED_ADMIN_EMAIL]);

      await client.query(`
        UPDATE users u
        SET role = CASE
          WHEN EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = u.id AND ur.role = 'STUDENT'
          ) THEN 'STUDENT'
          ELSE 'TUTOR'
        END
        WHERE UPPER(u.role) = 'ADMIN'
          AND LOWER(u.email) <> $1
          AND EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = u.id AND ur.role IN ('STUDENT', 'TUTOR')
          );
      `, [DEDICATED_ADMIN_EMAIL]);

      // Keep legacy values for compatibility, but stop requiring this single-role column.
      await client.query("ALTER TABLE users ALTER COLUMN role DROP NOT NULL");
    }

    await client.query("COMMIT");
    schemaInitialized = true;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error initializing schema and migration:", err.message);
    throw err;
  } finally {
    client.release();
  }
}

// Helper to fetch user roles array
async function getUserRoles(userId) {
  return getEffectiveRoles(userId);
}

// Helper to issue JWT and set HttpOnly Cookie
function setAuthCookie(res, user, roles) {
  const jwtSecret = process.env.JWT_SECRET || "easylearning_default_secret_key_change_in_prod";
  const tokenPayload = {
    id: user.id,
    email: user.email,
    roles: roles
  };

  const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: "7d" });

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  return token;
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { firstName, lastName, university, email, password, role } = req.body;

    if (!firstName || !lastName || !university || !email || !password) {
      return res.status(400).json({ error: "All required fields must be provided." });
    }

    if (typeof email !== "string") {
      return res.status(400).json({ error: "Enter a valid university email address." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail === DEDICATED_ADMIN_EMAIL) {
      return res.status(400).json({ error: "This email is reserved for platform administration." });
    }

    const universityValidation = validateStudentEmail(university, email);
    if (universityValidation.error) {
      return res.status(400).json({ error: universityValidation.error });
    }

    const targetRole = role ? role.toUpperCase() : "STUDENT";

    if (!["STUDENT", "TUTOR"].includes(targetRole)) {
      return res.status(400).json({ error: "Invalid role selected." });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const client = await db.pool.connect();
    let newUser;
    try {
      await client.query("BEGIN");

      const existingUser = await client.query("SELECT id FROM users WHERE LOWER(email) = $1", [normalizedEmail]);
      if (existingUser.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "An account with this email address already exists. Please log in to your existing account to add the Tutor role."
        });
      }

     const insertResult = await client.query(
  `INSERT INTO users (
      first_name,
      last_name,
      university,
      email,
      password_hash,
      role
   )
   VALUES ($1, $2, $3, $4, $5, 'STUDENT')
   RETURNING id, first_name, last_name, university, email, role, created_at`,
  [
    firstName.trim(),
    lastName.trim(),
    universityValidation.university.code,
    normalizedEmail,
    passwordHash
  ]
);

newUser = insertResult.rows[0];

      // Tutor intent never grants Tutor access; all public accounts start as Students.
      await client.query(
        "INSERT INTO user_roles (user_id, role) VALUES ($1, 'STUDENT')",
        [newUser.id]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      if (error.code === "23505") {
        return res.status(400).json({
          error: "An account with this email address already exists. Please log in to your existing account to add the Tutor role."
        });
      }
      throw error;
    } finally {
      client.release();
    }

    const roles = await getUserRoles(newUser.id);
    setAuthCookie(res, newUser, roles);

    return res.status(201).json({
      message: "Registration successful",
      user: {
        id: newUser.id,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        university: newUser.university,
        email: newUser.email,
        roles
      }
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ error: "Server error during registration: " + error.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Both email and password are required." });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Query user by email
    const userResult = await db.query(
      "SELECT id, first_name, last_name, university, email, password_hash FROM users WHERE LOWER(email) = $1",
      [normalizedEmail]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const user = userResult.rows[0];

    // Compare passwords using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Fetch all assigned roles
    const roles = await getUserRoles(user.id);

    // Default to STUDENT if no roles exist
    if (roles.length === 0) {
      await db.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'STUDENT') ON CONFLICT DO NOTHING", [user.id]);
      roles.push("STUDENT");
    }

    setAuthCookie(res, user, roles);

    return res.json({
      message: "Login successful",
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        university: user.university,
        email: user.email,
        roles
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Server error during login: " + error.message });
  }
});

// GET /api/auth/me
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const userResult = await db.query(
      "SELECT id, first_name, last_name, university, email FROM users WHERE id = $1",
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User profile not found." });
    }

    const user = userResult.rows[0];
    const roles = await getUserRoles(user.id);

    return res.json({
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        university: user.university,
        email: user.email,
        roles
      }
    });
  } catch (error) {
    console.error("Me error:", error);
    return res.status(500).json({ error: "Server error fetching user profile: " + error.message });
  }
});

// PUT /api/auth/me
router.put("/me", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName, university, email } = req.body;

    if (!firstName || !lastName || !university || !email) {
      return res.status(400).json({ error: "First name, last name, university, and email are required." });
    }

    const cleanFirstName = String(firstName).trim();
    const cleanLastName = String(lastName).trim();
    const normalizedEmail = String(email).trim().toLowerCase();

    if (!cleanFirstName || !cleanLastName) {
      return res.status(400).json({ error: "Please provide a valid first and last name." });
    }

    if (normalizedEmail === DEDICATED_ADMIN_EMAIL) {
      return res.status(400).json({ error: "This email is reserved for platform administration." });
    }

    const universityValidation = validateStudentEmail(university, normalizedEmail);
    if (universityValidation.error) {
      return res.status(400).json({ error: universityValidation.error });
    }

    const currentUserResult = await db.query(
      "SELECT id, first_name, last_name, university, email FROM users WHERE id = $1",
      [userId]
    );

    if (currentUserResult.rows.length === 0) {
      return res.status(404).json({ error: "User profile not found." });
    }

    const currentUser = currentUserResult.rows[0];
    if (normalizedEmail !== currentUser.email.toLowerCase()) {
      const existingUser = await db.query(
        "SELECT id FROM users WHERE LOWER(email) = $1 AND id <> $2",
        [normalizedEmail, userId]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: "This email is already associated with another account." });
      }
    }

    const updatedUserResult = await db.query(
      `UPDATE users
       SET first_name = $1,
           last_name = $2,
           university = $3,
           email = $4
       WHERE id = $5
       RETURNING id, first_name, last_name, university, email`,
      [cleanFirstName, cleanLastName, universityValidation.university.code, normalizedEmail, userId]
    );

    const updatedUser = updatedUserResult.rows[0];
    const roles = await getUserRoles(userId);

    setAuthCookie(res, updatedUser, roles);

    return res.json({
      message: "Profile updated successfully.",
      user: {
        id: updatedUser.id,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        university: updatedUser.university,
        email: updatedUser.email,
        roles
      }
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({ error: "Server error updating profile: " + error.message });
  }
});

// POST /api/auth/upgrade-tutor (Legacy endpoint; Tutor access now requires approval)
router.post("/upgrade-tutor", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userResult = await db.query(
      "SELECT id, first_name, last_name, university, email FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User profile not found." });
    }

    const user = userResult.rows[0];
    const currentRoles = await getUserRoles(userId);

    if (currentRoles.includes("TUTOR")) {
      return res.json({ message: "Your Tutor application has been approved." });
    }

    return res.status(409).json({
      error: "Tutor access requires an approved application.",
      applicationUrl: "/tutor/application"
    });
  } catch (error) {
    console.error("Upgrade tutor error:", error);
    return res.status(500).json({ error: "Server error upgrading user to tutor: " + error.message });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
  });
  return res.json({ message: "Logout successful" });
});

module.exports = router;
module.exports.initializeSchema = ensureSchema;
