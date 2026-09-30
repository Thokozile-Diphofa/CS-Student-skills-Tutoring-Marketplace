const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { authenticateToken } = require("../middleware/auth");
const { getEffectiveRoles } = require("../services/tutorApplications");

const router = express.Router();

let schemaInitialized = false;
async function ensureSchema() {
  if (schemaInitialized) return;
  try {
    // 1. Create users table without inline role constraint
    await db.query(`
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
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL CHECK (role IN ('STUDENT', 'TUTOR', 'ADMIN')),
        PRIMARY KEY (user_id, role)
      );
    `);

    // 3. Migrate existing role data from users table if legacy role column exists
    const hasLegacyColumn = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'role';
    `);

    if (hasLegacyColumn.rows.length > 0) {
      await db.query(`
        INSERT INTO user_roles (user_id, role)
        SELECT id, role FROM users WHERE role IS NOT NULL
        ON CONFLICT (user_id, role) DO NOTHING;
      `);
    }

    schemaInitialized = true;
  } catch (err) {
    console.error("Error initializing schema and migration:", err.message);
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
    await ensureSchema();
    const { firstName, lastName, university, email, password, role } = req.body;

    if (!firstName || !lastName || !university || !email || !password) {
      return res.status(400).json({ error: "All required fields must be provided." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const targetRole = role ? role.toUpperCase() : "STUDENT";

    if (!["STUDENT", "TUTOR"].includes(targetRole)) {
      return res.status(400).json({ error: "Invalid role selected." });
    }

    // Check if account already exists
    const existingUser = await db.query("SELECT id FROM users WHERE LOWER(email) = $1", [normalizedEmail]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        error: "An account with this email address already exists. Please log in to your existing account to add the Tutor role."
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert user into users table
    const insertResult = await db.query(
      `INSERT INTO users (first_name, last_name, university, email, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, first_name, last_name, university, email, created_at`,
      [firstName.trim(), lastName.trim(), university.trim(), normalizedEmail, passwordHash]
    );

    const newUser = insertResult.rows[0];

    // Tutor intent never grants Tutor access; all public accounts start as Students.
    await db.query(
      `INSERT INTO user_roles (user_id, role) VALUES ($1, 'STUDENT') ON CONFLICT DO NOTHING;`,
      [newUser.id]
    );

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
    await ensureSchema();
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
    await ensureSchema();
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

// POST /api/auth/upgrade-tutor (Legacy endpoint; Tutor access now requires approval)
router.post("/upgrade-tutor", authenticateToken, async (req, res) => {
  try {
    await ensureSchema();
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
