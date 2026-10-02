const express = require("express");
const db = require("../db");
const { authenticateToken, requireRole } = require("../middleware/auth");
const { ensureTutorApplicationSchema } = require("../services/tutorApplications");

const router = express.Router();

router.get("/dashboard", authenticateToken, requireRole("ADMIN"), async (req, res) => {
  try {
    await ensureTutorApplicationSchema();

    const [overviewResult, usersResult, tutorsResult] = await Promise.all([
      db.query(`
        SELECT
          (SELECT COUNT(*) FROM users)::INTEGER AS total_users,
          (SELECT COUNT(DISTINCT user_id) FROM user_roles WHERE role = 'STUDENT')::INTEGER AS students,
          (
            SELECT COUNT(DISTINCT ta.user_id)
            FROM tutor_applications ta
            INNER JOIN user_roles ur ON ur.user_id = ta.user_id AND ur.role = 'TUTOR'
            WHERE ta.status = 'APPROVED' AND ta.submitted_at IS NOT NULL
          )::INTEGER AS approved_tutors,
          (
            SELECT COUNT(*)
            FROM tutor_applications
            WHERE status = 'PENDING' AND submitted_at IS NOT NULL
          )::INTEGER AS pending_applications
      `),
      db.query(`
        SELECT
          u.id,
          u.first_name,
          u.last_name,
          u.email,
          u.university,
          u.created_at,
          COALESCE(
            ARRAY_AGG(DISTINCT ur.role ORDER BY ur.role) FILTER (WHERE ur.role IS NOT NULL),
            ARRAY[]::VARCHAR[]
          ) AS roles
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        GROUP BY u.id
        ORDER BY u.created_at DESC NULLS LAST, u.id DESC
      `),
      db.query(`
        SELECT
          u.id,
          u.first_name,
          u.last_name,
          u.email,
          u.university,
          tp.hourly_rate,
          ta.status AS approval_status,
          COALESCE(
            ARRAY_AGG(DISTINCT ts.skill_name) FILTER (WHERE ts.skill_name IS NOT NULL),
            ARRAY[]::TEXT[]
          ) AS subjects
        FROM tutor_applications ta
        INNER JOIN users u ON u.id = ta.user_id
        INNER JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'TUTOR'
        LEFT JOIN tutor_profiles tp ON tp.user_id = u.id
        LEFT JOIN tutor_skills ts ON ts.user_id = u.id
        WHERE ta.status = 'APPROVED' AND ta.submitted_at IS NOT NULL
        GROUP BY u.id, tp.hourly_rate, ta.status
        ORDER BY u.last_name, u.first_name, u.id
      `)
    ]);

    const overview = overviewResult.rows[0];
    return res.json({
      overview: {
        totalUsers: overview.total_users,
        students: overview.students,
        approvedTutors: overview.approved_tutors,
        pendingApplications: overview.pending_applications
      },
      users: usersResult.rows.map((row) => ({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        university: row.university,
        roles: row.roles,
        createdAt: row.created_at
      })),
      approvedTutors: tutorsResult.rows.map((row) => ({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        university: row.university,
        hourlyRate: row.hourly_rate === null ? null : Number(row.hourly_rate),
        approvalStatus: row.approval_status,
        subjects: row.subjects
      }))
    });
  } catch (error) {
    console.error("Fetch admin dashboard data error:", error);
    return res.status(500).json({ error: "Unable to load admin dashboard data." });
  }
});

module.exports = router;