const express = require("express");
const db = require("../db");
const { authenticateToken, requireRole } = require("../middleware/auth");
const { ensureTutorApplicationSchema } = require("../services/tutorApplications");
const {
  getDocumentMetadata,
  getStoredDocumentPath,
  parseApplicationDocuments,
  parseReplacementDocument,
  requirePrivateDocumentStorage,
  requirePrivateStorageForApproval,
  removeStoredDocument,
  removeUploadedFiles,
  validateFileSignature
} = require("../services/privateDocuments");
const fs = require("node:fs");

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_APPLICATION_SUBJECTS = 20;
const DOCUMENT_TYPES = ["registration", "academicRecord"];

function normalizeSubjects(value) {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return { subjects: null, error: "Modules must be provided as a valid list." };
    }
  }
  if (!Array.isArray(value) || value.length === 0) {
    return { subjects: null, error: "Add at least one module you can tutor." };
  }
  if (value.length > MAX_APPLICATION_SUBJECTS) {
    return { subjects: null, error: `You can add up to ${MAX_APPLICATION_SUBJECTS} modules.` };
  }

  const subjects = [];
  const seen = new Set();
  for (const subject of value) {
    if (typeof subject !== "string") {
      return { subjects: null, error: "Each module name must be text." };
    }
    const normalizedSubject = subject.trim();
    if (!normalizedSubject) {
      return { subjects: null, error: "Module names cannot be blank." };
    }
    if (normalizedSubject.length > 100) {
      return { subjects: null, error: "Module names must be 100 characters or fewer." };
    }

    const duplicateKey = normalizedSubject.toLowerCase();
    if (!seen.has(duplicateKey)) {
      seen.add(duplicateKey);
      subjects.push(normalizedSubject);
    }
  }

  return { subjects, error: "" };
}

function serializeApplication(row) {
  return {
    id: row.id,
    universityName: row.university_name || null,
    studentNumber: row.student_number,
    programme: row.programme,
    yearOfStudy: row.year_of_study,
    motivation: row.motivation,
    experience: row.experience,
    skillsDescription: row.skills_description,
    subjects: row.subjects || [],
    proposedHourlyRate: row.proposed_hourly_rate === null ? null : Number(row.proposed_hourly_rate),
    status: row.status,
    emailVerified: row.email_verified_at !== null,
    source: row.application_source,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason
  };
}

function validateApplication(body, email) {
  if (!emailPattern.test(email || "")) return "A valid student email is required.";

  const universityName = typeof body.universityName === "string" ? body.universityName.trim() : "";
  const programme = typeof body.programme === "string" ? body.programme.trim() : "";
  const yearOfStudy = Number(body.yearOfStudy);
  const motivation = typeof body.motivation === "string" ? body.motivation.trim() : "";
  const skillsDescription = typeof body.skillsDescription === "string" ? body.skillsDescription.trim() : "";
  const experience = typeof body.experience === "string" ? body.experience.trim() : "";
  const studentNumber = typeof body.studentNumber === "string" ? body.studentNumber.trim() : "";
  const rate = Number(body.proposedHourlyRate);

  if (!universityName || universityName.length > 200) return "University name is required (maximum 200 characters).";
  if (!programme || programme.length > 200) return "Programme or course is required (maximum 200 characters).";
  if (!Number.isInteger(yearOfStudy) || yearOfStudy < 1 || yearOfStudy > 12) return "Year of study must be between 1 and 12.";
  if (motivation.length < 20 || motivation.length > 3000) return "Motivation must be between 20 and 3000 characters.";
  if (skillsDescription.length < 20 || skillsDescription.length > 3000) return "Knowledge and skills description must be between 20 and 3000 characters.";
  if (experience.length > 3000) return "Experience must be no more than 3000 characters.";
  if (studentNumber.length > 80) return "Student number must be no more than 80 characters.";
  if (!Number.isFinite(rate) || rate <= 0 || rate > 100000) return "Hourly rate must be a valid amount greater than zero.";
  return "";
}

