const express = require("express");
const db = require("../db");
const { authenticateToken, requireRole } = require("../middleware/auth");
const { ensureTutorApplicationSchema } = require("../services/tutorApplications");

const router = express.Router();

let schemaInitialized = false;
async function ensureTutorSchema() {
  await ensureTutorApplicationSchema();
  if (schemaInitialized) return;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS tutor_profiles (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        headline VARCHAR(255) DEFAULT 'Computer Science & Mathematics Peer Tutor',
        bio TEXT DEFAULT 'Experienced computer science student tutor passionate about helping peers master programming algorithms, web development, and course concepts.',
        hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 180.00,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS tutor_skills (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        skill_name VARCHAR(100) NOT NULL,
        UNIQUE(user_id, skill_name)
      );
    `);

    // Provision default profile & skills for any tutor lacking profile entries
    const tutorsWithoutProfile = await db.query(`
      SELECT ur.user_id
      FROM user_roles ur
      INNER JOIN tutor_applications ta
        ON ta.user_id = ur.user_id
        AND ta.status = 'APPROVED'
      LEFT JOIN tutor_profiles tp ON ur.user_id = tp.user_id
      WHERE ur.role = 'TUTOR' AND tp.user_id IS NULL
    `);

    for (const row of tutorsWithoutProfile.rows) {
      await db.query(`
        INSERT INTO tutor_profiles (user_id, headline, bio, hourly_rate)
        VALUES ($1, 'Computer Science & Mathematics Peer Tutor', 'Experienced computer science student tutor passionate about helping peers master programming concepts.', 180.00)
        ON CONFLICT (user_id) DO NOTHING
      `, [row.user_id]);

      await db.query(`
        INSERT INTO tutor_skills (user_id, skill_name) VALUES
        ($1, 'Computer Science'),
        ($1, 'Mathematics')
        ON CONFLICT (user_id, skill_name) DO NOTHING
      `, [row.user_id]);
    }

    schemaInitialized = true;
  } catch (err) {
    console.error("Error initializing tutor schema:", err.message);
  }
}

// GET /api/tutors (Public endpoint for tutor listing and search by subject/name)
router.get("/", async (req, res) => {
  try {
    await ensureTutorSchema();
    const { search, subject, university } = req.query;

    let queryText = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.university,
        u.email,
        COALESCE(tp.headline, 'Computer Science Peer Tutor') as headline,
        COALESCE(tp.bio, 'Experienced student tutor ready to help.') as bio,
        COALESCE(tp.hourly_rate, 180.00) as hourly_rate,
        COALESCE(
          json_agg(DISTINCT ts.skill_name) FILTER (WHERE ts.skill_name IS NOT NULL),
          '["Computer Science", "Mathematics"]'::json
        ) as subjects
      FROM users u
      INNER JOIN user_roles ur ON u.id = ur.user_id AND ur.role = 'TUTOR'
      INNER JOIN tutor_applications ta
        ON ta.user_id = u.id
        AND ta.status = 'APPROVED'
      LEFT JOIN tutor_profiles tp ON u.id = tp.user_id
      LEFT JOIN tutor_skills ts ON u.id = ts.user_id
      WHERE 1=1
    `;

    const queryParams = [];

    if (search && search.trim() !== "") {
      queryParams.push(`%${search.trim().toLowerCase()}%`);
      const paramIdx = queryParams.length;
      queryText += ` AND (
        LOWER(u.first_name) LIKE $${paramIdx} OR
        LOWER(u.last_name) LIKE $${paramIdx} OR
        LOWER(u.university) LIKE $${paramIdx} OR
        LOWER(COALESCE(tp.headline, '')) LIKE $${paramIdx} OR
        LOWER(COALESCE(tp.bio, '')) LIKE $${paramIdx} OR
        EXISTS (
          SELECT 1 FROM tutor_skills ts_sub 
          WHERE ts_sub.user_id = u.id AND LOWER(ts_sub.skill_name) LIKE $${paramIdx}
        )
      )`;
    }

    if (subject && subject.trim() !== "" && subject !== "All") {
      queryParams.push(`%${subject.trim().toLowerCase()}%`);
      const paramIdx = queryParams.length;
      queryText += ` AND EXISTS (
        SELECT 1 FROM tutor_skills ts_sub 
        WHERE ts_sub.user_id = u.id AND LOWER(ts_sub.skill_name) LIKE $${paramIdx}
      )`;
    }

    if (university && university.trim() !== "" && university !== "All") {
      queryParams.push(`%${university.trim().toLowerCase()}%`);
      const paramIdx = queryParams.length;
      queryText += ` AND LOWER(u.university) LIKE $${paramIdx}`;
    }

    queryText += ` GROUP BY u.id, tp.headline, tp.bio, tp.hourly_rate ORDER BY u.id ASC`;

    const result = await db.query(queryText, queryParams);

    const tutors = result.rows.map(row => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      university: row.university,
      email: row.email,
      headline: row.headline,
      bio: row.bio,
      hourlyRate: parseFloat(row.hourly_rate),
      subjects: Array.isArray(row.subjects) ? row.subjects : ["Computer Science", "Mathematics"],
      roles: ["STUDENT", "TUTOR"]
    }));

    return res.json({ tutors });
  } catch (error) {
    console.error("Fetch tutors error:", error);
    return res.status(500).json({ error: "Server error retrieving tutor listings: " + error.message });
  }
});

