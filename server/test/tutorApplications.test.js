const assert = require("node:assert/strict");
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
let activeHarness;

async function createHarness() {
  const state = { application: null, tutorSkills: [], nextId: 1 };
  const fakeQuery = async (text, params = []) => {
    const query = text.replace(/\s+/g, " ").trim().toLowerCase();
    if (query.startsWith("select email from users where id = $1")) {
      return { rows: [{ email: "student@university.test" }] };
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
        const [studentNumber, programme, yearOfStudy, motivation, experience, skillsDescription, subjects, rate, userId] = params;
        state.application = {
          id: state.nextId++,
          user_id: userId,
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
      if (query.startsWith("select * from tutor_applications where id = $1 for update")) {
        return { rows: state.application ? [{ ...state.application }] : [] };
      }
      if (query.startsWith("insert into user_roles") || query.startsWith("insert into tutor_profiles")) {
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
  tutorApplicationService.getEffectiveRoles = async (userId) => Number(userId) === 2 ? ["ADMIN"] : ["STUDENT"];
  delete require.cache[require.resolve("../middleware/auth")];
  delete require.cache[require.resolve("../routes/tutorApplications")];

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/tutor-applications", require("../routes/tutorApplications"));

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  activeHarness = { server, state, url: `http://127.0.0.1:${address.port}` };
  return activeHarness;
}

const validApplication = {
  studentNumber: "",
  programme: "Computer Science",
  yearOfStudy: 2,
  motivation: "I enjoy helping other students understand their coursework.",
  experience: "",
  skillsDescription: "I have completed several programming and data courses.",
  proposedHourlyRate: 150,
  subjects: []
};

function tokenFor(userId) {
  const jwtSecret = process.env.JWT_SECRET || "easylearning_default_secret_key_change_in_prod";
  return jwt.sign({ id: userId, email: `${userId}@university.test` }, jwtSecret);
}

async function postApplication(url, body) {
  const response = await fetch(`${url}/api/tutor-applications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenFor(1)}`
    },
    body: JSON.stringify(body)
  });
  return { response, data: await response.json() };
}

afterEach(async () => {
  if (activeHarness) {
    await new Promise((resolve, reject) => activeHarness.server.close((error) => error ? reject(error) : resolve()));
    activeHarness = null;
  }
  db.query = originalQuery;
  db.pool = originalPool;
  tutorApplicationService.ensureTutorApplicationSchema = originalEnsureSchema;
  tutorApplicationService.getEffectiveRoles = originalGetEffectiveRoles;
  delete require.cache[require.resolve("../middleware/auth")];
  delete require.cache[require.resolve("../routes/tutorApplications")];
});

test("tutor applications accept arbitrary modules, normalize them, and promote them on approval", async () => {
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

  const submission = await postApplication(harness.url, {
    ...validApplication,
    subjects: ["  CS 101  ", "cs 101", "Data Structures"]
  });
  assert.equal(submission.response.status, 201);
  assert.deepEqual(submission.data.application.subjects, ["CS 101", "Data Structures"]);
  assert.deepEqual(harness.state.application.subjects, ["CS 101", "Data Structures"]);

  const reviewResponse = await fetch(`${harness.url}/api/tutor-applications/1/review`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenFor(2)}`
    },
    body: JSON.stringify({ status: "APPROVED" })
  });

  assert.equal(reviewResponse.status, 200);
  assert.deepEqual(harness.state.tutorSkills, ["CS 101", "Data Structures"]);
});