function serializeDocument(row) {
  return {
    type: row.document_type,
    fileName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    status: row.status,
    rejectionReason: row.rejection_reason,
    uploadedAt: row.uploaded_at,
    reviewedAt: row.reviewed_at,
    downloadUrl: `/api/tutor-applications/${row.application_id}/documents/${row.document_type}`
  };
}

function getUploadedFiles(req) {
  return Object.values(req.files || {}).flat();
}

async function validateUploadedFiles(files) {
  for (const file of files) await validateFileSignature(file);
}

function isDocumentType(value) {
  return DOCUMENT_TYPES.includes(value);
}

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function addDocumentsToApplication(application, documents) {
  return {
    ...serializeApplication(application),
    documents: documents.map(serializeDocument)
  };
}

function sendDocumentDownload(res, document) {
  let filePath;
  try {
    filePath = getStoredDocumentPath(document.storage_key);
  } catch (error) {
    if (error.statusCode === 503) {
      return res.status(503).json({ error: "Private document storage is unavailable." });
    }
    console.error("Invalid stored tutor application document reference:", error);
    return res.status(500).json({ error: "Unable to access this document." });
  }

  const fallbackName = document.original_name
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  const encodedName = encodeURIComponent(document.original_name).replace(/['()]/g, escape);
  res.setHeader("Content-Type", document.mime_type);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Disposition", `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`);
  const stream = fs.createReadStream(filePath);
  stream.on("error", (error) => {
    console.error("Tutor application document read error:", error);
    if (res.headersSent) res.destroy(error);
    else {
      res.removeHeader("Content-Disposition");
      res.status(404).json({ error: "Document is not available." });
    }
  });
  stream.pipe(res);
  return undefined;
}

router.get("/subjects", authenticateToken, async (req, res) => {
  try {
    await ensureTutorApplicationSchema();
    const result = await db.query(`
      SELECT DISTINCT skill_name
      FROM tutor_skills
      WHERE BTRIM(skill_name) <> ''
      ORDER BY skill_name ASC
    `);
    return res.json({ subjects: result.rows.map((row) => row.skill_name) });
  } catch (error) {
    console.error("Fetch application subjects error:", error);
    return res.status(500).json({ error: "Unable to load available subjects." });
  }
});

router.get("/me", authenticateToken, async (req, res) => {
  try {
    await ensureTutorApplicationSchema();
    const result = await db.query(`
      SELECT ta.*, u.first_name, u.last_name, u.email, u.university
      FROM tutor_applications ta
      INNER JOIN users u ON u.id = ta.user_id
      WHERE ta.user_id = $1
    `, [req.user.id]);

    if (result.rows.length === 0) return res.json({ application: null });
    const row = result.rows[0];
    const documentsResult = await db.query(`
      SELECT application_id, document_type, original_name, mime_type, size_bytes,
             status, rejection_reason, uploaded_at, reviewed_at
      FROM tutor_application_documents
      WHERE application_id = $1
      ORDER BY document_type
    `, [row.id]);
    return res.json({
      applicant: {
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        institution: row.university_name || row.university
      },
      application: addDocumentsToApplication(row, documentsResult.rows)
    });
  } catch (error) {
    console.error("Fetch own tutor application error:", error);
    return res.status(500).json({ error: "Unable to load your tutor application." });
  }
});

router.post("/", authenticateToken, requireRole("STUDENT"), requirePrivateDocumentStorage, parseApplicationDocuments, async (req, res) => {
  let client;
  const uploadedFiles = getUploadedFiles(req);
  let filesPersisted = false;
  try {
    await ensureTutorApplicationSchema();
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    if (req.user.roles.includes("TUTOR")) {
      return res.status(409).json({ error: "Your tutor application has already been approved." });
    }

    const registrationFile = req.files?.registration?.[0];
    const academicRecordFile = req.files?.academicRecord?.[0];
    if (!registrationFile || !academicRecordFile) {
      return res.status(400).json({ error: "Upload both proof of university registration and an academic record." });
    }
    if (uploadedFiles.length !== 2) {
      return res.status(400).json({ error: "Upload exactly one file for each required document." });
    }
    await validateUploadedFiles(uploadedFiles);

    const userResult = await db.query("SELECT email FROM users WHERE id = $1", [req.user.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: "Account not found." });

    const validationError = validateApplication(body, userResult.rows[0].email);
    if (validationError) return res.status(400).json({ error: validationError });

    const subjectValidation = normalizeSubjects(body.subjects);
    if (subjectValidation.error) return res.status(400).json({ error: subjectValidation.error });
    const normalizedSubjects = subjectValidation.subjects;
    const rate = Number(body.proposedHourlyRate);
    const yearOfStudy = Number(body.yearOfStudy);
    const registrationMetadata = getDocumentMetadata(registrationFile);
    const academicRecordMetadata = getDocumentMetadata(academicRecordFile);

    client = await db.pool.connect();
    await client.query("BEGIN");
    await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [req.user.id]);
    const existingResult = await client.query(
      "SELECT id, status, submitted_at FROM tutor_applications WHERE user_id = $1 FOR UPDATE",
      [req.user.id]
    );

    if (existingResult.rows[0]?.submitted_at || existingResult.rows[0]?.status !== undefined && existingResult.rows[0].status !== "PENDING") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "An application has already been submitted for this account." });
    }

    const values = [
      body.universityName.trim(),
      typeof body.studentNumber === "string" ? body.studentNumber.trim() || null : null,
      body.programme.trim(),
      yearOfStudy,
      body.motivation.trim(),
      typeof body.experience === "string" ? body.experience.trim() || null : null,
      body.skillsDescription.trim(),
      normalizedSubjects,
      rate,
      req.user.id
    ];

    const result = existingResult.rows.length > 0
      ? await client.query(`
          UPDATE tutor_applications
          SET university_name = $1, student_number = $2, programme = $3, year_of_study = $4,
              motivation = $5, experience = $6, skills_description = $7,
              subjects = $8, proposed_hourly_rate = $9,
              submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $10
          RETURNING *
        `, values)
      : await client.query(`
          INSERT INTO tutor_applications (
            university_name, student_number, programme, year_of_study, motivation, experience,
            skills_description, subjects, proposed_hourly_rate, user_id, status, submitted_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING', CURRENT_TIMESTAMP)
          RETURNING *
        `, values);

    for (const [documentType, metadata] of [
      ["registration", registrationMetadata],
      ["academicRecord", academicRecordMetadata]
    ]) {
      await client.query(`
        INSERT INTO tutor_application_documents (
          application_id, document_type, storage_key, original_name,
          mime_type, size_bytes, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
        ON CONFLICT (application_id, document_type) DO UPDATE SET
          storage_key = EXCLUDED.storage_key,
          original_name = EXCLUDED.original_name,
          mime_type = EXCLUDED.mime_type,
          size_bytes = EXCLUDED.size_bytes,
          status = 'PENDING',
          rejection_reason = NULL,
          uploaded_at = CURRENT_TIMESTAMP,
          reviewed_at = NULL,
          reviewed_by = NULL
      `, [result.rows[0].id, documentType, metadata.storageKey, metadata.originalName, metadata.mimeType, metadata.sizeBytes]);
    }

    const documentsResult = await client.query(`
      SELECT application_id, document_type, original_name, mime_type, size_bytes,
             status, rejection_reason, uploaded_at, reviewed_at
      FROM tutor_application_documents
      WHERE application_id = $1
      ORDER BY document_type
    `, [result.rows[0].id]);
    await client.query("COMMIT");
    filesPersisted = true;
    return res.status(201).json({ application: addDocumentsToApplication(result.rows[0], documentsResult.rows) });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (error.statusCode === 415) return res.status(415).json({ error: error.message });
    console.error("Submit tutor application error:", error);
    if (error.code === "23505") {
      return res.status(409).json({ error: "An application has already been submitted for this account." });
    }
    return res.status(500).json({ error: "Unable to submit your tutor application." });
  } finally {
    client?.release();
    if (!filesPersisted) await removeUploadedFiles(uploadedFiles);
  }
});