// GET /api/tutors/profile (Authenticated endpoint for the current tutor)
router.get("/profile", authenticateToken, requireRole("TUTOR"), async (req, res) => {
  try {
    await ensureTutorSchema();

    const result = await db.query(`
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.university,
        u.email,
        tp.headline,
        tp.bio,
        tp.hourly_rate,
        COALESCE(
          json_agg(DISTINCT ts.skill_name) FILTER (WHERE ts.skill_name IS NOT NULL),
          '[]'::json
        ) as subjects
      FROM users u
      INNER JOIN tutor_profiles tp ON tp.user_id = u.id
      LEFT JOIN tutor_skills ts ON ts.user_id = u.id
      WHERE u.id = $1
      GROUP BY u.id, tp.headline, tp.bio, tp.hourly_rate
    `, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Tutor profile not found." });
    }

    const row = result.rows[0];
    return res.json({
      tutor: {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        university: row.university,
        email: row.email,
        headline: row.headline,
        bio: row.bio,
        hourlyRate: Number(row.hourly_rate),
        subjects: Array.isArray(row.subjects) ? row.subjects : []
      }
    });
  } catch (error) {
    console.error("Fetch current tutor profile error:", error);
    return res.status(500).json({ error: "Server error retrieving tutor profile." });
  }
});

// GET /api/tutors/:id (Public endpoint for single tutor profile)
router.get("/:id", async (req, res) => {
  try {
    await ensureTutorSchema();
    const tutorId = parseInt(req.params.id, 10);

    if (isNaN(tutorId)) {
      return res.status(400).json({ error: "Invalid tutor ID provided." });
    }

    const queryText = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.university,
        u.email,
        COALESCE(tp.headline, 'Computer Science Peer Tutor') as headline,
        COALESCE(tp.bio, 'Experienced student tutor ready to help.') as bio,
        COALESCE(tp.hourly_rate, 180.00) as hourly_rate,
        COALESCE(
          json_agg(DISTINCT ts.skill_name) FILTER (WHERE ts.skill_name IS NOT NULL),
          '["Computer Science", "Mathematics"]'::json
        ) as subjects
      FROM users u
      INNER JOIN user_roles ur ON u.id = ur.user_id AND ur.role = 'TUTOR'
      INNER JOIN tutor_applications ta
        ON ta.user_id = u.id
        AND ta.status = 'APPROVED'
      LEFT JOIN tutor_profiles tp ON u.id = tp.user_id
      LEFT JOIN tutor_skills ts ON u.id = ts.user_id
      WHERE u.id = $1
      GROUP BY u.id, tp.headline, tp.bio, tp.hourly_rate
    `;

    const result = await db.query(queryText, [tutorId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Tutor profile not found." });
    }

    const row = result.rows[0];
    const tutor = {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      university: row.university,
      email: row.email,
      headline: row.headline,
      bio: row.bio,
      hourlyRate: parseFloat(row.hourly_rate),
      subjects: Array.isArray(row.subjects) ? row.subjects : ["Computer Science", "Mathematics"],
      roles: ["STUDENT", "TUTOR"]
    };

    return res.json({ tutor });
  } catch (error) {
    console.error("Fetch tutor profile error:", error);
    return res.status(500).json({ error: "Server error retrieving tutor profile: " + error.message });
  }
});

// PUT /api/tutors/profile (Authenticated endpoint for tutors to update their profile/subjects/rates)
router.put("/profile", authenticateToken, requireRole("TUTOR"), async (req, res) => {
  try {
    await ensureTutorSchema();
    const userId = req.user.id;
    const { headline, bio, hourlyRate, subjects } = req.body;

    const rateNum = parseFloat(hourlyRate);
    if (isNaN(rateNum) || rateNum <= 0) {
      return res.status(400).json({ error: "Please provide a valid positive hourly rate." });
    }

    // Upsert tutor profile
    await db.query(`
      INSERT INTO tutor_profiles (user_id, headline, bio, hourly_rate)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id) DO UPDATE SET
        headline = EXCLUDED.headline,
        bio = EXCLUDED.bio,
        hourly_rate = EXCLUDED.hourly_rate
    `, [userId, headline || "Computer Science Peer Tutor", bio || "", rateNum]);

    // Update skills if array provided
    if (Array.isArray(subjects) && subjects.length > 0) {
      await db.query("DELETE FROM tutor_skills WHERE user_id = $1", [userId]);
      for (const skill of subjects) {
        if (typeof skill === "string" && skill.trim()) {
          await db.query(
            "INSERT INTO tutor_skills (user_id, skill_name) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            [userId, skill.trim()]
          );
        }
      }
    }

    return res.json({ message: "Tutor profile successfully updated." });
  } catch (error) {
    console.error("Update tutor profile error:", error);
    return res.status(500).json({ error: "Server error updating tutor profile: " + error.message });
  }
});

module.exports = router;
