const express = require("express");
const db = require("../db");
const { authenticateToken, requireRole } = require("../middleware/auth");
const {
  getSignedDocumentUrl,
  hasPrivateDocumentStorageConfiguration,
  parseReportAttachment,
  removeUploadedFiles,
  storeUploadedDocument,
  validateFileSignature
} = require("../services/privateDocuments");

const router = express.Router();
const CATEGORIES = [
  "Technical issue",
  "Login or account problem",
  "Tutor application problem",
  "Payment problem",
  "Incorrect or inappropriate content",
  "Suspicious activity or safety concern",
  "Other"
];
const STATUSES = ["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"];
const SUBMISSION_FIELDS = new Set(["category", "subject", "description"]);

function parseId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

function cleanText(value) {
  return value.replace(/\u0000/g, "").trim();
}

function serializeReport(row, { includeDescription = false, includeReporter = false } = {}) {
  return {
    id: row.id,
    category: row.category,
    subject: row.subject,
    ...(includeDescription ? { description: row.description } : {}),
    reporterRoles: row.reporter_roles,
    status: row.status,
    response: row.admin_response || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    attachmentName: row.attachment_original_name || null,
    attachmentUrl: row.attachment_storage_key ? `/api/reports/${row.id}/attachment` : null,
    ...(includeReporter ? {
      reporter: {
        id: row.reporter_id,
        name: [row.reporter_first_name, row.reporter_last_name].filter(Boolean).join(" "),
        email: row.reporter_email,
        roles: row.reporter_roles
      }
    } : {})
  };
}

function getRequestBody(req) {
  return req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
}

router.post(
  "/",
  authenticateToken,
  requireRole("STUDENT", "TUTOR", "ADMIN"),
  parseReportAttachment,
  async (req, res) => {
    const body = getRequestBody(req);
    if (Object.keys(body).some((field) => !SUBMISSION_FIELDS.has(field))) {
      return res.status(400).json({ error: "Only category, subject, and description may be provided." });
    }
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const subject = typeof body.subject === "string" ? cleanText(body.subject) : "";
    const description = typeof body.description === "string" ? cleanText(body.description) : "";

    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ error: "Choose a valid report category." });
    }
    if (!subject || subject.length > 160) {
      return res.status(400).json({ error: "Subject is required and must be 160 characters or fewer." });
    }
    if (!description || description.length > 5000) {
      return res.status(400).json({ error: "Description is required and must be 5000 characters or fewer." });
    }
    if (!Array.isArray(req.user.roles) || req.user.roles.length === 0) {
      return res.status(403).json({ error: "An account role is required to submit a report." });
    }

    const file = req.file || null;
    let attachment = null;
    try {
      if (file) {
        if (file.size < 1) return res.status(400).json({ error: "Choose a non-empty attachment." });
        if (!hasPrivateDocumentStorageConfiguration()) {
          return res.status(503).json({ error: "Private attachment storage is unavailable." });
        }
        await validateFileSignature(file);
        attachment = await storeUploadedDocument(file);
      }

      const result = await db.query(`
        INSERT INTO reports (
          reporter_id, reporter_roles, category, subject, description,
          attachment_storage_key, attachment_original_name,
          attachment_mime_type, attachment_size_bytes, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'OPEN')
        RETURNING id, category, subject, description, reporter_roles, status,
                  admin_response, created_at, updated_at, attachment_original_name,
                  attachment_storage_key
      `, [
        req.user.id,
        req.user.roles,
        category,
        subject,
        description,
        attachment?.storageKey || null,
        attachment?.originalName || null,
        attachment?.mimeType || null,
        attachment?.sizeBytes || null
      ]);
      return res.status(201).json({
        report: serializeReport(result.rows[0], { includeDescription: true })
      });
    } catch (error) {
      if (file?.storageKey) await removeUploadedFiles([file]);
      if (error.statusCode === 415) {
        return res.status(415).json({ error: "The attachment contents do not match its file type." });
      }
      if (error.statusCode === 503) {
        return res.status(503).json({ error: "Private attachment storage is unavailable." });
      }
      if (error.storageOperation) {
        console.error("Report attachment storage operation failed.", { operation: error.storageOperation });
      } else {
        console.error("Submit report failed:", { code: error.code || "unspecified" });
      }
      return res.status(500).json({ error: "Unable to submit your report." });
    }
  }
);