router.put("/me/documents/:type", authenticateToken, requireRole("STUDENT"), requirePrivateDocumentStorage, parseReplacementDocument, async (req, res) => {
  const documentType = req.params.type;
  if (!isDocumentType(documentType)) {
    await removeUploadedFiles([req.file]);
    return res.status(400).json({ error: "Document type must be registration or academicRecord." });
  }

  let client;
  let replacementStored = false;
  let previousStorageKey;
  try {
    await ensureTutorApplicationSchema();
    await validateFileSignature(req.file);
    const metadata = getDocumentMetadata(req.file);
    client = await db.pool.connect();
    await client.query("BEGIN");
    const applicationResult = await client.query(
      "SELECT id, status FROM tutor_applications WHERE user_id = $1 FOR UPDATE",
      [req.user.id]
    );
    const application = applicationResult.rows[0];
    if (!application || application.status !== "PENDING") {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "A pending tutor application was not found." });
    }

    const documentResult = await client.query(`
      SELECT id, storage_key, status
      FROM tutor_application_documents
      WHERE application_id = $1 AND document_type = $2
      FOR UPDATE
    `, [application.id, documentType]);
    const document = documentResult.rows[0];
    if (!document || document.status !== "REJECTED") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Only a rejected document can be replaced." });
    }

    previousStorageKey = document.storage_key;
    const replacementResult = await client.query(`
      UPDATE tutor_application_documents
      SET storage_key = $1, original_name = $2, mime_type = $3, size_bytes = $4,
          status = 'PENDING', rejection_reason = NULL, uploaded_at = CURRENT_TIMESTAMP,
          reviewed_at = NULL, reviewed_by = NULL
      WHERE id = $5
      RETURNING application_id, document_type, original_name, mime_type, size_bytes,
                status, rejection_reason, uploaded_at, reviewed_at
    `, [metadata.storageKey, metadata.originalName, metadata.mimeType, metadata.sizeBytes, document.id]);
    await client.query("COMMIT");
    replacementStored = true;
    try {
      await removeStoredDocument(previousStorageKey);
    } catch (cleanupError) {
      console.error("Unable to remove replaced tutor application document:", cleanupError);
    }
    return res.json({ document: serializeDocument(replacementResult.rows[0]) });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("Replace tutor application document error:", error);
    if (error.message === "The file contents do not match the selected document type.") {
      return res.status(415).json({ error: error.message });
    }
    return res.status(500).json({ error: "Unable to replace this document." });
  } finally {
    client?.release();
    if (!replacementStored) await removeUploadedFiles([req.file]);
  }
});

