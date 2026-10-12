const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { afterEach, test } = require("node:test");
const cookieParser = require("cookie-parser");
const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../db");
const tutorApplicationService = require("../services/tutorApplications");

const originalQuery = db.query;
const originalPool = db.pool;
const originalEnsureSchema = tutorApplicationService.ensureTutorApplicationSchema;
const originalGetEffectiveRoles = tutorApplicationService.getEffectiveRoles;
const originalUploadDirectory = process.env.PRIVATE_UPLOAD_DIR;
let activeHarness;

async function createHarness() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "easylearning-documents-"));
  process.env.PRIVATE_UPLOAD_DIR = directory;
  const state = {
    application: null,
    documents: [],
    tutorSkills: [],
    roles: { 1: ["STUDENT"], 2: ["ADMIN"], 3: ["STUDENT"] },
    nextApplicationId: 1,
    nextDocumentId: 1
  };

  const fakeQuery = async (text, params = []) => {
    const query = text.replace(/\s+/g, " ").trim().toLowerCase();
    if (query.startsWith("select email from users where id = $1")) {
      return { rows: [{ email: "student@university.test" }] };
    }
    if (query.startsWith("select ta.*, u.first_name, u.last_name, u.email, u.university")) {
      if (query.includes("where ta.user_id = $1")) {
        return { rows: state.application && Number(state.application.user_id) === Number(params[0])
          ? [{ ...state.application, first_name: "Student", last_name: "Applicant", email: "student@university.test", university: "Account University" }]
          : [] };
      }
      if (query.includes("where ta.submitted_at is not null")) {
        return { rows: state.application && state.application.submitted_at
          ? [{ ...state.application, first_name: "Student", last_name: "Applicant", email: "student@university.test", university: "Account University" }]
          : [] };
      }
    }
    if (query.startsWith("select application_id, document_type, original_name, mime_type, size_bytes")) {
      if (query.includes("any($1::integer[])")) {
        const applicationIds = params[0].map(Number);
        return { rows: state.documents.filter((item) => applicationIds.includes(item.application_id)).map((item) => ({ ...item })) };
      }
      const applicationId = Number(params[0]);
      return { rows: state.documents.filter((item) => item.application_id === applicationId).map((item) => ({ ...item })) };
    }
    if (query.startsWith("select d.storage_key, d.original_name, d.mime_type, a.user_id")) {
      const [applicationId, type] = params;
      const document = state.documents.find((item) =>
        item.application_id === Number(applicationId) && item.document_type === type
      );
      return { rows: document && state.application ? [{
        storage_key: document.storage_key,
        original_name: document.original_name,
        mime_type: document.mime_type,
        user_id: state.application.user_id
      }] : [] };
    }
    throw new Error(`Unexpected fake database query: ${query}`);
  };

  const client = {
    async query(text, params = []) {
      const query = text.replace(/\s+/g, " ").trim().toLowerCase();
      if (["begin", "commit", "rollback"].includes(query)) return { rows: [] };
      if (query.startsWith("select id from users where id = $1 for update")) {
        return { rows: [{ id: Number(params[0]) }] };
      }
      if (query.startsWith("select id, status, submitted_at from tutor_applications")) {
        return { rows: state.application ? [{
          id: state.application.id,
          status: state.application.status,
          submitted_at: state.application.submitted_at
        }] : [] };
      }
      if (query.startsWith("insert into tutor_applications")) {
        const [
          universityName, studentNumber, programme, yearOfStudy, motivation, experience,
          skillsDescription, subjects, rate, userId
        ] = params;
        state.application = {
          id: state.nextApplicationId++,
          user_id: userId,
          university_name: universityName,
          student_number: studentNumber,
          programme,
          year_of_study: yearOfStudy,
          motivation,
          experience,
          skills_description: skillsDescription,
          subjects,
          proposed_hourly_rate: rate,
          status: "PENDING",
          email_verified_at: null,
          application_source: "USER",
          submitted_at: new Date().toISOString(),
          reviewed_at: null,
          rejection_reason: null
        };
        return { rows: [{ ...state.application }] };
      }
      if (query.startsWith("insert into tutor_application_documents")) {
        const [applicationId, documentType, storageKey, originalName, mimeType, sizeBytes] = params;
        const document = {
          id: state.nextDocumentId++,
          application_id: Number(applicationId),
          document_type: documentType,
          storage_key: storageKey,
          original_name: originalName,
          mime_type: mimeType,
          size_bytes: sizeBytes,
          status: "PENDING",
          rejection_reason: null,
          uploaded_at: new Date().toISOString(),
          reviewed_at: null,
          reviewed_by: null
        };
        state.documents = state.documents.filter((item) =>
          item.application_id !== Number(applicationId) || item.document_type !== documentType
        );
        state.documents.push(document);
        return { rows: [{ ...document }] };
      }
      if (query.startsWith("select application_id, document_type, original_name, mime_type, size_bytes")) {
        const applicationId = Number(params[0]);
        return { rows: state.documents
          .filter((item) => item.application_id === applicationId)
          .map((item) => ({ ...item })) };
      }
      if (query.startsWith("select id, status from tutor_applications where user_id = $1 for update")) {
        return { rows: state.application && Number(state.application.user_id) === Number(params[0])
          ? [{ id: state.application.id, status: state.application.status }]
          : [] };
      }
      if (query.startsWith("select id, storage_key, status from tutor_application_documents")) {
        const [applicationId, type] = params;
        const document = state.documents.find((item) =>
          item.application_id === Number(applicationId) && item.document_type === type
        );
        return { rows: document ? [{ id: document.id, storage_key: document.storage_key, status: document.status }] : [] };
      }
      if (query.startsWith("update tutor_application_documents") && query.includes("set storage_key")) {
        const [storageKey, originalName, mimeType, sizeBytes, id] = params;
        const document = state.documents.find((item) => item.id === Number(id));
        Object.assign(document, {
          storage_key: storageKey,
          original_name: originalName,
          mime_type: mimeType,
          size_bytes: sizeBytes,
          status: "PENDING",
          rejection_reason: null,
          reviewed_at: null,
          reviewed_by: null,
          uploaded_at: new Date().toISOString()
        });
        return { rows: [{ ...document }] };
      }
      if (query.startsWith("select id, user_id, status from tutor_applications where id = $1 for update")) {
        return { rows: state.application && state.application.id === Number(params[0])
          ? [{ id: state.application.id, user_id: state.application.user_id, status: state.application.status }]
          : [] };
      }
      if (query.startsWith("select id, status from tutor_application_documents")) {
        const [applicationId, type] = params;
        const document = state.documents.find((item) =>
          item.application_id === Number(applicationId) && item.document_type === type
        );
        return { rows: document ? [{ id: document.id, status: document.status }] : [] };
      }
      if (query.startsWith("update tutor_application_documents")) {
        const [status, reason, adminId, id] = params;
        const document = state.documents.find((item) => item.id === Number(id));
        Object.assign(document, {
          status,
          rejection_reason: reason,
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString()
        });
        return { rows: [{ ...document }] };
      }
      if (query.startsWith("select document_type, status from tutor_application_documents")) {
        const applicationId = Number(params[0]);
        return { rows: state.documents
          .filter((item) => item.application_id === applicationId)
          .map(({ document_type, status }) => ({ document_type, status })) };
      }
      if (query.startsWith("select * from tutor_applications where id = $1 for update")) {
        return { rows: state.application && state.application.id === Number(params[0])
          ? [{ ...state.application }]
          : [] };
      }
      if (query.startsWith("insert into user_roles")) {
        const role = query.includes("'tutor'") ? "TUTOR" : "STUDENT";
        const userId = Number(params[0]);
        state.roles[userId] = [...new Set([...(state.roles[userId] || []), role])];
        return { rows: [] };
      }
      if (query.startsWith("insert into tutor_profiles")) {
        return { rows: [] };
      }
      if (query.startsWith("delete from tutor_skills where user_id = $1")) {
        state.tutorSkills = [];
        return { rows: [] };
      }
      if (query.startsWith("insert into tutor_skills")) {
        state.tutorSkills.push(params[1]);
        return { rows: [] };
      }
      if (query.startsWith("delete from user_roles")) return { rows: [] };
      if (query.startsWith("update tutor_applications")) {
        const [status, , rejectionReason] = params;
        state.application.status = status;
        state.application.reviewed_at = new Date().toISOString();
        state.application.rejection_reason = rejectionReason;
        return { rows: [{ ...state.application }] };
      }
      throw new Error(`Unexpected fake client query: ${query}`);
    },
    release() {}
  };

  db.query = fakeQuery;
  db.pool = { connect: async () => client };
  tutorApplicationService.ensureTutorApplicationSchema = async () => {};
  tutorApplicationService.getEffectiveRoles = async (userId) => state.roles[userId] || [];
  delete require.cache[require.resolve("../middleware/auth")];
  delete require.cache[require.resolve("../routes/tutorApplications")];

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/tutor-applications", require("../routes/tutorApplications"));

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  activeHarness = {
    server,
    state,
    directory,
    url: `http://127.0.0.1:${address.port}`
  };
  return activeHarness;
}

