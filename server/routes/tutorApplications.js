const express = require("express");
const db = require("../db");
const { authenticateToken, requireRole } = require("../middleware/auth");
const { ensureTutorApplicationSchema } = require("../services/tutorApplications");

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_APPLICATION_SUBJECTS = 20;

function normalizeSubjects(value) {
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

  const programme = typeof body.programme === "string" ? body.programme.trim() : "";
  const yearOfStudy = Number(body.yearOfStudy);
  const motivation = typeof body.motivation === "string" ? body.motivation.trim() : "";
  const skillsDescription = typeof body.skillsDescription === "string" ? body.skillsDescription.trim() : "";
  const experience = typeof body.experience === "string" ? body.experience.trim() : "";
  const studentNumber = typeof body.studentNumber === "string" ? body.studentNumber.trim() : "";
  const rate = Number(body.proposedHourlyRate);

  if (!programme || programme.length > 200) return "Programme or course is required (maximum 200 characters).";
  if (!Number.isInteger(yearOfStudy) || yearOfStudy < 1 || yearOfStudy > 12) return "Year of study must be between 1 and 12.";
  if (motivation.length < 20 || motivation.length > 3000) return "Motivation must be between 20 and 3000 characters.";
  if (skillsDescription.length < 20 || skillsDescription.length > 3000) return "Knowledge and skills description must be between 20 and 3000 characters.";
  if (experience.length > 3000) return "Experience must be no more than 3000 characters.";
  if (studentNumber.length > 80) return "Student number must be no more than 80 characters.";
  if (!Number.isFinite(rate) || rate <= 0 || rate > 100000) return "Hourly rate must be a valid amount greater than zero.";
  return "";
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
    return res.json({
      applicant: {
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        institution: row.university
      },
      application: serializeApplication(row)
    });
  } catch (error) {
    console.error("Fetch own tutor application error:", error);
    return res.status(500).json({ error: "Unable to load your tutor application." });
  }
});

router.post("/", authenticateToken, async (req, res) => {
  let client;
  try {
    await ensureTutorApplicationSchema();
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    if (req.user.roles.includes("TUTOR")) {
      return res.status(409).json({ error: "Your tutor application has already been approved." });
    }

    const userResult = await db.query("SELECT email FROM users WHERE id = $1", [req.user.id]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: "Account not found." });

    const validationError = validateApplication(body, userResult.rows[0].email);
    if (validationError) return res.status(400).json({ error: validationError });

    const subjectValidation = normalizeSubjects(body.subjects);
    if (subjectValidation.error) return res.status(400).json({ error: subjectValidation.error });
    const normalizedSubjects = subjectValidation.subjects;
    const rate = Number(body.proposedHourlyRate);
    const yearOfStudy = Number(body.yearOfStudy);

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
          SET student_number = $1, programme = $2, year_of_study = $3,
              motivation = $4, experience = $5, skills_description = $6,
              subjects = $7, proposed_hourly_rate = $8,
              submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $9
          RETURNING *
        `, values)
      : await client.query(`
          INSERT INTO tutor_applications (
            student_number, programme, year_of_study, motivation, experience,
            skills_description, subjects, proposed_hourly_rate, user_id, status, submitted_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING', CURRENT_TIMESTAMP)
          RETURNING *
        `, values);

    await client.query("COMMIT");
    return res.status(201).json({ application: serializeApplication(result.rows[0]) });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("Submit tutor application error:", error);
    if (error.code === "23505") {
      return res.status(409).json({ error: "An application has already been submitted for this account." });
    }
    return res.status(500).json({ error: "Unable to submit your tutor application." });
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
    return res.json({ applications: result.rows.map((row) => ({
      ...serializeApplication(row),
      userId: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      institution: row.university
    })) });
  } catch (error) {
    console.error("Fetch tutor applications error:", error);
    return res.status(500).json({ error: "Unable to load tutor applications." });
  }
});

router.patch("/:id/review", authenticateToken, requireRole("ADMIN"), async (req, res) => {
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