router.get("/:id/documents/:type", authenticateToken, requirePrivateDocumentStorage, async (req, res) => {
  const applicationId = parseId(req.params.id);
  const documentType = req.params.type;
  if (!applicationId || !isDocumentType(documentType)) {
    return res.status(400).json({ error: "Invalid application ID or document type." });
  }

  try {
    await ensureTutorApplicationSchema();
    const result = await db.query(`
      SELECT d.storage_key, d.original_name, d.mime_type, a.user_id
      FROM tutor_application_documents d
      INNER JOIN tutor_applications a ON a.id = d.application_id
      WHERE d.application_id = $1 AND d.document_type = $2
    `, [applicationId, documentType]);
    const document = result.rows[0];
    if (!document) return res.status(404).json({ error: "Document not found." });
    if (!req.user.roles.includes("ADMIN") && Number(document.user_id) !== Number(req.user.id)) {
      return res.status(404).json({ error: "Document not found." });
    }
    return sendDocumentDownload(res, document);
  } catch (error) {
    console.error("Download tutor application document error:", error);
    return res.status(500).json({ error: "Unable to download this document." });
  }
});

router.patch("/:id/documents/:type/review", authenticateToken, requireRole("ADMIN"), requirePrivateDocumentStorage, async (req, res) => {
  const applicationId = parseId(req.params.id);
  const documentType = req.params.type;
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
  const { status, rejectionReason } = body;
  if (!applicationId || !isDocumentType(documentType)) {
    return res.status(400).json({ error: "Invalid application ID or document type." });
  }
  if (!["VERIFIED", "REJECTED"].includes(status)) {
    return res.status(400).json({ error: "Document status must be VERIFIED or REJECTED." });
  }
  if (status === "REJECTED" && (
    typeof rejectionReason !== "string"
    || !rejectionReason.trim()
    || rejectionReason.trim().length > 3000
  )) {
    return res.status(400).json({ error: "Provide a rejection reason of no more than 3000 characters." });
  }

  let client;
  try {
    await ensureTutorApplicationSchema();
    client = await db.pool.connect();
    await client.query("BEGIN");
    const applicationResult = await client.query(
      "SELECT id, user_id, status FROM tutor_applications WHERE id = $1 FOR UPDATE",
      [applicationId]
    );
    const application = applicationResult.rows[0];
    if (!application || application.status !== "PENDING") {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "A pending tutor application was not found." });
    }
    if (Number(application.user_id) === Number(req.user.id)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Administrators cannot verify their own application documents." });
    }

    const documentResult = await client.query(`
      SELECT id, status
      FROM tutor_application_documents
      WHERE application_id = $1 AND document_type = $2
      FOR UPDATE
    `, [applicationId, documentType]);
    const currentDocument = documentResult.rows[0];
    if (!currentDocument) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Application document not found." });
    }
    if (currentDocument.status === "REJECTED") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "The applicant must upload a replacement before this document can be reviewed again." });
    }

    const result = await client.query(`
      UPDATE tutor_application_documents
      SET status = $1, rejection_reason = $2, reviewed_by = $3,
          reviewed_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING application_id, document_type, original_name, mime_type, size_bytes,
                status, rejection_reason, uploaded_at, reviewed_at
    `, [
      status,
      status === "REJECTED" ? rejectionReason.trim() : null,
      req.user.id,
      currentDocument.id
    ]);
    if (!result.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Application document not found." });
    }
    await client.query("COMMIT");
    return res.json({ document: serializeDocument(result.rows[0]) });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("Review tutor application document error:", error);
    return res.status(500).json({ error: "Unable to review this document." });
  } finally {
    client?.release();
  }
});