const validApplication = {
  universityName: "University of Cape Town",
  studentNumber: "",
  programme: "Computer Science",
  yearOfStudy: 2,
  motivation: "I enjoy helping other students understand their coursework.",
  experience: "",
  skillsDescription: "I have completed several programming and data courses.",
  proposedHourlyRate: 150,
  subjects: ["CS 101", "Data Structures"]
};

function tokenFor(userId) {
  const jwtSecret = process.env.JWT_SECRET || "easylearning_default_secret_key_change_in_prod";
  return jwt.sign({ id: userId, email: `${userId}@university.test` }, jwtSecret);
}

function createPdf(name, content = "%PDF-1.7 sample academic document") {
  return new Blob([content], { type: "application/pdf" });
}

function createJpeg() {
  return new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])], { type: "image/jpeg" });
}

function createPng() {
  return new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "image/png" });
}

async function postApplication(url, body, options = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(body)) {
    form.append(key, key === "subjects" ? JSON.stringify(value) : String(value));
  }
  if (options.registration !== false) {
    form.append("registration", options.registration || createPdf("registration.pdf"), options.registrationName || "registration.pdf");
  }
  if (options.academicRecord !== false) {
    form.append("academicRecord", options.academicRecord || createPdf("academic-record.pdf"), options.academicRecordName || "academic-record.pdf");
  }
  const headers = options.userId === null ? {} : { Authorization: `Bearer ${tokenFor(options.userId || 1)}` };
  const response = await fetch(`${url}/api/tutor-applications`, {
    method: "POST",
    headers,
    body: form
  });
  return { response, data: await response.json() };
}

