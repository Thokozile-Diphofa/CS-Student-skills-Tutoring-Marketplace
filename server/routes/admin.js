const express = require("express");
const db = require("../db");
const { authenticateToken, requireRole } = require("../middleware/auth");
const { ensureTutorApplicationSchema } = require("../services/tutorApplications");

const router = express.Router();

router.get("/payments", authenticateToken, requireRole("ADMIN"), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        p.id,
        p.amount,
        p.currency,
        p.payment_status,
        p.payout_status,
        p.provider,
        p.provider_reference,
        p.created_at AS payment_created_at,
        p.paid_at,
        sr.id AS session_request_id,
        sr.subject,
        sr.requested_date,
        sr.status AS session_status,
        CONCAT(student.first_name, ' ', student.last_name) AS student_name,
        CONCAT(tutor.first_name, ' ', tutor.last_name) AS tutor_name
      FROM payments p
      INNER JOIN session_requests sr ON sr.id = p.session_request_id
      INNER JOIN users student ON student.id = p.student_id
      INNER JOIN users tutor ON tutor.id = p.tutor_id
      ORDER BY p.created_at DESC, p.id DESC
    `);

    return res.json({
      payments: result.rows.map((row) => ({
        id: row.id,
        amount: row.amount === null ? null : Number(row.amount),
        currency: row.currency || "ZAR",
        paymentStatus: row.payment_status,
        payoutStatus: row.payout_status,
        provider: row.provider,
        reference: row.provider_reference || null,
        providerReference: row.provider_reference || null,
        createdAt: row.payment_created_at,
        paidAt: row.paid_at,
        receiptNumber: `EL-RCPT-${row.id}`,
        sessionRequestId: row.session_request_id,
        subject: row.subject,
        requestedDate: row.requested_date,
        sessionStatus: row.session_status,
        studentName: row.student_name || "Unknown student",
        tutorName: row.tutor_name || "Unknown tutor"
      }))
    });
  } catch (error) {
    console.error("Fetch admin payment records error:", error);
    return res.status(500).json({ error: "Unable to load payment records." });
  }
});

router.get("/dashboard", authenticateToken, requireRole("ADMIN"), async (req, res) => {
  try {
    await ensureTutorApplicationSchema();

    const [overviewResult, usersResult, tutorsResult, paymentResult] = await Promise.all([
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
      `),
      db.query(`
        SELECT
          p.id,
          p.amount,
          p.currency,
          p.payment_status,
          p.payout_status,
          p.provider,
          p.provider_reference,
          p.created_at AS payment_created_at,
          p.paid_at,
          sr.id AS session_request_id,
          sr.subject,
          sr.requested_date,
          sr.status AS session_status,
          CONCAT(student.first_name, ' ', student.last_name) AS student_name,
          CONCAT(tutor.first_name, ' ', tutor.last_name) AS tutor_name
        FROM payments p
        INNER JOIN session_requests sr ON sr.id = p.session_request_id
        INNER JOIN users student ON student.id = p.student_id
        INNER JOIN users tutor ON tutor.id = p.tutor_id
        ORDER BY p.created_at DESC, p.id DESC
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
      })),
      payments: paymentResult.rows.map((row) => ({
        id: row.id,
        amount: row.amount === null ? null : Number(row.amount),
        currency: row.currency || "ZAR",
        paymentStatus: row.payment_status,
        payoutStatus: row.payout_status,
        provider: row.provider,
        reference: row.provider_reference || null,
        providerReference: row.provider_reference || null,
        createdAt: row.payment_created_at,
        paidAt: row.paid_at,
        receiptNumber: `EL-RCPT-${row.id}`,
        sessionRequestId: row.session_request_id,
        subject: row.subject,
        requestedDate: row.requested_date,
        sessionStatus: row.session_status,
        studentName: row.student_name || "Unknown student",
        tutorName: row.tutor_name || "Unknown tutor"
      }))
    });
  } catch (error) {
    console.error("Fetch admin dashboard data error:", error);
    return res.status(500).json({ error: "Unable to load admin dashboard data." });
  }
});

module.exports = router;