router.get("/", authenticateToken, requireRole("ADMIN"), async (req, res) => {
  try {
    await ensureTutorApplicationSchema();
    const result = await db.query(`
      SELECT ta.*, u.first_name, u.last_name, u.email, u.university
      FROM tutor_applications ta
      INNER JOIN users u ON u.id = ta.user_id
      WHERE ta.submitted_at IS NOT NULL
      ORDER BY CASE ta.status WHEN 'PENDING' THEN 0 ELSE 1 END, ta.submitted_at ASC
    `);
    const applicationIds = result.rows.map((row) => row.id);
    const documentsResult = applicationIds.length
      ? await db.query(`
          SELECT application_id, document_type, original_name, mime_type, size_bytes,
                 status, rejection_reason, uploaded_at, reviewed_at
          FROM tutor_application_documents
          WHERE application_id = ANY($1::integer[])
          ORDER BY document_type
        `, [applicationIds])
      : { rows: [] };
    const documentsByApplication = new Map();
    for (const document of documentsResult.rows) {
      const documents = documentsByApplication.get(document.application_id) || [];
      documents.push(serializeDocument(document));
      documentsByApplication.set(document.application_id, documents);
    }
    return res.json({ applications: result.rows.map((row) => ({
      ...serializeApplication(row),
      userId: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      institution: row.university_name || row.university,
      documents: documentsByApplication.get(row.id) || []
    })) });
  } catch (error) {
    console.error("Fetch tutor applications error:", error);
    return res.status(500).json({ error: "Unable to load tutor applications." });
  }
});