async function reviewDocument(url, type, body, userId = 2) {
  return fetch(`${url}/api/tutor-applications/1/documents/${type}/review`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenFor(userId)}`
    },
    body: JSON.stringify(body)
  });
}

afterEach(async () => {
  if (activeHarness) {
    await new Promise((resolve, reject) => activeHarness.server.close((error) => error ? reject(error) : resolve()));
    await fs.rm(activeHarness.directory, { recursive: true, force: true });
    activeHarness = null;
  }
  db.query = originalQuery;
  db.pool = originalPool;
  tutorApplicationService.ensureTutorApplicationSchema = originalEnsureSchema;
  tutorApplicationService.getEffectiveRoles = originalGetEffectiveRoles;
  if (originalUploadDirectory === undefined) delete process.env.PRIVATE_UPLOAD_DIR;
  else process.env.PRIVATE_UPLOAD_DIR = originalUploadDirectory;
  delete require.cache[require.resolve("../middleware/auth")];
  delete require.cache[require.resolve("../routes/tutorApplications")];
});

test("application document validation, review, replacement, private access, and approval gates", async () => {
  const harness = await createHarness();
  const invalidSubjects = [
    undefined,
    [],
    ["   "],
    ["Programming", 123],
    ["x".repeat(101)],
    Array.from({ length: 21 }, (_, index) => `Module ${index + 1}`)
  ];

  for (const subjects of invalidSubjects) {
    const result = await postApplication(harness.url, { ...validApplication, subjects });
    assert.equal(result.response.status, 400);
  }

  const unauthenticated = await postApplication(harness.url, validApplication, { userId: null });
  assert.equal(unauthenticated.response.status, 401);

  const missingDocument = await postApplication(harness.url, validApplication, { academicRecord: false });
  assert.equal(missingDocument.response.status, 400);

  const unsupportedFile = await postApplication(harness.url, validApplication, {
    registration: new Blob(["unsupported"], { type: "text/plain" })
  });
  assert.equal(unsupportedFile.response.status, 415);

  const mismatchedSignature = await postApplication(harness.url, validApplication, {
    registration: new Blob(["not a PDF"], { type: "application/pdf" })
  });
  assert.equal(mismatchedSignature.response.status, 415);

  const oversizedFile = await postApplication(harness.url, validApplication, {
    registration: new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], { type: "application/pdf" })
  });
  assert.equal(oversizedFile.response.status, 400);
  assert.equal(harness.state.application, null);

  const submission = await postApplication(harness.url, {
    ...validApplication,
    subjects: ["  CS 101  ", "cs 101", "Data Structures"]
  });
  assert.equal(submission.response.status, 201);
  assert.deepEqual(submission.data.application.subjects, ["CS 101", "Data Structures"]);
  assert.equal(submission.data.application.universityName, validApplication.universityName);
  assert.deepEqual(
    submission.data.application.documents.map(({ type, status }) => ({ type, status })),
    [
      { type: "registration", status: "PENDING" },
      { type: "academicRecord", status: "PENDING" }
    ]
  );
  assert.deepEqual(harness.state.application.subjects, ["CS 101", "Data Structures"]);

  const applicantStatus = await fetch(`${harness.url}/api/tutor-applications/me`, {
    headers: { Authorization: `Bearer ${tokenFor(1)}` }
  });
  assert.equal(applicantStatus.status, 200);
  assert.equal((await applicantStatus.json()).application.documents.length, 2);
  const adminApplications = await fetch(`${harness.url}/api/tutor-applications`, {
    headers: { Authorization: `Bearer ${tokenFor(2)}` }
  });
  assert.equal(adminApplications.status, 200);
  assert.equal((await adminApplications.json()).applications[0].documents.length, 2);

  const document = harness.state.documents.find((item) => item.document_type === "registration");
  assert.equal((await fs.readFile(path.join(harness.directory, document.storage_key), "utf8")).startsWith("%PDF-"), true);

  const crossApplicantDownload = await fetch(`${harness.url}/api/tutor-applications/1/documents/registration`, {
    headers: { Authorization: `Bearer ${tokenFor(3)}` }
  });
  assert.equal(crossApplicantDownload.status, 404);
  const adminDownload = await fetch(`${harness.url}/api/tutor-applications/1/documents/registration`, {
    headers: { Authorization: `Bearer ${tokenFor(2)}` }
  });
  assert.equal(adminDownload.status, 200);
  assert.equal(adminDownload.headers.get("content-disposition").includes("attachment"), true);
  assert.equal(adminDownload.headers.get("cache-control"), "private, no-store");
  assert.equal((await adminDownload.text()).startsWith("%PDF-"), true);
  const unauthenticatedDownload = await fetch(`${harness.url}/api/tutor-applications/1/documents/registration`);
  assert.equal(unauthenticatedDownload.status, 401);

  const nonAdminReview = await reviewDocument(harness.url, "registration", { status: "VERIFIED" }, 3);
  assert.equal(nonAdminReview.status, 403);
  harness.state.roles[1] = ["STUDENT", "ADMIN"];
  const selfReview = await reviewDocument(harness.url, "registration", { status: "VERIFIED" }, 1);
  assert.equal(selfReview.status, 403);
  harness.state.roles[1] = ["STUDENT"];

  const removedDocument = harness.state.documents.pop();
  const missingDocumentApproval = await fetch(`${harness.url}/api/tutor-applications/1/review`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenFor(2)}`
    },
    body: JSON.stringify({ status: "APPROVED" })
  });
  assert.equal(missingDocumentApproval.status, 409);
  harness.state.documents.push(removedDocument);

  const blockedApproval = await fetch(`${harness.url}/api/tutor-applications/1/review`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenFor(2)}`
    },
    body: JSON.stringify({ status: "APPROVED" })
  });
  assert.equal(blockedApproval.status, 409);
  assert.equal(harness.state.application.status, "PENDING");
  assert.equal(harness.state.roles[1].includes("TUTOR"), false);

  const missingReason = await reviewDocument(harness.url, "registration", { status: "REJECTED" });
  assert.equal(missingReason.status, 400);
  const rejected = await reviewDocument(harness.url, "registration", {
    status: "REJECTED",
    rejectionReason: "Upload a current registration confirmation."
  });
  assert.equal(rejected.status, 200);
  assert.equal((await rejected.json()).document.status, "REJECTED");

  const rejectedApproval = await fetch(`${harness.url}/api/tutor-applications/1/review`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenFor(2)}`
    },
    body: JSON.stringify({ status: "APPROVED" })
  });
  assert.equal(rejectedApproval.status, 409);

  const directReverification = await reviewDocument(harness.url, "registration", { status: "VERIFIED" });
  assert.equal(directReverification.status, 409);

  const replacementForm = new FormData();
  replacementForm.append("document", createPdf("new-registration.pdf"), "new-registration.pdf");
  const replacementResponse = await fetch(`${harness.url}/api/tutor-applications/me/documents/registration`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${tokenFor(1)}` },
    body: replacementForm
  });
  assert.equal(replacementResponse.status, 200);
  const replacement = await replacementResponse.json();
  assert.equal(replacement.document.status, "PENDING");
  assert.equal(replacement.document.rejectionReason, null);

  const verifyRegistration = await reviewDocument(harness.url, "registration", { status: "VERIFIED" });
  assert.equal(verifyRegistration.status, 200);
  const verifyAcademicRecord = await reviewDocument(harness.url, "academicRecord", { status: "VERIFIED" });
  assert.equal(verifyAcademicRecord.status, 200);

  const approved = await fetch(`${harness.url}/api/tutor-applications/1/review`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenFor(2)}`
    },
    body: JSON.stringify({ status: "APPROVED" })
  });
  assert.equal(approved.status, 200);
  assert.equal(harness.state.application.status, "APPROVED");
  assert.equal(harness.state.roles[1].includes("TUTOR"), true);
  assert.deepEqual(harness.state.tutorSkills, ["CS 101", "Data Structures"]);

  await new Promise((resolve, reject) => harness.server.close((error) => error ? reject(error) : resolve()));
  const restartedApp = express();
  restartedApp.use(express.json());
  restartedApp.use(cookieParser());
  restartedApp.use("/api/tutor-applications", require("../routes/tutorApplications"));
  harness.server = restartedApp.listen(0, "127.0.0.1");
  await new Promise((resolve) => harness.server.once("listening", resolve));
  const restartedAddress = harness.server.address();
  const persistedDownload = await fetch(
    `http://127.0.0.1:${restartedAddress.port}/api/tutor-applications/1/documents/registration`,
    { headers: { Authorization: `Bearer ${tokenFor(2)}` } }
  );
  assert.equal(persistedDownload.status, 200);
  assert.equal((await persistedDownload.text()).startsWith("%PDF-"), true);
});

test("valid JPEG registration and PNG academic record files are accepted", async () => {
  const harness = await createHarness();
  const result = await postApplication(harness.url, validApplication, {
    registration: createJpeg(),
    registrationName: "registration.jpg",
    academicRecord: createPng(),
    academicRecordName: "academic-record.png"
  });
  assert.equal(result.response.status, 201);
  assert.deepEqual(
    result.data.application.documents.map(({ mimeType }) => mimeType).sort(),
    ["image/jpeg", "image/png"]
  );
});
