const express = require("express");
const db = require("../db");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

function serializeRequest(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    studentFirstName: row.student_first_name,
    studentLastName: row.student_last_name,
    tutorId: row.tutor_id,
    tutorFirstName: row.tutor_first_name,
    tutorLastName: row.tutor_last_name,
    subject: row.subject,
    message: row.message,
    requestedDate: row.requested_date,
    status: row.status,
    createdAt: row.created_at,
    hourlyRate: row.hourly_rate,
    paymentStatus: row.payment_status,
    payoutStatus: row.payout_status,
    paymentAmount: row.payment_amount,
    currency: row.currency,
    paidAt: row.paid_at
  };
}

router.get("/mine", authenticateToken, requireRole("STUDENT"), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        sr.id,
        sr.subject,
        sr.message,
        sr.requested_date,
        sr.status,
        sr.created_at,
        tutor.id AS tutor_id,
        tutor.first_name AS tutor_first_name,
        tutor.last_name AS tutor_last_name,
        tp.hourly_rate::text AS hourly_rate,
        p.payment_status,
        p.payout_status,
        p.amount::text AS payment_amount,
        p.currency,
        p.paid_at
      FROM session_requests sr
      INNER JOIN users tutor ON tutor.id = sr.tutor_id
      LEFT JOIN tutor_profiles tp ON tp.user_id = sr.tutor_id
      LEFT JOIN payments p ON p.session_request_id = sr.id
      WHERE sr.student_id = $1
      ORDER BY sr.created_at DESC, sr.id DESC
    `, [req.user.id]);

    return res.json({ sessionRequests: result.rows.map(serializeRequest) });
  } catch (error) {
    console.error("Fetch student session requests error:", error);
    return res.status(500).json({ error: "Unable to load your session requests." });
  }
});

router.post("/", authenticateToken, requireRole("STUDENT"), async (req, res) => {
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
  const allowedFields = new Set(["tutorId", "subject", "requestedDate", "message"]);
  if (Object.keys(body).some((field) => !allowedFields.has(field))) {
    return res.status(400).json({ error: "Only tutor, subject, date, and message may be provided." });
  }

  const tutorId = Number(body.tutorId);
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = body.message == null ? null : typeof body.message === "string" ? body.message.trim() : "";
  let requestedDate = null;

  if (!Number.isInteger(tutorId) || tutorId < 1) return res.status(400).json({ error: "Select a valid tutor." });
  if (!subject) return res.status(400).json({ error: "Enter a subject or module." });
  if (message === "") return res.status(400).json({ error: "Message must be text." });
  if (message && message.length > 3000) return res.status(400).json({ error: "Message must be 3000 characters or fewer." });
  if (Number(tutorId) === Number(req.user.id)) return res.status(400).json({ error: "You cannot request a session with yourself." });

  if (body.requestedDate != null && body.requestedDate !== "") {
    if (typeof body.requestedDate !== "string") return res.status(400).json({ error: "Enter a valid requested date and time." });
    const parsedDate = new Date(body.requestedDate);
    if (Number.isNaN(parsedDate.getTime())) return res.status(400).json({ error: "Enter a valid requested date and time." });
    requestedDate = parsedDate.toISOString();
  }

  try {
    const tutorResult = await db.query(`
      SELECT u.id
      FROM users u
      INNER JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'TUTOR'
      INNER JOIN tutor_applications ta ON ta.user_id = u.id AND ta.status = 'APPROVED'
      INNER JOIN tutor_profiles tp ON tp.user_id = u.id
      WHERE u.id = $1
    `, [tutorId]);
    if (tutorResult.rows.length === 0) return res.status(404).json({ error: "Approved tutor not found." });

    const result = await db.query(`
      INSERT INTO session_requests (student_id, tutor_id, subject, message, requested_date, status)
      VALUES ($1, $2, $3, $4, $5, 'PENDING')
      RETURNING id, student_id, tutor_id, subject, message, requested_date, status, created_at
    `, [req.user.id, tutorId, subject, message, requestedDate]);

    return res.status(201).json({ sessionRequest: serializeRequest(result.rows[0]) });
  } catch (error) {
    console.error("Create session request failed:", error.code || "database error");
    return res.status(500).json({ error: "Unable to send the session request." });
  }
});

router.get("/incoming", authenticateToken, requireRole("TUTOR"), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT sr.id, sr.student_id, sr.tutor_id, sr.subject, sr.message,
             sr.requested_date, sr.status, sr.created_at,
             student.first_name AS student_first_name,
             student.last_name AS student_last_name,
             tp.hourly_rate::text AS hourly_rate,
             p.payment_status, p.payout_status, p.amount::text AS payment_amount,
             p.currency, p.paid_at
      FROM session_requests sr
      INNER JOIN users student ON student.id = sr.student_id
      LEFT JOIN tutor_profiles tp ON tp.user_id = sr.tutor_id
      LEFT JOIN payments p ON p.session_request_id = sr.id
      WHERE sr.tutor_id = $1
      ORDER BY sr.created_at DESC, sr.id DESC
    `, [req.user.id]);

    return res.json({ sessionRequests: result.rows.map(serializeRequest) });
  } catch (error) {
    console.error("Fetch incoming session requests failed:", error.code || "database error");
    return res.status(500).json({ error: "Unable to load incoming requests." });
  }
});

router.patch("/:id/respond", authenticateToken, requireRole("TUTOR"), async (req, res) => {
  const requestId = Number(req.params.id);
  const responseStatus = req.body?.status;
  if (!Number.isInteger(requestId) || requestId < 1) return res.status(400).json({ error: "Invalid session request ID." });
  if (!["ACCEPTED", "DECLINED"].includes(responseStatus)) {
    return res.status(400).json({ error: "Choose ACCEPTED or DECLINED." });
  }

  let client;
  try {
    client = await db.pool.connect();
    await client.query("BEGIN");
    const requestResult = await client.query(`
      SELECT id, student_id, tutor_id, subject, message, requested_date, status, created_at
      FROM session_requests
      WHERE id = $1
      FOR UPDATE
    `, [requestId]);
    const request = requestResult.rows[0];
    if (!request || Number(request.tutor_id) !== Number(req.user.id)) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Incoming session request not found." });
    }
    if (request.status !== "PENDING") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "This session request has already been handled." });
    }

    const updateResult = await client.query(`
      UPDATE session_requests
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND tutor_id = $3 AND status = 'PENDING'
      RETURNING id, student_id, tutor_id, subject, message, requested_date, status, created_at
    `, [responseStatus, requestId, req.user.id]);
    await client.query("COMMIT");
    return res.json({ sessionRequest: serializeRequest(updateResult.rows[0]) });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("Respond to session request failed:", error.code || "database error");
    return res.status(500).json({ error: "Unable to update the session request." });
  } finally {
    client?.release();
  }
});

module.exports = router;