router.patch("/:id/review", authenticateToken, requireRole("ADMIN"), requirePrivateStorageForApproval, async (req, res) => {
  const applicationId = Number(req.params.id);
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
  const { status, rejectionReason } = body;
  if (!Number.isInteger(applicationId) || applicationId < 1) {
    return res.status(400).json({ error: "Invalid application ID." });
  }
  if (!["APPROVED", "REJECTED"].includes(status)) {
    return res.status(400).json({ error: "Review status must be APPROVED or REJECTED." });
  }
  if (status === "REJECTED" && (
    typeof rejectionReason !== "string"
    || !rejectionReason.trim()
    || rejectionReason.trim().length > 3000
  )) {
    return res.status(400).json({ error: "Provide a rejection reason of no more than 3000 characters." });
  }

  const client = await db.pool.connect();
  try {
    await ensureTutorApplicationSchema();
    await client.query("BEGIN");
    const applicationResult = await client.query(
      "SELECT * FROM tutor_applications WHERE id = $1 FOR UPDATE",
      [applicationId]
    );
    const application = applicationResult.rows[0];
    if (!application || !application.submitted_at) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Submitted tutor application not found." });
    }
    if (application.status !== "PENDING") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "This application has already been reviewed." });
    }
    if (status === "APPROVED") {
      const documentsResult = await client.query(`
        SELECT document_type, status
        FROM tutor_application_documents
        WHERE application_id = $1
        FOR UPDATE
      `, [applicationId]);
      const verifiedTypes = new Set(
        documentsResult.rows
          .filter((document) => document.status === "VERIFIED")
          .map((document) => document.document_type)
      );
      if (
        documentsResult.rows.length !== DOCUMENT_TYPES.length
        || DOCUMENT_TYPES.some((documentType) => !verifiedTypes.has(documentType))
      ) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Both registration and academic record documents must be verified before approval." });
      }
      await client.query(
        "INSERT INTO user_roles (user_id, role) VALUES ($1, 'STUDENT') ON CONFLICT DO NOTHING",
        [application.user_id]
      );
      await client.query(
        "INSERT INTO user_roles (user_id, role) VALUES ($1, 'TUTOR') ON CONFLICT DO NOTHING",
        [application.user_id]
      );
      await client.query(`
        INSERT INTO tutor_profiles (user_id, headline, bio, hourly_rate)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id) DO UPDATE SET
          headline = EXCLUDED.headline,
          bio = EXCLUDED.bio,
          hourly_rate = EXCLUDED.hourly_rate
      `, [application.user_id, application.programme, application.skills_description, application.proposed_hourly_rate]);
      await client.query("DELETE FROM tutor_skills WHERE user_id = $1", [application.user_id]);
      for (const subject of application.subjects) {
        await client.query(
          "INSERT INTO tutor_skills (user_id, skill_name) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [application.user_id, subject]
        );
      }
    } else {
      await client.query("DELETE FROM user_roles WHERE user_id = $1 AND role = 'TUTOR'", [application.user_id]);
    }

    const result = await client.query(`
      UPDATE tutor_applications
      SET status = $1, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = $2,
          rejection_reason = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [status, req.user.id, status === "REJECTED" ? rejectionReason.trim() : null, applicationId]);
    await client.query("COMMIT");
    return res.json({ application: serializeApplication(result.rows[0]) });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Review tutor application error:", error);
    return res.status(500).json({ error: "Unable to review tutor application." });
  } finally {
    client.release();
  }
});

module.exports = router;