router.get("/mine", authenticateToken, requireRole("STUDENT", "TUTOR", "ADMIN"), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, category, subject, reporter_roles, status, admin_response,
             created_at, updated_at, attachment_original_name, attachment_storage_key
      FROM reports
      WHERE reporter_id = $1
      ORDER BY created_at DESC, id DESC
    `, [req.user.id]);
    return res.json({ reports: result.rows.map((row) => serializeReport(row)) });
  } catch (error) {
    console.error("Fetch own reports failed:", { code: error.code || "unspecified" });
    return res.status(500).json({ error: "Unable to load your reports." });
  }
});

router.get("/admin", authenticateToken, requireRole("ADMIN"), async (req, res) => {
  const status = req.query.status || null;
  const category = req.query.category || null;
  if (status !== null && !STATUSES.includes(status)) {
    return res.status(400).json({ error: "Choose a valid report status filter." });
  }
  if (category !== null && !CATEGORIES.includes(category)) {
    return res.status(400).json({ error: "Choose a valid report category filter." });
  }

  try {
    const result = await db.query(`
      SELECT r.id, r.reporter_id, r.category, r.subject, r.description,
             r.reporter_roles, r.status, r.admin_response, r.created_at,
             r.updated_at, r.attachment_original_name, r.attachment_storage_key,
             u.first_name AS reporter_first_name, u.last_name AS reporter_last_name,
             u.email AS reporter_email
      FROM reports r
      INNER JOIN users u ON u.id = r.reporter_id
      WHERE ($1::VARCHAR IS NULL OR r.status = $1)
        AND ($2::VARCHAR IS NULL OR r.category = $2)
      ORDER BY r.created_at DESC, r.id DESC
    `, [status, category]);
    return res.json({
      reports: result.rows.map((row) =>
        serializeReport(row, { includeDescription: true, includeReporter: true })
      )
    });
  } catch (error) {
    console.error("Fetch admin report queue failed:", { code: error.code || "unspecified" });
    return res.status(500).json({ error: "Unable to load reported issues." });
  }
});

router.post("/:id/status", authenticateToken, requireRole("ADMIN"), async (req, res) => {
  const reportId = parseId(req.params.id);
  const body = getRequestBody(req);
  if (!reportId) return res.status(400).json({ error: "Invalid report ID." });
  if (Object.keys(body).some((field) => !["status", "response"].includes(field))) {
    return res.status(400).json({ error: "Only status and response may be provided." });
  }
  if (!STATUSES.includes(body.status)) {
    return res.status(400).json({ error: "Choose a valid report status." });
  }
  if (body.response !== undefined
    && (typeof body.response !== "string" || body.response.trim().length > 3000)) {
    return res.status(400).json({ error: "Response must be text and 3000 characters or fewer." });
  }

  const hasResponse = Object.prototype.hasOwnProperty.call(body, "response");
  const responseText = hasResponse ? body.response.trim() || null : null;
  try {
    const result = await db.query(`
      UPDATE reports
      SET status = $1,
          admin_response = CASE WHEN $2::BOOLEAN THEN $3 ELSE admin_response END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING id, category, subject, description, reporter_roles, status,
                admin_response, created_at, updated_at, attachment_original_name,
                attachment_storage_key
    `, [body.status, hasResponse, responseText, reportId]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Report not found." });
    return res.json({
      report: serializeReport(result.rows[0], { includeDescription: true })
    });
  } catch (error) {
    console.error("Update report status failed:", { code: error.code || "unspecified" });
    return res.status(500).json({ error: "Unable to update this report." });
  }
});

router.get("/:id/attachment", authenticateToken, async (req, res) => {
  const reportId = parseId(req.params.id);
  if (!reportId) return res.status(400).json({ error: "Invalid report ID." });

  try {
    const result = await db.query(`
      SELECT reporter_id, attachment_storage_key, attachment_original_name
      FROM reports
      WHERE id = $1
    `, [reportId]);
    const report = result.rows[0];
    if (!report || (!req.user.roles.includes("ADMIN")
      && Number(report.reporter_id) !== Number(req.user.id))) {
      return res.status(404).json({ error: "Attachment not found." });
    }
    if (!report.attachment_storage_key) {
      return res.status(404).json({ error: "Attachment not found." });
    }
    if (!hasPrivateDocumentStorageConfiguration()) {
      return res.status(503).json({ error: "Private attachment storage is unavailable." });
    }

    const signedUrl = await getSignedDocumentUrl(
      report.attachment_storage_key,
      report.attachment_original_name
    );
    res.setHeader("Cache-Control", "private, no-store");
    return res.redirect(302, signedUrl);
  } catch (error) {
    if (error.statusCode === 503) {
      return res.status(503).json({ error: "Private attachment storage is unavailable." });
    }
    console.error("Download report attachment failed:", {
      operation: error.storageOperation || "database",
      code: error.code || "unspecified"
    });
    return res.status(500).json({ error: "Unable to download this attachment." });
  }
});

module.exports = router;
