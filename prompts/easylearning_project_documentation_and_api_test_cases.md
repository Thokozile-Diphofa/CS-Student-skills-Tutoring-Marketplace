# Implementation Prompt: EasyLearning Project Documentation and API Test Cases

Implement only after approval. This is a documentation-only task. Do not change application source, tests, package manifests, environment files, deployment configuration, or behavior. Preserve all current uncommitted changes.

## Inspection findings

- The repository currently has root-level `README.md`, `AGENTS.md`, and `PROJECT_CONTRACT.md`, but no dedicated `docs/` folder.
- The frontend is a Next.js App Router client in `client/`, with dashboard, public tutor discovery, authentication, tutor application, payment, report form, and report-history pages.
- The backend is Express in `server/index.js`, with routers mounted under `/api/auth`, `/api/admin`, `/api/tutor-applications`, `/api/tutors`, `/api/session-requests`, `/api/payments`, and `/api/reports`.
- PostgreSQL access uses the `pg` pool in `server/db.js`; schema includes the checked-in `server/schema.sql` and idempotent startup initialization in route/service code.
- Existing backend package scripts are `npm start`, `npm test`, and `npm run admin:bootstrap`; client scripts are `npm run dev`, `npm run build`, `npm run start`, `npm run lint`, and `npm test`.
- Root `README.md` documents Vercel/Render origins and private tutor-document Supabase configuration. Do not include environment values or inspect/copy local `.env` contents.
- PayFast and report workflows exist in the current source. Document only what source and tests support; identify runtime/deployment dependencies and unverified production integration honestly.
- `server/test/` contains Node.js built-in test suites for authentication, tutor applications, storage, payments, CORS, session requests, reports, schema/startup, and admin bootstrap.

## Required outputs

Create only these files:

1. `docs/EasyLearning_Project_Documentation.md`
2. `docs/EasyLearning_API_Test_Cases.md`

Create the `docs/` directory if it does not exist. Do not overwrite or modify any other file.

Both documents must have a professional title block, project name, documentation date, version, linked table of contents, numbered headings, consistent terminology, and appropriate tables. Use clear formal English. Use Markdown only; do not add PDF tooling or other dependencies.

## Research requirements

Before writing, inspect the current checked-in and uncommitted implementation, including:

- Root `README.md`, `AGENTS.md`, and `PROJECT_CONTRACT.md`.
- All frontend `app/` pages, dashboard components, shared navigation, and API integration relevant to current functionality.
- Backend `server/index.js`, every mounted route file, authentication middleware, database access, all runtime schema initialization, storage/payment/email services, `server/schema.sql`, and relevant environment-variable names.
- Both package manifests, existing tests, `.vscode/tasks.json`, and any tracked deployment/configuration files.
- Current Git status so no existing user work is overwritten.

Do not open, quote, or reproduce `.env` values. A variable name may be documented only when confirmed in code or safe documentation. Do not treat a configured deployment URL as proof of current successful deployment.

For each documented capability, classify it accurately as implemented, tested by an executed repository test, dependent on configuration, partially implemented, planned/not implemented, or not verified. A test suite passing does not prove that Neon, Supabase, PayFast, Render, Vercel, or email services are operational in production.

## Document 1: `docs/EasyLearning_Project_Documentation.md`

Title: **EasyLearning — Project Documentation**

Include:

1. Project overview: name, problem, purpose, target users, scope, key features, benefits.
2. System architecture: actual Next.js frontend, Express backend, PostgreSQL/Neon usage where confirmed, private Supabase Storage, PayFast, and Vercel/Render deployment as evidenced; add an accurate Mermaid architecture diagram.
3. Technology stack table: technology/service, purpose, location, evidence/notes.
4. Student, Tutor, Admin roles, multi-role support, registration/login/logout, tutor application/approval, dashboard access, and server authorization. Distinguish effective roles from UI-only routing.
5. Functional modules: public pages/navigation, authentication, Student/Tutor/Admin dashboards, tutoring profiles/discovery, tutor applications/documents/review, session requests, payments/notifications, reports, and missing/unconfigured features.
6. Non-functional characteristics: security, privacy, validation, file restrictions, errors, availability/retries, maintainability, and performance. Do not assert controls are fully secure without evidence.
7. Database reference: actual tables, columns, SQL types, primary/foreign keys, constraints, indexes, and relations from schema SQL plus runtime schema initializers. Identify where schema is created or migrated. Do not infer unimplemented tables from `PROJECT_CONTRACT.md`.
8. Complete API inventory: every mounted backend endpoint and its actual HTTP method, fully prefixed path, purpose, authentication/role and ownership checks, request/query/path parameters, response shape, validation, and significant errors. Include all existing methods here, including PUT/PATCH where they exist. Derive mount prefix plus router path directly from `server/index.js` and route definitions.
9. Security and private file storage: bcrypt, JWT/cookies/header handling, authorization, upload type/signature/size checks, opaque object keys, signed URL expiry/access control, and payment notification verification where present. Call out limitations such as fallback secrets if present in source and configuration/test gaps without exposing secret material.
10. Local setup: verified prerequisites and repo layout, exact dependency installation and start/test commands from package scripts, env variable names only, database/schema setup, admin bootstrap requirements, and actionable but accurate troubleshooting.
11. Deployment guide: actual Vercel/Render configuration and relevant Supabase/PayFast dependency names, frontend/API URL setup, CORS, commands/configuration verified from repo. Clearly distinguish documented deployment intent from confirmed live health. Never imply this task deploys anything.
12. Limitations and future improvements, separating actual missing features from planned work.
13. Glossary and selected official references (Next.js, Express, PostgreSQL/Neon, Supabase Storage, PayFast) with URLs only if relevant and accurate.

## Document 2: `docs/EasyLearning_API_Test_Cases.md`

Title: **EasyLearning — API Test Case Document**

The endpoint inventory and all detailed API test cases in this document must include **GET and POST endpoints only**.

- Do not list, table, describe, or create test cases for PUT, PATCH, DELETE, OPTIONS, or any other HTTP method.
- Do not change the application's existing HTTP methods to satisfy this constraint.
- Inventory only confirmed, currently mounted GET/POST endpoints. Include root/test endpoints only if useful and clearly identify them.
- For every included endpoint state the exact route, purpose, auth/role and ownership rules, request inputs, and expected response using evidence from source code.

Include:

1. Testing purpose, scope, environment, preconditions, tool recommendations, authentication/test-data handling, and actual execution instructions.
2. GET/POST endpoint inventory grouped by module.
3. Detailed test-case tables with columns: Test Case ID, Module, Test Scenario, Preconditions, HTTP Method, Endpoint, Request Data, Expected Result, Actual Result, Status, Notes.
4. Positive, negative, boundary, authentication, authorization, ownership, and external-service failure cases only when supported by actual GET/POST routes.
5. Fictional account roles (student, approved tutor, pending/rejected tutor applicant, admin) with credential placeholders only. Explain legitimate account creation/admin bootstrap; do not invent default credentials or public admin registration.
6. Multipart upload instructions for only actual GET/POST upload routes; identify safe upload types/limits and storage requirements.
7. Execution summary: planned count may be calculated from included cases; passed/failed/blocked/not-run counts must reflect only tests actually run and evidenced. Keep `Actual Result` blank and status `Not Run` for manual/not-yet-executed cases. Existing automated suite results may be recorded only if the suite is run during this documentation task, with command and actual output.
8. Blank defect log with defect ID, related case, description, severity, reproduction steps, and status.

Unsupported scenarios (for example updating a resource where only PUT/PATCH exists) may be described in a concise Not Applicable note, but must not appear as method test cases or in the GET/POST endpoint inventory. Do not document unsupported features as routes.

## Final verification

- Verify each project-document endpoint against actual route handlers and mount prefixes.
- Verify the API test document contains only GET and POST endpoint methods and only GET/POST examples.
- Verify all schema details against SQL and runtime schema initializers.
- Verify commands against package scripts and any relevant checked-in task configuration.
- Search both documents for accidental secrets, real credentials, invalid endpoint paths, and duplicated test IDs.
- Ensure no manual test is represented as executed and no service health is claimed without evidence.
- Run `git diff --check`.
- Change only the two requested Markdown deliverables.

## Final response

List the two files, summarize their contents, confirm the API test document is restricted to GET/POST, describe any facts/features requiring further verification, and report checks and results honestly.
